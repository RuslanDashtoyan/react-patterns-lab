# Real-time Order Book — Architecture

Route: `/order-book` (e.g. `/order-book?market=ETH-USD`)

> One multiplexed WebSocket, snapshot plus deltas. Deltas are buffered in a
> mutable structure outside React and flushed to an external store once per
> animation frame, so 100 messages a second becomes at most 60 renders.

## Folder map

```
order-book/
├── index.tsx                  Page: QueryClientProvider + layout + wiring hooks
├── lib/                       Plain TypeScript, no React
│   ├── protocol.ts            Message types (server ⇄ client), SocketLike
│   ├── decimal.ts             Decimal-string math (big.js), never floats
│   ├── markets.ts             Symbols, tick size, size step
│   ├── market-connection.ts   THE socket: reconnect, re-subscribe, routing, stale watch
│   ├── book-feed.ts           Mutable book + seq/symbol checks + rAF flush
│   ├── book-feed.test.ts      Unit tests for the rules above
│   ├── mock-exchange.ts       Fake exchange server in the browser (demo only)
│   └── instances.ts           Singletons: marketConnection, bookFeed
├── store/                     Zustand stores
│   ├── book-store.ts          bids/asks/status + selectors
│   ├── connection-store.ts    open / reconnecting / stale
│   └── stats-store.ts         1×/sec counters for the stats panel
├── api/orders-api.ts          "REST" for orders (mock-backed)
├── hooks/
│   ├── use-market-param.ts    market ⇄ URL
│   ├── use-market-connection.ts  keep the socket open while mounted
│   ├── use-book-feed.ts       socket "book" channel → BookFeed
│   ├── use-orders.ts          TanStack Query + socket patches
│   ├── use-can-trade.ts       connected && !stale && book live
│   └── use-commit-count.ts    render counter badges (learning aid)
└── modules/                   UI pieces (one folder each)
```

## Data flow

```
                         ┌──────────── one WebSocket ────────────┐
                         │  channel "book"   channel "orders"    │
                         └──────┬───────────────────┬────────────┘
                                │                   │
                     MarketConnection.on("book")  on("orders")
                                │                   │
                                ▼                   ▼
   BookFeed.handle(msg)                      useOrdersSocketSync
    1. symbol check → drop if old market      seq check → setQueryData(patch)
    2. seq check → gap? request snapshot                  or invalidate (refetch)
    3. apply to mutable Maps                              │
    4. markDirty() → requestAnimationFrame                ▼
                │                               TanStack Query cache ["orders"]
                ▼  (≤ 1× per frame)                       │
   useBookStore.setState(top 15 levels)                   ▼
                │                                    <MyOrders/>
                ▼
   <OrderBookTable/>  (selectors: bids, asks, status)
   <SpreadRow/>       (selector returns a string → renders only when it changes)
```

## Where each kind of state lives, and why

| State          | Lives in          | Why                                                                                       |
| -------------- | ----------------- | ----------------------------------------------------------------------------------------- |
| Selected market| URL `?market=`    | Shareable link, refresh-safe, back/forward work. Not duplicated anywhere.                 |
| Order book     | Zustand           | High-frequency, written from outside React. Selectors limit who re-renders.              |
| User orders    | TanStack Query    | Server state: fetch, cache, loading/error. Socket events patch it in place.               |
| Order form     | `useState`        | Only the form cares. Typing re-renders only the form.                                     |
| Connection     | Zustand           | Changes rarely (open/closed/stale). `lastMessageAt` is kept OUT of state on purpose.     |

**Isolation check:** the amber `renders: N` badges on each panel. Type into the
order form: its counter goes up, the book's counter doesn't move because of
typing. The page counter only moves when you switch market.

## Correctness rules

1. **Symbol check.** After switching BTC → ETH, messages for BTC are still on
   the wire (unsubscribing takes a round trip). Every message has `symbol`;
   `BookFeed` drops anything that isn't the current symbol. See
   "Dropped (wrong symbol)" go up when you switch markets.
2. **Sequence check.** Every delta has `seq`, which must equal `lastSeq + 1`.
   A gap means we missed a delta, so our prices are silently wrong. `BookFeed`
   stops applying, sets status `resyncing` (trading disabled) and asks for a
   fresh snapshot. Deltas that arrive meanwhile are queued and replayed on top
   of the snapshot, skipping those with `seq <= snapshot.seq`.
3. **Orders use the same idea.** The REST list returns `{ seq, orders }`. A
   socket update with `seq === cached.seq + 1` is patched in; a gap triggers
   `invalidateQueries` (a refetch acts as the snapshot).
4. **Decimal strings.** Prices and sizes are strings end to end. Math (totals,
   spread, tick validation) uses big.js. `Number()` appears only for CSS
   widths of the depth bars.
5. **Trading disabled** unless the socket is open, a message arrived in the last
   3s (the server sends a heartbeat every 1s), and the book is `live`.

## Try it (Simulator panel)

| Button                   | What you should see                                                  |
| ------------------------ | -------------------------------------------------------------------- |
| Rate 1000/s              | Messages/s ≈ 1000, book renders/s stays ≤ ~60                        |
| Lose one delta           | Gaps +1, Resyncs +1, badge briefly "Resyncing", then Live            |
| Send wrong-symbol message| Dropped +1, book unaffected                                          |
| Stall feed 5s            | After 3s: badge "Stale", Buy/Sell disabled, then recovers            |
| Drop connection          | "Reconnecting (attempt n)" with backoff → re-subscribe → fresh snapshot |

## Using a real backend

Set `VITE_MARKET_WS_URL=wss://…` (it must speak `lib/protocol.ts`) and replace
the bodies in `api/orders-api.ts` with `fetch` calls. Nothing else changes:
`MarketConnection` only depends on the `SocketLike` interface. The Simulator
panel hides itself when not in mock mode.

## Dependencies added

- `zustand`: external store with selectors
- `@tanstack/react-query` (+ `-devtools`): server state for orders
- `big.js` (+ `@types/big.js`): exact decimal arithmetic
