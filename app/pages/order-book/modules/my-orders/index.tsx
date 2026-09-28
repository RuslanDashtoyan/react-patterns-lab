/**
 * Server state from TanStack Query. The list is fetched once over REST and
 * then kept live by socket patches (useOrdersSocketSync at page level).
 */
import { useMutation } from "@tanstack/react-query";
import { cancelOrder } from "../../api/orders-api";
import type { OrderStatus } from "../../lib/protocol";
import { useOrders } from "../../hooks/use-orders";
import { useCommitCount } from "../../hooks/use-commit-count";
import { Panel } from "../panel";

const statusStyle: Record<OrderStatus, string> = {
  open: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  partially_filled: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  filled: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  cancelled: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export const MyOrders = () => {
  const renders = useCommitCount();
  const { data, isPending, isFetching, error } = useOrders();
  const cancel = useMutation({ mutationFn: cancelOrder });

  return (
    <Panel
      title="My orders"
      renderRef={renders}
      actions={
        <span className="text-[10px] text-gray-500">
          {isFetching ? "refetching…" : data ? `seq ${data.seq}` : ""}
        </span>
      }
    >
      {isPending && <p className="text-xs text-gray-500">Loading…</p>}
      {error && <p className="text-xs text-red-600">{error.message}</p>}
      {data && data.orders.length === 0 && (
        <p className="text-xs text-gray-500">No orders yet. Place one — fills arrive over the socket.</p>
      )}

      {data && data.orders.length > 0 && (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="text-[11px] text-gray-500">
              <tr>
                <th className="py-1">Market</th>
                <th>Side</th>
                <th className="text-right">Price</th>
                <th className="text-right">Filled / Size</th>
                <th className="text-right">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.orders.map((order) => (
                <tr key={order.id} className="border-t border-gray-100 dark:border-gray-900">
                  <td className="py-1">{order.symbol}</td>
                  <td className={order.side === "buy" ? "text-emerald-600" : "text-red-600"}>{order.side}</td>
                  <td className="text-right">{order.price}</td>
                  <td className="text-right">
                    {order.filled} / {order.size}
                  </td>
                  <td className="text-right">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${statusStyle[order.status]}`}>
                      {order.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="pl-2 text-right">
                    {(order.status === "open" || order.status === "partially_filled") && (
                      <button
                        type="button"
                        disabled={cancel.isPending}
                        onClick={() => cancel.mutate(order.id)}
                        className="text-[11px] text-gray-500 hover:text-red-600"
                      >
                        cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
};
