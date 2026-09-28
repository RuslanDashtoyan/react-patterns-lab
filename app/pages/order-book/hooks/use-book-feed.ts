/**
 * Connects BookFeed to the socket for the current symbol.
 * Returns nothing — components read the book from `useBookStore`.
 */
import { useEffect } from "react";
import { bookFeed, marketConnection } from "../lib/instances";
import type { BookMessage } from "../lib/protocol";
import { useStatsStore } from "../store/stats-store";

export function useBookFeed(symbol: string) {
  useEffect(() => {
    bookFeed.setSymbol(symbol);

    const offMessages = marketConnection.on("book", (msg) =>
      bookFeed.handle(msg as BookMessage),
    );
    const offLifecycle = marketConnection.onLifecycle((event) =>
      event === "open" ? bookFeed.onReconnect() : bookFeed.onDisconnect(),
    );
    const unsubscribe = marketConnection.subscribe("book", symbol);

    return () => {
      // Unsubscribing is async on the wire: a few old-symbol deltas will still
      // arrive after this. BookFeed drops them by symbol (see stats panel).
      unsubscribe();
      offMessages();
      offLifecycle();
    };
  }, [symbol]);
}

/** Copies BookFeed's mutable counters into the stats store once a second. */
export function useFeedStats() {
  useEffect(() => {
    let prev = { ...bookFeed.counters };
    const id = setInterval(() => {
      const now = { ...bookFeed.counters };
      useStatsStore.setState({
        messagesPerSec: now.messages - prev.messages,
        flushesPerSec: now.flushes - prev.flushes,
        droppedWrongSymbol: now.droppedWrongSymbol,
        gapsDetected: now.gapsDetected,
        resyncs: now.resyncs,
      });
      prev = now;
    }, 1000);
    return () => clearInterval(id);
  }, []);
}
