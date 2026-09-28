/**
 * Real-time order book page.
 *
 * State lives in four separate places, each chosen for its update pattern:
 *   market  → URL                 (useMarketParam)
 *   book    → Zustand             (BookFeed writes ≤ 1x/frame, selectors read)
 *   orders  → TanStack Query      (REST snapshot + socket patches)
 *   form    → local useState      (OrderForm)
 *
 * This component itself only depends on the market, so it re-renders on a
 * market switch — not on price ticks, not on typing.
 */
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useMarketParam } from "./hooks/use-market-param";
import { useMarketConnection } from "./hooks/use-market-connection";
import { useBookFeed, useFeedStats } from "./hooks/use-book-feed";
import { useOrdersSocketSync } from "./hooks/use-orders";
import { useCommitCount } from "./hooks/use-commit-count";
import { MarketSelector } from "./modules/market-selector";
import { ConnectionBadge } from "./modules/connection-badge";
import { OrderBookTable } from "./modules/order-book-table";
import { OrderForm } from "./modules/order-form";
import { MyOrders } from "./modules/my-orders";
import { SimulatorPanel } from "./modules/simulator-panel";
import { HowItWorks } from "./modules/how-it-works";

export const OrderBookPage = () => {
  // One QueryClient per page instance (useState keeps it stable across renders).
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <OrderBookScreen />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
};

const OrderBookScreen = () => {
  const renders = useCommitCount();
  const [market, setMarket] = useMarketParam();

  // Order matters only for readability: effects are independent.
  useMarketConnection(); // open the one socket
  useBookFeed(market); // book channel → BookFeed → Zustand
  useOrdersSocketSync(); // orders channel → TanStack Query cache
  useFeedStats(); // counters → stats panel, 1x/sec

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Order Book</h1>
          <ConnectionBadge />
          <span ref={renders} className="font-mono text-[10px] text-amber-700 dark:text-amber-300" />
        </div>
        <MarketSelector market={market} onChange={setMarket} />
      </header>

      <HowItWorks />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <OrderBookTable symbol={market} />

        <div className="flex flex-col gap-4">
          {/* key={market}: switching market remounts the form = fresh local state */}
          <OrderForm key={market} symbol={market} />
          <MyOrders />
          <SimulatorPanel symbol={market} />
        </div>
      </div>
    </main>
  );
};
