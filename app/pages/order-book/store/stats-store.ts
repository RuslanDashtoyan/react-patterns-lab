/**
 * Once-per-second counters for the "Live stats" panel, so you can SEE that
 * 100+ messages/sec turn into <= 60 book renders/sec.
 */
import { create } from "zustand";

export interface FeedStats {
  messagesPerSec: number;
  flushesPerSec: number;
  droppedWrongSymbol: number;
  gapsDetected: number;
  resyncs: number;
}

export const useStatsStore = create<FeedStats>(() => ({
  messagesPerSec: 0,
  flushesPerSec: 0,
  droppedWrongSymbol: 0,
  gapsDetected: 0,
  resyncs: 0,
}));
