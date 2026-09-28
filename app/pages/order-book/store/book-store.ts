/**
 * Zustand store for the ORDER BOOK — the high-frequency data.
 *
 * Only `BookFeed` writes here, and at most once per animation frame.
 * Components read with SELECTORS, so a component re-renders only when the
 * slice it selected actually changes (compared with Object.is):
 *
 *   const bids = useBookStore(selectBids);        // new array each flush
 *   const status = useBookStore(selectStatus);    // string, rarely changes
 *   const spread = useBookStore(selectSpread);    // string, changes only when spread does
 */
import { create } from "zustand";
import { sub } from "../lib/decimal";

export type BookStatus =
  | "idle" // nothing subscribed yet
  | "loading" // subscribed, waiting for the first snapshot
  | "live" // snapshot + contiguous deltas: data is trustworthy
  | "resyncing" // sequence gap detected, waiting for a fresh snapshot
  | "disconnected"; // socket down: data is frozen / may be stale

export interface BookLevel {
  price: string;
  size: string;
  /** Cumulative size from the top of book down to this level */
  total: string;
}

export interface BookState {
  symbol: string | null;
  status: BookStatus;
  bids: BookLevel[]; // best (highest) first
  asks: BookLevel[]; // best (lowest) first
  seq: number;
  updatedAt: number;
}

export const initialBookState: BookState = {
  symbol: null,
  status: "idle",
  bids: [],
  asks: [],
  seq: -1,
  updatedAt: 0,
};

export const useBookStore = create<BookState>(() => initialBookState);

// ---------- selectors ----------
// Keep them outside components so they are stable references.

export const selectBids = (s: BookState) => s.bids;
export const selectAsks = (s: BookState) => s.asks;
export const selectStatus = (s: BookState) => s.status;
export const selectSymbol = (s: BookState) => s.symbol;
export const selectSeq = (s: BookState) => s.seq;
export const selectBestBid = (s: BookState) => s.bids[0]?.price ?? null;
export const selectBestAsk = (s: BookState) => s.asks[0]?.price ?? null;

/** Returns a primitive string, so subscribers re-render only when it changes */
export const selectSpread = (s: BookState) => {
  const bid = s.bids[0]?.price;
  const ask = s.asks[0]?.price;
  return bid && ask ? sub(ask, bid) : null;
};
