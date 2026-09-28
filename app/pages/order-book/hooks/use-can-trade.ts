/**
 * Trading is only allowed when we TRUST the prices on screen:
 * socket open, feed not stale, and the book is live (snapshot + contiguous
 * deltas — not loading, not resyncing after a gap).
 *
 * Each selector returns a primitive, so this re-renders only when one of
 * those flags flips — never on ordinary book updates.
 */
import { useConnectionStore } from "../store/connection-store";
import { selectStatus, useBookStore } from "../store/book-store";

export function useCanTrade(): { canTrade: boolean; reason: string | null } {
  const connection = useConnectionStore((s) => s.status);
  const stale = useConnectionStore((s) => s.stale);
  const bookStatus = useBookStore(selectStatus);

  if (connection !== "open") return { canTrade: false, reason: "Disconnected" };
  if (stale) return { canTrade: false, reason: "Feed is stale (no data received)" };
  if (bookStatus === "resyncing") return { canTrade: false, reason: "Resyncing order book" };
  if (bookStatus !== "live") return { canTrade: false, reason: "Loading order book" };
  return { canTrade: true, reason: null };
}
