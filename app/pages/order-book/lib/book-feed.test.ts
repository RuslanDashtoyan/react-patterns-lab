/**
 * Tests for BookFeed — no React, no socket. We feed it messages by hand and
 * control "animation frames" ourselves with a fake scheduler, so we can check:
 *   - many deltas → one flush per frame
 *   - wrong-symbol messages are dropped
 *   - a sequence gap triggers a snapshot request and recovers
 *   - deltas that arrive before the snapshot are replayed on top of it
 */
import { BookFeed } from "./book-feed";
import type { BookDeltaMessage, BookSnapshotMessage } from "./protocol";
import type { BookState } from "../store/book-store";

function setup() {
  const frames: (() => void)[] = [];
  const published: BookState[] = [];
  const requestSnapshot = jest.fn();

  const feed = new BookFeed({
    requestSnapshot,
    publish: (state) => published.push(state),
    schedule: (cb) => frames.push(cb),
    cancel: () => {},
  });

  /** Run all pending "animation frames" */
  const nextFrame = () => frames.splice(0).forEach((cb) => cb());
  const last = () => published[published.length - 1];

  return { feed, published, requestSnapshot, nextFrame, last };
}

const snapshot = (seq: number, symbol = "BTC-USD"): BookSnapshotMessage => ({
  channel: "book",
  type: "snapshot",
  symbol,
  seq,
  bids: [
    ["100.00", "1"],
    ["99.00", "2"],
  ],
  asks: [
    ["101.00", "1"],
    ["102.00", "3"],
  ],
});

const delta = (
  seq: number,
  price: string,
  size: string,
  symbol = "BTC-USD",
): BookDeltaMessage => ({
  channel: "book",
  type: "delta",
  symbol,
  seq,
  changes: [{ side: "bid", price, size }],
});

describe("BookFeed", () => {
  it("coalesces many deltas into a single flush per frame", () => {
    const { feed, published, nextFrame, last } = setup();
    feed.setSymbol("BTC-USD");
    feed.handle(snapshot(10));
    nextFrame();
    published.length = 0;

    for (let seq = 11; seq <= 110; seq++) feed.handle(delta(seq, "98.00", String(seq)));
    nextFrame();

    expect(published).toHaveLength(1);
    expect(last().seq).toBe(110);
    expect(last().bids.map((l) => l.price)).toEqual(["100.00", "99.00", "98.00"]);
  });

  it("computes cumulative totals with exact decimal math", () => {
    const { feed, nextFrame, last } = setup();
    feed.setSymbol("BTC-USD");
    feed.handle({ ...snapshot(1), bids: [["100.00", "0.1"], ["99.00", "0.2"]] });
    nextFrame();

    // In floats this would be 0.30000000000000004
    expect(last().bids[1].total).toBe("0.3");
  });

  it("removes a level when size is 0", () => {
    const { feed, nextFrame, last } = setup();
    feed.setSymbol("BTC-USD");
    feed.handle(snapshot(1));
    feed.handle(delta(2, "99.00", "0"));
    nextFrame();

    expect(last().bids.map((l) => l.price)).toEqual(["100.00"]);
  });

  it("drops messages for a symbol we are no longer showing", () => {
    const { feed, nextFrame, last } = setup();
    feed.setSymbol("BTC-USD");
    feed.handle(snapshot(1));
    feed.setSymbol("ETH-USD"); // user switched market
    feed.handle(delta(2, "50.00", "1", "BTC-USD")); // still in flight
    nextFrame();

    expect(feed.counters.droppedWrongSymbol).toBe(1);
    expect(last().symbol).toBe("ETH-USD");
    expect(last().bids).toEqual([]);
    expect(last().status).toBe("loading");
  });

  it("on a sequence gap: stops applying, requests a snapshot, then recovers", () => {
    const { feed, requestSnapshot, nextFrame, last } = setup();
    feed.setSymbol("BTC-USD");
    feed.handle(snapshot(10));
    feed.handle(delta(11, "98.00", "1"));

    feed.handle(delta(13, "97.00", "1")); // 12 is missing!
    nextFrame();

    expect(feed.counters.gapsDetected).toBe(1);
    expect(requestSnapshot).toHaveBeenCalledWith("BTC-USD");
    expect(last().status).toBe("resyncing");

    feed.handle(delta(14, "96.00", "1")); // buffered while resyncing
    feed.handle(snapshot(13)); // includes 12 and 13
    nextFrame();

    expect(last().status).toBe("live");
    expect(last().seq).toBe(14);
    expect(last().bids.map((l) => l.price)).toContain("96.00");
  });

  it("replays deltas received before the first snapshot, skipping old ones", () => {
    const { feed, nextFrame, last } = setup();
    feed.setSymbol("BTC-USD");
    feed.handle(delta(5, "90.00", "1")); // older than snapshot → skipped
    feed.handle(delta(6, "91.00", "1")); // newer → replayed
    feed.handle(snapshot(5));
    nextFrame();

    const prices = last().bids.map((l) => l.price);
    expect(prices).toContain("91.00");
    expect(prices).not.toContain("90.00");
    expect(last().seq).toBe(6);
  });

  it("marks the book disconnected and waits for a new snapshot on reconnect", () => {
    const { feed, nextFrame, last } = setup();
    feed.setSymbol("BTC-USD");
    feed.handle(snapshot(1));
    feed.onDisconnect();
    nextFrame();
    expect(last().status).toBe("disconnected");
    expect(last().bids).toHaveLength(2); // last known book still shown

    feed.onReconnect();
    feed.handle(snapshot(50));
    nextFrame();
    expect(last().status).toBe("live");
    expect(last().seq).toBe(50);
  });
});
