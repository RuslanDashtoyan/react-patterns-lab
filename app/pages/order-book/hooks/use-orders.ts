/**
 * User orders = SERVER STATE → TanStack Query.
 *
 * 1. useQuery fetches the list over REST (the "snapshot", with its seq).
 * 2. Socket `order_update` events PATCH the cached list with setQueryData —
 *    no refetch, instant UI.
 * 3. Same sequence rule as the book: if an update's seq isn't exactly
 *    cached.seq + 1 we missed something → invalidate (= refetch snapshot).
 * 4. After a reconnect we may have missed updates → invalidate too.
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchOrders, ordersQueryKey, type OrdersSnapshot } from "../api/orders-api";
import { marketConnection } from "../lib/instances";
import type { OrderUpdateMessage } from "../lib/protocol";

export function useOrders() {
  return useQuery({ queryKey: ordersQueryKey, queryFn: fetchOrders });
}

/** Mount once (page level): keeps the orders cache in sync with the socket. */
export function useOrdersSocketSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = marketConnection.subscribe("orders", "*");

    const offMessages = marketConnection.on("orders", (raw) => {
      const msg = raw as OrderUpdateMessage;
      const cached = queryClient.getQueryData<OrdersSnapshot>(ordersQueryKey);

      // Still loading: the REST snapshot will already include this update.
      if (!cached) return;
      // Older than / included in our snapshot: ignore.
      if (msg.seq <= cached.seq) return;
      // Gap: we missed an update. Don't guess — refetch the truth.
      if (msg.seq !== cached.seq + 1) {
        queryClient.invalidateQueries({ queryKey: ordersQueryKey });
        return;
      }

      queryClient.setQueryData<OrdersSnapshot>(ordersQueryKey, {
        seq: msg.seq,
        orders: upsert(cached.orders, msg.order),
      });
    });

    const offLifecycle = marketConnection.onLifecycle((event) => {
      if (event === "open") {
        queryClient.invalidateQueries({ queryKey: ordersQueryKey });
      }
    });

    return () => {
      unsubscribe();
      offMessages();
      offLifecycle();
    };
  }, [queryClient]);
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((x) => x.id === item.id);
  if (index === -1) return [item, ...list];
  const copy = list.slice();
  copy[index] = item;
  return copy;
}
