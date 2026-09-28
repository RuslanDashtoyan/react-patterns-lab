/** Maps each sentence of the design to the file that implements it. */
const ROWS: [string, string][] = [
  ["One multiplexed WebSocket, snapshot plus deltas", "lib/market-connection.ts, lib/protocol.ts"],
  ["Buffer deltas in a mutable structure outside React", "lib/book-feed.ts (Maps + handle())"],
  ["Flush to an external store once per animation frame", "lib/book-feed.ts (markDirty → requestAnimationFrame → flush)"],
  ["Book data in Zustand with selectors", "store/book-store.ts, modules/order-book-table"],
  ["User orders in TanStack Query patched by socket events", "hooks/use-orders.ts, modules/my-orders"],
  ["The form in local state", "modules/order-form (useState + getState())"],
  ["The market in the URL", "hooks/use-market-param.ts (?market=)"],
  ["Mismatched symbols dropped after a market switch", "lib/book-feed.ts handle() — rule 1"],
  ["Sequence gap triggers a fresh snapshot", "lib/book-feed.ts handleDelta()/resync() — rule 2"],
  ["Prices as decimal strings, never floats", "lib/decimal.ts (big.js)"],
  ["Trading disabled while disconnected or stale", "hooks/use-can-trade.ts, lib/market-connection.ts (stale watch)"],
];

export const HowItWorks = () => (
  <details className="rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-800">
    <summary className="cursor-pointer font-semibold text-gray-900 dark:text-white">
      How it works — where each idea lives in the code
    </summary>
    <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
      All paths are relative to <code>app/pages/order-book/</code>. Full walkthrough in{" "}
      <code>ARCHITECTURE.md</code>. Amber “renders: N” badges show how often each panel re-renders —
      type in the order form and notice the book&apos;s counter doesn&apos;t care.
    </p>
    <table className="mt-3 w-full text-left text-xs">
      <tbody>
        {ROWS.map(([idea, where]) => (
          <tr key={idea} className="border-t border-gray-100 align-top dark:border-gray-900">
            <td className="py-1.5 pr-4 text-gray-800 dark:text-gray-200">{idea}</td>
            <td className="py-1.5 font-mono text-gray-500">{where}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </details>
);
