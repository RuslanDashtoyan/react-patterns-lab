/**
 * "REST" API for the user's orders. Backed by the mock exchange with fake
 * latency; swap these bodies for fetch() calls against a real backend.
 *
 * The list response includes `seq` — the order-stream sequence number the
 * snapshot is consistent with — so socket patches can be ordered against it.
 */
import { mockExchange } from "../lib/mock-exchange";
import type { Order, OrderSide } from "../lib/protocol";

export interface OrdersSnapshot {
  seq: number;
  orders: Order[];
}

export interface PlaceOrderInput {
  symbol: string;
  side: OrderSide;
  price: string;
  size: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const ordersQueryKey = ["orders"] as const;

export async function fetchOrders(): Promise<OrdersSnapshot> {
  await delay(300);
  return mockExchange.getOrders();
}

export async function placeOrder(input: PlaceOrderInput): Promise<Order> {
  await delay(200);
  return mockExchange.placeOrder(input);
}

export async function cancelOrder(id: string): Promise<Order> {
  await delay(150);
  return mockExchange.cancelOrder(id);
}
