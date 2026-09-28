/**
 * The only component that subscribes to bids/asks. It re-renders at most
 * once per animation frame (because BookFeed flushes at most once per frame),
 * and memoized rows mean only levels whose values changed re-render.
 *
 * It knows nothing about the socket, sequences, or the order form.
 */
import { memo, type CSSProperties } from "react";
import {
  selectAsks,
  selectBids,
  selectSpread,
  selectStatus,
  useBookStore,
  type BookLevel,
} from "../../store/book-store";
import { useConnectionStore } from "../../store/connection-store";
import { useCommitCount } from "../../hooks/use-commit-count";
import { Panel } from "../panel";

export const OrderBookTable = ({ symbol }: { symbol: string }) => {
  const renders = useCommitCount();
  const bids = useBookStore(selectBids);
  const asks = useBookStore(selectAsks);
  const status = useBookStore(selectStatus);
  const stale = useConnectionStore((s) => s.stale);

  // Max cumulative size, only used to scale the depth bars (visual only).
  const maxTotal = Math.max(
    Number(bids[bids.length - 1]?.total ?? 0),
    Number(asks[asks.length - 1]?.total ?? 0),
  );
  const untrusted = status !== "live" || stale;

  return (
    <Panel title={`Order book · ${symbol}`} renderRef={renders}>
      {/* The bar scale is a CSS variable, so rows don't need maxTotal as a prop
          (otherwise every row would re-render whenever the scale moved). */}
      <div
        className={`relative font-mono text-xs transition-opacity ${untrusted ? "opacity-40" : ""}`}
        style={{ "--max-total": Math.max(maxTotal, 1e-9) } as CSSProperties}
      >
        <div className="grid grid-cols-3 px-2 pb-1 text-[11px] text-gray-500">
          <span>Price</span>
          <span className="text-right">Size</span>
          <span className="text-right">Total</span>
        </div>

        {/* Asks: worst at top, best (lowest) just above the spread */}
        {[...asks].reverse().map((level) => (
          <BookRow key={`a-${level.price}`} side="ask" level={level} />
        ))}

        <SpreadRow />

        {bids.map((level) => (
          <BookRow key={`b-${level.price}`} side="bid" level={level} />
        ))}

        {bids.length === 0 && asks.length === 0 && (
          <p className="py-10 text-center text-gray-500">Waiting for snapshot…</p>
        )}
      </div>
    </Panel>
  );
};

/** Separate subscriber: re-renders only when the spread string changes. */
const SpreadRow = () => {
  const spread = useBookStore(selectSpread);
  return (
    <div className="my-1 border-y border-gray-200 px-2 py-1 text-center text-[11px] text-gray-500 dark:border-gray-800">
      Spread: {spread ?? "—"}
    </div>
  );
};

interface BookRowProps {
  side: "bid" | "ask";
  level: BookLevel;
}

const BookRow = memo(
  ({ side, level }: BookRowProps) => {
    return (
      <div className="relative grid grid-cols-3 px-2 py-px">
        <div
          className={`absolute inset-y-0 right-0 ${side === "bid" ? "bg-emerald-500/10" : "bg-red-500/10"}`}
          style={{
            "--total": Number(level.total), // visual only, never for math
            width: "calc(var(--total) / var(--max-total) * 100%)",
          } as CSSProperties}
        />
        <span className={`relative ${side === "bid" ? "text-emerald-600" : "text-red-600"}`}>
          {level.price}
        </span>
        <span className="relative text-right text-gray-800 dark:text-gray-200">{level.size}</span>
        <span className="relative text-right text-gray-500">{level.total}</span>
      </div>
    );
  },
  // Re-render a row only if its strings changed (key already pins the price).
  (prev, next) =>
    prev.level.size === next.level.size && prev.level.total === next.level.total,
);
