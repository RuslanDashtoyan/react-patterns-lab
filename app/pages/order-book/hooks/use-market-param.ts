/**
 * The selected market lives in the URL (?market=ETH-USD):
 * shareable, survives refresh, back/forward buttons work, and it's not
 * duplicated in any store.
 */
import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { DEFAULT_MARKET, isKnownMarket } from "../lib/markets";

export function useMarketParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("market");
  const market = isKnownMarket(raw) ? raw : DEFAULT_MARKET;

  const setMarket = useCallback(
    (next: string) =>
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.set("market", next);
        return params;
      }),
    [setSearchParams],
  );

  return [market, setMarket] as const;
}
