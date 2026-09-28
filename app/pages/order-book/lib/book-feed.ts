/**
 * BookFeed — the heart of the pattern. Plain TypeScript, NO React.
 *
 *   socket message ──► handle() ──► mutable Maps (outside React)
 *                                        │  markDirty()
 *                                        ▼
 *                      requestAnimationFrame(flush) — at most once per frame
 *                                        │
 *                                        ▼
 *                      useBookStore.setState(top N levels) ──► components
 *
 * So 100 (or 1000) messages per second become at most ~60 store writes, and
 * therefore at most ~60 renders of the book.
 *
 * Correctness rules enforced here:
 *   1. Symbol check  — a message for another symbol (still in flight after a
 *                      market switch) is dropped.
 *   2. Sequence check — deltas must arrive as seq = last + 1. A gap means we
 *                      missed a delta, so our book is silently WRONG. We stop
 *                      applying deltas and request a fresh snapshot.
 *   3. Snapshot buffering — deltas received while waiting for a snapshot are
 *                      queued, then replayed on top of the snapshot (skipping
 *                      the ones the snapshot already includes).
 */
import type {
  BookDeltaMessage,
  BookMessage,
  BookSnapshotMessage,
  LevelChange,
} from "./protocol";
import { add, cmp, isZero } from "./decimal";
import type { BookLevel, BookState, BookStatus } from "../store/book-store";

export interface BookFeedDeps {
  /** Ask the server for a fresh snapshot (over the socket) */
  requestSnapshot: (symbol: string) => void;
  /** Push a new immutable view to the external store */
  publish: (state: BookState) => void;
  /** Frame scheduler — requestAnimationFrame in the browser, fake in tests */
  schedule: (cb: () => void) => number;
  cancel: (id: number) => void;
  /** How many levels per side to publish */
  depth?: number;
  /** Safety cap for queued deltas while waiting for a snapshot */
  maxPending?: number;
}

export interface BookFeedCounters {
  messages: number;
  flushes: number;
  droppedWrongSymbol: number;
  gapsDetected: number;
  resyncs: number;
}

export class BookFeed {
  // ---- mutable state: React never sees these objects directly ----
  private symbol: string | null = null;
  private status: BookStatus = "idle";
  // Typed via annotation (not `new Map<…>()`): the repo's Jest setup runs
  // Babel 7 core, which does not strip generic call arguments.
  private bids: Map<string, string> = new Map(); // price -> size
  private asks: Map<string, string> = new Map();
  private lastSeq = -1;
  private pending: BookDeltaMessage[] = [];

  private dirty = false;
  private frameId: number | null = null;

  /** Read by the stats reporter once per second. Cumulative. */
  readonly counters: BookFeedCounters = {
    messages: 0,
    flushes: 0,
    droppedWrongSymbol: 0,
    gapsDetected: 0,
    resyncs: 0,
  };

  constructor(private readonly deps: BookFeedDeps) {}

  /** Called when the user switches market. Wipes everything. */
  setSymbol(symbol: string) {
    this.symbol = symbol;
    this.bids.clear();
    this.asks.clear();
    this.lastSeq = -1;
    this.pending = [];
    this.setStatus("loading");
  }

  /** Socket dropped: keep the last book on screen but flag it. */
  onDisconnect() {
    if (!this.symbol) return;
    this.pending = [];
    this.setStatus("disconnected");
  }

  /**
   * Socket (re)opened. The connection re-sends our subscription and the
   * server replies with a snapshot, so we just wait for it. Deltas we might
   * have missed while offline don't matter: the snapshot replaces everything.
   */
  onReconnect() {
    if (!this.symbol) return;
    this.lastSeq = -1;
    this.pending = [];
    this.setStatus("loading");
  }

  handle(msg: BookMessage) {
    this.counters.messages++;

    // Rule 1: drop messages for a symbol we're no longer showing.
    if (msg.symbol !== this.symbol) {
      this.counters.droppedWrongSymbol++;
      return;
    }

    if (msg.type === "snapshot") this.applySnapshot(msg);
    else this.handleDelta(msg);
  }

  destroy() {
    if (this.frameId !== null) this.deps.cancel(this.frameId);
    this.frameId = null;
  }

  // ---------------------------------------------------------------------

  private handleDelta(msg: BookDeltaMessage) {
    // No trustworthy base yet: queue it, it will be replayed after the snapshot.
    if (this.status !== "live") {
      if (this.status === "loading" || this.status === "resyncing") {
        this.pending.push(msg);
        if (this.pending.length > (this.deps.maxPending ?? 10_000)) {
          this.pending.shift();
        }
      }
      return;
    }

    // Already applied (duplicate / older) — ignore.
    if (msg.seq <= this.lastSeq) return;

    // Rule 2: a gap. We missed at least one delta => book is wrong.
    if (msg.seq !== this.lastSeq + 1) {
      this.counters.gapsDetected++;
      this.resync(msg);
      return;
    }

    this.applyChanges(msg.changes);
    this.lastSeq = msg.seq;
    this.markDirty();
  }

  private applySnapshot(msg: BookSnapshotMessage) {
    this.bids = new Map(msg.bids);
    this.asks = new Map(msg.asks);
    this.lastSeq = msg.seq;

    // Rule 3: replay queued deltas that are newer than the snapshot.
    const queued = this.pending.sort((a, b) => a.seq - b.seq);
    this.pending = [];
    this.status = "live";

    for (const delta of queued) {
      if (delta.seq <= this.lastSeq) continue; // already inside the snapshot
      if (delta.seq !== this.lastSeq + 1) {
        this.counters.gapsDetected++;
        this.resync(delta);
        return;
      }
      this.applyChanges(delta.changes);
      this.lastSeq = delta.seq;
    }

    this.markDirty();
  }

  private resync(triggeringDelta: BookDeltaMessage) {
    if (!this.symbol) return;
    this.counters.resyncs++;
    // Keep the delta that revealed the gap: it may be newer than the snapshot.
    this.pending = [triggeringDelta];
    this.setStatus("resyncing");
    this.deps.requestSnapshot(this.symbol);
  }

  private applyChanges(changes: LevelChange[]) {
    for (const { side, price, size } of changes) {
      const levels = side === "bid" ? this.bids : this.asks;
      if (isZero(size)) levels.delete(price);
      else levels.set(price, size);
    }
  }

  private setStatus(status: BookStatus) {
    this.status = status;
    this.markDirty();
  }

  private markDirty() {
    this.dirty = true;
    if (this.frameId === null) {
      this.frameId = this.deps.schedule(this.flush);
    }
  }

  /** Runs at most once per animation frame. Arrow fn = stable `this`. */
  private flush = () => {
    this.frameId = null;
    if (!this.dirty) return;
    this.dirty = false;
    this.counters.flushes++;

    const depth = this.deps.depth ?? 15;
    this.deps.publish({
      symbol: this.symbol,
      status: this.status,
      bids: topLevels(this.bids, depth, "desc"),
      asks: topLevels(this.asks, depth, "asc"),
      seq: this.lastSeq,
      updatedAt: Date.now(),
    });
  };
}

/** Sort, take the best `depth` levels and add a running total. */
function topLevels(
  levels: Map<string, string>,
  depth: number,
  order: "asc" | "desc",
): BookLevel[] {
  const prices = [...levels.keys()].sort((a, b) =>
    order === "asc" ? cmp(a, b) : cmp(b, a),
  );

  let running = "0";
  return prices.slice(0, depth).map((price) => {
    const size = levels.get(price)!;
    running = add(running, size);
    return { price, size, total: running };
  });
}
