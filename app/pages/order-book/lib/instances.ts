/**
 * Wiring: the single connection + single book feed for the page.
 *
 * Module-level singletons are safe with SSR here because constructing them
 * touches no browser API — the socket is only opened by `acquire()` inside a
 * useEffect, and requestAnimationFrame is only called after a message arrives.
 *
 * To use a REAL backend, set VITE_MARKET_WS_URL (it must speak protocol.ts).
 * Otherwise the in-browser MockExchange is used.
 */
import { BookFeed } from "./book-feed";
import { MarketConnection } from "./market-connection";
import { mockExchange } from "./mock-exchange";
import type { SocketLike } from "./protocol";
import { useBookStore } from "../store/book-store";

const WS_URL = import.meta.env.VITE_MARKET_WS_URL as string | undefined;

export const isMockMode = !WS_URL;

export const marketConnection = new MarketConnection(() =>
  WS_URL
    ? (new WebSocket(WS_URL) as unknown as SocketLike)
    : mockExchange.createSocket(),
);

export const bookFeed = new BookFeed({
  requestSnapshot: (symbol) =>
    marketConnection.send({ op: "snapshot", channel: "book", symbol }),
  publish: (state) => useBookStore.setState(state),
  schedule: (cb) => requestAnimationFrame(cb),
  cancel: (id) => cancelAnimationFrame(id),
  depth: 15,
});
