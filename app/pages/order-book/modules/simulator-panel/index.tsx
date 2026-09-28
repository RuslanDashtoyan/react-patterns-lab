/**
 * Break things on purpose and watch the system recover.
 * Buttons call the in-browser MockExchange (the fake "server").
 */
import { useState } from "react";
import { mockExchange } from "../../lib/mock-exchange";
import { isMockMode } from "../../lib/instances";
import { useStatsStore } from "../../store/stats-store";
import { selectSeq, useBookStore } from "../../store/book-store";
import { useCommitCount } from "../../hooks/use-commit-count";
import { Panel } from "../panel";

const RATES = [10, 100, 500, 1000];

export const SimulatorPanel = ({ symbol }: { symbol: string }) => {
  const renders = useCommitCount();
  const [rate, setRate] = useState(mockExchange.rate);

  const changeRate = (next: number) => {
    mockExchange.rate = next;
    setRate(next);
  };

  if (!isMockMode) return null;

  const buttonClass =
    "rounded-lg border border-gray-300 px-3 py-2 text-left text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900";

  return (
    <Panel title="Simulator & live stats" renderRef={renders}>
      <Stats />

      <div className="mt-4 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>Server delta rate (per market)</span>
          <div className="flex gap-1">
            {RATES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => changeRate(r)}
                className={`rounded px-2 py-0.5 font-mono ${
                  r === rate ? "bg-gray-900 text-white dark:bg-white dark:text-gray-950" : "bg-gray-100 dark:bg-gray-900"
                }`}
              >
                {r}/s
              </button>
            ))}
          </div>
        </div>

        <button type="button" className={buttonClass} onClick={() => mockExchange.loseNextDelta(symbol)}>
          <b>Lose one delta</b> — next seq arrives with a gap → book goes “resyncing”, requests a snapshot, recovers.
        </button>
        <button type="button" className={buttonClass} onClick={() => mockExchange.sendForeignSymbolDelta()}>
          <b>Send wrong-symbol message</b> — dropped by the symbol check (see counter).
        </button>
        <button type="button" className={buttonClass} onClick={() => mockExchange.stall(5000)}>
          <b>Stall feed 5s</b> — socket stays open but silent → “stale” after 3s, trading disabled.
        </button>
        <button type="button" className={buttonClass} onClick={() => mockExchange.dropConnections(3000)}>
          <b>Drop connection (server down 3s)</b> — reconnects with backoff, re-subscribes, fresh snapshot.
        </button>
      </div>
    </Panel>
  );
};

/** Updates once per second (the stats store is written once per second). */
const Stats = () => {
  const stats = useStatsStore();
  const seq = useBookStore(selectSeq);

  const items: [string, string | number, string?][] = [
    ["Messages in / s", stats.messagesPerSec],
    ["Book renders / s", stats.flushesPerSec, "≤ ~60, capped by requestAnimationFrame"],
    ["Book seq", seq],
    ["Dropped (wrong symbol)", stats.droppedWrongSymbol],
    ["Gaps detected", stats.gapsDetected],
    ["Snapshot resyncs", stats.resyncs],
  ];

  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map(([label, value, hint]) => (
        <div key={label} title={hint} className="rounded-lg bg-gray-50 p-2 dark:bg-gray-900">
          <dt className="text-[10px] uppercase tracking-wide text-gray-500">{label}</dt>
          <dd className="font-mono text-lg text-gray-900 dark:text-white">{value}</dd>
        </div>
      ))}
    </dl>
  );
};
