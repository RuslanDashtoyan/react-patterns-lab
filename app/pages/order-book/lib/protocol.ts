/**
 * Wire protocol for the ONE multiplexed WebSocket.
 *
 * "Multiplexed" = several logical streams (channels) share one socket.
 * Every server message says which channel it belongs to, which symbol it is
 * about, and carries a sequence number so the client can detect gaps.
 */

export type BookSide = "bid" | "ask";
export type OrderSide = "buy" | "sell";
export type Channel = "book" | "orders";

/** One price level change. size "0" means "remove this level". */
export interface LevelChange {
  side: BookSide;
  price: string;
  size: string;
}

/** [price, size] */
export type RawLevel = [string, string];

export type OrderStatus = "open" | "partially_filled" | "filled" | "cancelled";

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  price: string;
  size: string;
  filled: string;
  status: OrderStatus;
  createdAt: number;
}

// ---------- server -> client ----------

export interface BookSnapshotMessage {
  channel: "book";
  type: "snapshot";
  symbol: string;
  /** Sequence number of the last delta already included in this snapshot */
  seq: number;
  bids: RawLevel[];
  asks: RawLevel[];
}

export interface BookDeltaMessage {
  channel: "book";
  type: "delta";
  symbol: string;
  /** Must be exactly previous seq + 1, otherwise we missed something */
  seq: number;
  changes: LevelChange[];
}

export interface OrderUpdateMessage {
  channel: "orders";
  type: "order_update";
  symbol: string;
  /** Per-user order stream sequence */
  seq: number;
  order: Order;
}

export interface HeartbeatMessage {
  channel: "system";
  type: "heartbeat";
  symbol: "*";
  seq: number;
  ts: number;
}

export type BookMessage = BookSnapshotMessage | BookDeltaMessage;
export type ServerMessage = BookMessage | OrderUpdateMessage | HeartbeatMessage;

// ---------- client -> server ----------

export type ClientMessage =
  | { op: "subscribe"; channel: Channel; symbol: string }
  | { op: "unsubscribe"; channel: Channel; symbol: string }
  /** Ask for a fresh book snapshot (used after a sequence gap) */
  | { op: "snapshot"; channel: "book"; symbol: string };

/**
 * The minimal WebSocket surface we use. Both the browser `WebSocket` and our
 * in-browser `MockSocket` satisfy it, so the rest of the code doesn't care
 * which one it talks to.
 */
export interface SocketLike {
  readonly readyState: number;
  onopen: (() => void) | null;
  onclose: ((event: { code: number; reason: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  send(data: string): void;
  close(): void;
}

export const SOCKET_OPEN = 1;
