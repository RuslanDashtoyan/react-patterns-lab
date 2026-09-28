import { useEffect } from "react";
import { marketConnection } from "../lib/instances";

/** Keeps the shared socket open while the calling component is mounted. */
export function useMarketConnection() {
  useEffect(() => {
    marketConnection.acquire();
    return () => marketConnection.release();
  }, []);
}
