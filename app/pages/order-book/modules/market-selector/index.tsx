import { MARKET_SYMBOLS } from "../../lib/markets";
import { useCommitCount } from "../../hooks/use-commit-count";

interface MarketSelectorProps {
  market: string;
  onChange: (market: string) => void;
}

/** Writes to the URL (via onChange) — the URL is the source of truth. */
export const MarketSelector = ({ market, onChange }: MarketSelectorProps) => {
  const renders = useCommitCount();

  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-full bg-gray-100 p-1 dark:bg-gray-900">
        {MARKET_SYMBOLS.map((symbol) => (
          <button
            key={symbol}
            type="button"
            onClick={() => onChange(symbol)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              symbol === market
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-950"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            {symbol}
          </button>
        ))}
      </div>
      <span ref={renders} className="font-mono text-[10px] text-amber-700 dark:text-amber-300" />
    </div>
  );
};
