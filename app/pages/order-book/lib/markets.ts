/**
 * Static market config. In a real app this comes from a REST "instruments"
 * endpoint. Tick/step are decimal STRINGS on purpose — see lib/decimal.ts.
 */
export interface MarketConfig {
  symbol: string;
  /** Minimum price increment, e.g. "0.01" */
  tick: string;
  /** Minimum size increment, e.g. "0.0001" */
  sizeStep: string;
  /** Mock exchange starting mid price */
  startMid: string;
}

export const MARKETS: Record<string, MarketConfig> = {
  "BTC-USD": { symbol: "BTC-USD", tick: "0.01", sizeStep: "0.0001", startMid: "65000.00" },
  "ETH-USD": { symbol: "ETH-USD", tick: "0.01", sizeStep: "0.001", startMid: "3200.00" },
  "SOL-USD": { symbol: "SOL-USD", tick: "0.001", sizeStep: "0.01", startMid: "150.000" },
};

export const MARKET_SYMBOLS = Object.keys(MARKETS);
export const DEFAULT_MARKET = "BTC-USD";

export const isKnownMarket = (symbol: string | null): symbol is string =>
  !!symbol && symbol in MARKETS;
