/**
 * MarketConnection — owns the ONE WebSocket for the whole page.
 *
 * Responsibilities:
 *  - connect, and reconnect with exponential backoff when the socket drops
 *  - remember active subscriptions and re-send them after every reconnect
 *  - route incoming messages to listeners by `channel` (multiplexing)
 *  - detect a "stale" feed: socket looks open but nothing arrived lately
 *  - mirror health into `useConnectionStore` (rarely changing values only)
 *
 * No React in here. Hooks just call `subscribe()` / `on()` inside effects.
 */
import {
  SOCKET_OPEN,
  type Channel,
  type ClientMessage,
  type ServerMessage,
  type SocketLike,
} from "./protocol";
import { useConnectionStore } from "../store/connection-store";

type ListenerChannel = ServerMessage["channel"];
type Listener = (msg: ServerMessage) => void;
type LifecycleEvent = "open" | "close";

export const STALE_AFTER_MS = 3000;
const MAX_BACKOFF_MS = 10_000;

export class MarketConnection {
  private socket: SocketLike | null = null;
  private refCount = 0;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private staleTimer: ReturnType<typeof setInterval> | null = null;

  /** Mutable on purpose — updating a store 100x/sec would re-render things. */
  private lastMessageAt = 0;

  /** key "channel:symbol" -> refcount, so two components can share one sub */
  private subscriptions = new Map<string, number>();
  private listeners = new Map<ListenerChannel, Set<Listener>>();
  private lifecycleListeners = new Set<(event: LifecycleEvent) => void>();

  constructor(private readonly createSocket: () => SocketLike) {}

  // ---------------- lifecycle ----------------

  /** A component that needs the socket calls acquire() on mount... */
  acquire() {
    this.refCount++;
    if (this.refCount === 1) this.open();
  }

  /** ...and release() on unmount. Last one out closes the socket. */
  release() {
    this.refCount = Math.max(0, this.refCount - 1);
    if (this.refCount === 0) this.shutdown();
  }

  // ---------------- pub/sub API ----------------

  /** Subscribe to a server stream. Returns an unsubscribe function. */
  subscribe(channel: Channel, symbol: string) {
    const key = `${channel}:${symbol}`;
    const count = this.subscriptions.get(key) ?? 0;
    this.subscriptions.set(key, count + 1);
    if (count === 0) this.send({ op: "subscribe", channel, symbol });

    return () => {
      const current = this.subscriptions.get(key) ?? 0;
      if (current <= 1) {
        this.subscriptions.delete(key);
        this.send({ op: "unsubscribe", channel, symbol });
      } else {
        this.subscriptions.set(key, current - 1);
      }
    };
  }

  /** Listen to incoming messages of one channel. Returns an off function. */
  on(channel: ListenerChannel, listener: Listener) {
    let set = this.listeners.get(channel);
    if (!set) this.listeners.set(channel, (set = new Set()));
    set.add(listener);
    return () => set.delete(listener);
  }

  /** "open" after every (re)connect, "close" whenever the socket drops. */
  onLifecycle(listener: (event: LifecycleEvent) => void) {
    this.lifecycleListeners.add(listener);
    return () => this.lifecycleListeners.delete(listener);
  }

  /** Sends only when open. Subscriptions are replayed on (re)connect anyway. */
  send(msg: ClientMessage) {
    if (this.socket?.readyState === SOCKET_OPEN) {
      this.socket.send(JSON.stringify(msg));
    }
  }

  // ---------------- internals ----------------

  private open() {
    this.clearReconnect();
    useConnectionStore.setState({
      status: this.reconnectAttempt === 0 ? "connecting" : "reconnecting",
    });

    const socket = this.createSocket();
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.lastMessageAt = Date.now();
      useConnectionStore.setState({ status: "open", stale: false, reconnectAttempt: 0 });

      // Tell listeners first (BookFeed resets to "loading"), then re-subscribe
      // so the server sends fresh snapshots.
      this.lifecycleListeners.forEach((fn) => fn("open"));
      for (const key of this.subscriptions.keys()) {
        const [channel, symbol] = key.split(":") as [Channel, string];
        this.send({ op: "subscribe", channel, symbol });
      }
      this.startStaleWatch();
    };

    socket.onmessage = (event) => {
      this.lastMessageAt = Date.now();
      if (useConnectionStore.getState().stale) {
        useConnectionStore.setState({ stale: false });
      }

      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(event.data));
      } catch {
        return; // ignore garbage
      }
      this.listeners.get(msg.channel)?.forEach((fn) => fn(msg));
    };

    socket.onerror = () => {
      // onclose always follows onerror; reconnect logic lives there.
    };

    socket.onclose = () => {
      if (this.socket !== socket) return; // an old socket we already replaced
      this.socket = null;
      this.stopStaleWatch();
      this.lifecycleListeners.forEach((fn) => fn("close"));
      if (this.refCount > 0) this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    this.reconnectAttempt++;
    // 0.5s, 1s, 2s, 4s ... capped, plus jitter so many clients don't sync up.
    const delay =
      Math.min(500 * 2 ** (this.reconnectAttempt - 1), MAX_BACKOFF_MS) +
      Math.random() * 250;

    useConnectionStore.setState({
      status: "reconnecting",
      stale: false,
      reconnectAttempt: this.reconnectAttempt,
    });
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private startStaleWatch() {
    this.stopStaleWatch();
    this.staleTimer = setInterval(() => {
      const stale = Date.now() - this.lastMessageAt > STALE_AFTER_MS;
      // Only write when the value flips, so subscribers render only then.
      if (stale !== useConnectionStore.getState().stale) {
        useConnectionStore.setState({ stale });
      }
    }, 500);
  }

  private stopStaleWatch() {
    if (this.staleTimer) clearInterval(this.staleTimer);
    this.staleTimer = null;
  }

  private clearReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private shutdown() {
    this.clearReconnect();
    this.stopStaleWatch();
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.reconnectAttempt = 0;
    useConnectionStore.setState({ status: "idle", stale: false, reconnectAttempt: 0 });
  }
}
