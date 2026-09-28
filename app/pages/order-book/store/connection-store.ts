/**
 * Connection health. Written by MarketConnection, read by the status badge
 * and by `useCanTrade`. Changes rarely (open/close/stale), so it's cheap.
 *
 * Note: we deliberately do NOT put `lastMessageAt` here — it changes 100x a
 * second and would re-render every subscriber. It lives as a plain mutable
 * field inside MarketConnection; only the derived boolean `stale` is stored.
 */
import { create } from "zustand";

export type ConnectionStatus = "idle" | "connecting" | "open" | "reconnecting";

interface ConnectionState {
  status: ConnectionStatus;
  /** Socket is open but no message (not even a heartbeat) for STALE_AFTER_MS */
  stale: boolean;
  reconnectAttempt: number;
}

export const useConnectionStore = create<ConnectionState>(() => ({
  status: "idle",
  stale: false,
  reconnectAttempt: 0,
}));
