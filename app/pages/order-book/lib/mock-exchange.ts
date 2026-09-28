/**
 * MockExchange — a fake exchange SERVER running inside the browser, so the
 * demo works with no backend. It speaks exactly the protocol in protocol.ts.
 *
 * `MockSocket` implements the WebSocket surface (`SocketLike`), so
 * MarketConnection can't tell it apart from a real `new WebSocket(url)`.
 * Messages are JSON strings and are delivered with network latency, which
 * naturally produces "in-flight messages for the old symbol" after a switch.
 *
 * It also exposes simulation controls (drop connection, lose a delta, stall
 * the feed...) used by the Simulator panel to exercise every failure path.
 */
import { MARKETS, type MarketConfig } from "./markets";
import {
  cmp,
  decimalsOf,
  isMultipleOf,
  isDecimalString,
  offsetByTicks,
  sub,
  add,
} from "./decimal";
import type {
  ClientMessage,
  LevelChange,
  Order,
  OrderSide,
  RawLevel,
  ServerMessage,
  SocketLike,
} from "./protocol";

const LATENCY_MS = 40; // one-way, constant so order is preserved
const TICK_MS = 20; // generator loop interval
const BOOK_LEVELS = 25; // levels per side the generator keeps around mid

interface MarketState {
  config: MarketConfig;
  mid: string;
  bids: Map<string, string>;
  asks: Map<string, string>;
  seq: number;
}

// ---------------------------------------------------------------------------

export class MockSocket implements SocketLike {
  readyState = 0; // CONNECTING
  onopen: SocketLike["onopen"] = null;
  onclose: SocketLike["onclose"] = null;
  onerror: SocketLike["onerror"] = null;
  onmessage: SocketLike["onmessage"] = null;

  /** Server-side view of this connection */
  readonly bookSubs = new Set<string>();
  ordersSub = false;

  constructor(private readonly exchange: MockExchange) {
    setTimeout(() => {
      if (this.readyState !== 0) return;
      this.readyState = 1; // OPEN
      exchange.attach(this);
      this.onopen?.();
    }, 150);
  }

  /** client -> server (arrives after latency) */
  send(data: string) {
    if (this.readyState !== 1) return;
    setTimeout(() => {
      if (this.readyState === 1) this.exchange.receive(this, JSON.parse(data));
    }, LATENCY_MS);
  }

  /** server -> client (arrives after latency) */
  deliver(msg: ServerMessage) {
    const data = JSON.stringify(msg);
    setTimeout(() => {
      if (this.readyState === 1) this.onmessage?.({ data });
    }, LATENCY_MS);
  }

  /** Client-initiated close */
  close() {
    this.terminate(1000, "client closed");
  }

  /** Close from either side */
  terminate(code: number, reason: string) {
    if (this.readyState >= 2) return;
    this.readyState = 3; // CLOSED
    this.exchange.detach(this);
    setTimeout(() => this.onclose?.({ code, reason }), 0);
  }
}

// ---------------------------------------------------------------------------

export class MockExchange {
  private markets = new Map<string, MarketState>();
  private sockets = new Set<MockSocket>();
  private loop: ReturnType<typeof setInterval> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private carry = 0;

  private orders = new Map<string, Order>();
  private ordersSeq = 0;
  private orderId = 0;

  // simulation knobs
  /** Delta messages per second, per market */
  rate = 100;
  private pausedUntil = 0;
  private dropNextDelta = new Set<string>();
  private refuseConnectionsUntil = 0;

  constructor() {
    for (const config of Object.values(MARKETS)) {
      this.markets.set(config.symbol, createMarket(config));
    }
  }

  // ---------------- connection handling ----------------

  createSocket = (): SocketLike => {
    const socket = new MockSocket(this);
    if (Date.now() < this.refuseConnectionsUntil) {
      // Simulate "server unreachable": fail before open.
      setTimeout(() => socket.terminate(1006, "unreachable"), 100);
    }
    return socket;
  };

  attach(socket: MockSocket) {
    this.sockets.add(socket);
    this.start();
  }

  detach(socket: MockSocket) {
    this.sockets.delete(socket);
    if (this.sockets.size === 0) this.stop();
  }

  receive(socket: MockSocket, msg: ClientMessage) {
    if (msg.channel === "orders") {
      socket.ordersSub = msg.op === "subscribe";
      return;
    }
    const market = this.markets.get(msg.symbol);
    if (!market) return;

    if (msg.op === "subscribe") {
      socket.bookSubs.add(msg.symbol);
      socket.deliver(snapshotOf(market));
    } else if (msg.op === "unsubscribe") {
      socket.bookSubs.delete(msg.symbol);
    } else if (msg.op === "snapshot") {
      socket.deliver(snapshotOf(market));
    }
  }

  // ---------------- REST-ish API (used by api/orders-api.ts) ----------------

  getOrders() {
    return {
      seq: this.ordersSeq,
      orders: [...this.orders.values()].sort((a, b) => b.createdAt - a.createdAt),
    };
  }

  placeOrder(input: { symbol: string; side: OrderSide; price: string; size: string }) {
    const market = this.markets.get(input.symbol);
    if (!market) throw new Error(`Unknown market ${input.symbol}`);
    const { tick, sizeStep } = market.config;
    if (!isDecimalString(input.price) || !isMultipleOf(input.price, tick)) {
      throw new Error(`Price must be a multiple of ${tick}`);
    }
    if (!isDecimalString(input.size) || !isMultipleOf(input.size, sizeStep)) {
      throw new Error(`Size must be a multiple of ${sizeStep}`);
    }

    const order: Order = {
      id: `ord_${++this.orderId}`,
      ...input,
      filled: "0",
      status: "open",
      createdAt: Date.now(),
    };
    this.orders.set(order.id, order);
    this.emitOrder(order);
    this.scheduleFills(order.id);
    return order;
  }

  cancelOrder(id: string) {
    const order = this.orders.get(id);
    if (!order) throw new Error("Order not found");
    if (order.status === "filled" || order.status === "cancelled") {
      throw new Error(`Order already ${order.status}`);
    }
    const updated: Order = { ...order, status: "cancelled" };
    this.orders.set(id, updated);
    this.emitOrder(updated);
    return updated;
  }

  // ---------------- simulation controls ----------------

  /** Server kills every connection (client should reconnect with backoff). */
  dropConnections(refuseForMs = 0) {
    this.refuseConnectionsUntil = Date.now() + refuseForMs;
    for (const socket of [...this.sockets]) socket.terminate(1006, "server dropped");
  }

  /** Apply the next delta server-side but never send it → client sees a gap. */
  loseNextDelta(symbol: string) {
    this.dropNextDelta.add(symbol);
  }

  /** Stop sending anything (even heartbeats) → client marks feed stale. */
  stall(ms: number) {
    this.pausedUntil = Date.now() + ms;
  }

  /** Send a delta for a market the client is NOT subscribed to. */
  sendForeignSymbolDelta() {
    for (const socket of this.sockets) {
      const foreign = [...this.markets.values()].find(
        (m) => !socket.bookSubs.has(m.config.symbol),
      );
      if (!foreign) continue;
      socket.deliver({
        channel: "book",
        type: "delta",
        symbol: foreign.config.symbol,
        seq: foreign.seq,
        changes: [{ side: "bid", price: foreign.mid, size: "999" }],
      });
    }
  }

  // ---------------- generator loop ----------------

  private start() {
    if (this.loop) return;
    this.loop = setInterval(() => this.tick(), TICK_MS);
    this.heartbeat = setInterval(() => {
      if (Date.now() < this.pausedUntil) return;
      for (const socket of this.sockets) {
        socket.deliver({ channel: "system", type: "heartbeat", symbol: "*", seq: 0, ts: Date.now() });
      }
    }, 1000);
  }

  private stop() {
    if (this.loop) clearInterval(this.loop);
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.loop = this.heartbeat = null;
  }

  private tick() {
    if (Date.now() < this.pausedUntil) return;

    // How many deltas this tick (fractional carry keeps the average exact).
    this.carry += (this.rate * TICK_MS) / 1000;
    const count = Math.floor(this.carry);
    this.carry -= count;

    for (let i = 0; i < count; i++) {
      for (const market of this.markets.values()) {
        const changes = nextChanges(market);
        if (changes.length === 0) continue;
        market.seq++;

        const symbol = market.config.symbol;
        if (this.dropNextDelta.delete(symbol)) continue; // "lost" on the wire

        const msg: ServerMessage = { channel: "book", type: "delta", symbol, seq: market.seq, changes };
        for (const socket of this.sockets) {
          if (socket.bookSubs.has(symbol)) socket.deliver(msg);
        }
      }
    }
  }

  private emitOrder(order: Order) {
    this.ordersSeq++;
    for (const socket of this.sockets) {
      if (socket.ordersSub) {
        socket.deliver({ channel: "orders", type: "order_update", symbol: order.symbol, seq: this.ordersSeq, order });
      }
    }
  }

  /** Fill the order in 1–3 random chunks over a few seconds. */
  private scheduleFills(id: string) {
    const step = () => {
      const order = this.orders.get(id);
      if (!order || order.status === "cancelled" || order.status === "filled") return;

      const dp = decimalsOf(this.markets.get(order.symbol)!.config.sizeStep);
      const remaining = sub(order.size, order.filled);
      const chunk =
        Math.random() < 0.4 ? remaining : (randomBetween(0.2, 0.7) * Number(remaining)).toFixed(dp);
      const filled = cmp(chunk, "0") > 0 ? add(order.filled, chunk) : order.filled;
      const done = cmp(filled, order.size) >= 0;

      const updated: Order = {
        ...order,
        filled: done ? order.size : filled,
        status: done ? "filled" : "partially_filled",
      };
      this.orders.set(id, updated);
      this.emitOrder(updated);
      if (!done) setTimeout(step, randomBetween(1500, 4000));
    };
    setTimeout(step, randomBetween(2000, 5000));
  }
}

// ---------------------------------------------------------------------------
// Book generation helpers

function createMarket(config: MarketConfig): MarketState {
  const market: MarketState = {
    config,
    mid: config.startMid,
    bids: new Map(),
    asks: new Map(),
    seq: 0,
  };
  for (let k = 1; k <= BOOK_LEVELS; k++) {
    market.bids.set(offsetByTicks(market.mid, config.tick, -k), randomSize(config));
    market.asks.set(offsetByTicks(market.mid, config.tick, k), randomSize(config));
  }
  return market;
}

function snapshotOf(market: MarketState): ServerMessage {
  const levels = (map: Map<string, string>): RawLevel[] => [...map.entries()];
  return {
    channel: "book",
    type: "snapshot",
    symbol: market.config.symbol,
    seq: market.seq,
    bids: levels(market.bids),
    asks: levels(market.asks),
  };
}

/** Produce one delta's worth of level changes and apply it server-side. */
function nextChanges(market: MarketState): LevelChange[] {
  const { tick } = market.config;
  const changes: LevelChange[] = [];
  const set = (side: "bid" | "ask", price: string, size: string) => {
    const levels = side === "bid" ? market.bids : market.asks;
    if (size === "0") levels.delete(price);
    else levels.set(price, size);
    changes.push({ side, price, size });
  };

  // Occasionally move the mid price and clean up crossed / far levels.
  if (Math.random() < 0.04) {
    const steps = Math.round(randomBetween(-3, 3));
    market.mid = offsetByTicks(market.mid, tick, steps);
    const low = offsetByTicks(market.mid, tick, -BOOK_LEVELS - 5);
    const high = offsetByTicks(market.mid, tick, BOOK_LEVELS + 5);
    for (const price of market.bids.keys()) {
      if (cmp(price, market.mid) >= 0 || cmp(price, low) < 0) set("bid", price, "0");
    }
    for (const price of market.asks.keys()) {
      if (cmp(price, market.mid) <= 0 || cmp(price, high) > 0) set("ask", price, "0");
    }
  }

  // Update one level; squaring the random biases activity toward the top.
  const side = Math.random() < 0.5 ? "bid" : "ask";
  const k = 1 + Math.floor(Math.random() ** 2 * BOOK_LEVELS);
  const price = offsetByTicks(market.mid, tick, side === "bid" ? -k : k);
  const exists = (side === "bid" ? market.bids : market.asks).has(price);
  set(side, price, exists && Math.random() < 0.15 ? "0" : randomSize(market.config));

  return changes;
}

function randomSize(config: MarketConfig) {
  const dp = decimalsOf(config.sizeStep);
  const base = config.symbol.startsWith("BTC") ? 2 : config.symbol.startsWith("ETH") ? 30 : 400;
  // Fake data source: a float is fine HERE, it becomes a string immediately.
  return Math.max(Number(config.sizeStep), Math.random() ** 2 * base).toFixed(dp);
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/** One fake exchange per browser tab. */
export const mockExchange = new MockExchange();
