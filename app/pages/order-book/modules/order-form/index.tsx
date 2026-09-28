/**
 * The order form keeps its inputs in LOCAL useState.
 *
 * Typing re-renders only this component. The book never re-renders because
 * of typing, and this form never re-renders because of book ticks:
 *  - it doesn't select bids/asks from the store
 *  - "Use best price" reads the store IMPERATIVELY with getState(), which
 *    does not subscribe
 *  - `useCanTrade` selects rarely-changing flags only
 *
 * The parent renders it with key={symbol}, so switching market resets it.
 */
import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { placeOrder } from "../../api/orders-api";
import { MARKETS } from "../../lib/markets";
import { decimalsOf, isDecimalString, isMultipleOf, isZero, mul, toFixed } from "../../lib/decimal";
import type { OrderSide } from "../../lib/protocol";
import { useBookStore } from "../../store/book-store";
import { useCanTrade } from "../../hooks/use-can-trade";
import { useCommitCount } from "../../hooks/use-commit-count";
import { Panel } from "../panel";

export const OrderForm = ({ symbol }: { symbol: string }) => {
  const renders = useCommitCount();
  const { tick, sizeStep } = MARKETS[symbol];

  const [side, setSide] = useState<OrderSide>("buy");
  const [price, setPrice] = useState("");
  const [size, setSize] = useState("");

  const { canTrade, reason } = useCanTrade();

  const mutation = useMutation({
    mutationFn: placeOrder,
    // No cache update here on purpose: the socket's order_update event is the
    // single source of truth and patches the orders list (see use-orders.ts).
    onSuccess: () => setSize(""),
  });

  const priceError = validate(price, tick, "Price");
  const sizeError = validate(size, sizeStep, "Size");
  const total =
    !priceError && !sizeError ? toFixed(mul(price, size), decimalsOf(tick)) : null;

  const fillBestPrice = () => {
    // getState() = read once, no subscription, no re-renders on ticks.
    const { bids, asks } = useBookStore.getState();
    const best = side === "buy" ? asks[0]?.price : bids[0]?.price;
    if (best) setPrice(best);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canTrade || priceError || sizeError) return;
    mutation.mutate({ symbol, side, price, size });
  };

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-gray-900 dark:border-gray-700 dark:focus:border-white";

  return (
    <Panel title={`Place order · ${symbol}`} renderRef={renders}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-900">
          {(["buy", "sell"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={`rounded-md py-1.5 text-sm font-semibold capitalize ${
                side === s
                  ? s === "buy"
                    ? "bg-emerald-600 text-white"
                    : "bg-red-600 text-white"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
          <span className="flex justify-between">
            Price (tick {tick})
            <button type="button" onClick={fillBestPrice} className="text-sky-600 hover:underline">
              Use best {side === "buy" ? "ask" : "bid"}
            </button>
          </span>
          {/* type="text" + inputMode: keep the exact string, no float coercion */}
          <input
            className={inputClass}
            inputMode="decimal"
            placeholder="0.00"
            value={price}
            onChange={(e) => setPrice(e.target.value.trim())}
          />
          {price && priceError && <span className="text-red-600">{priceError}</span>}
        </label>

        <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
          Size (step {sizeStep})
          <input
            className={inputClass}
            inputMode="decimal"
            placeholder="0"
            value={size}
            onChange={(e) => setSize(e.target.value.trim())}
          />
          {size && sizeError && <span className="text-red-600">{sizeError}</span>}
        </label>

        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>Total</span>
          <span className="font-mono">{total ?? "—"}</span>
        </div>

        <button
          type="submit"
          disabled={!canTrade || !!priceError || !!sizeError || mutation.isPending}
          className={`rounded-lg py-2 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40 ${
            side === "buy" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {mutation.isPending ? "Placing…" : `${side === "buy" ? "Buy" : "Sell"} ${symbol}`}
        </button>

        {!canTrade && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            Trading disabled: {reason}
          </p>
        )}
        {mutation.isError && <p className="text-xs text-red-600">{mutation.error.message}</p>}
      </form>
    </Panel>
  );
};

function validate(value: string, step: string, label: string): string | null {
  if (!value) return `${label} is required`;
  if (!isDecimalString(value)) return `${label} must be a plain decimal like 12.34`;
  if (isZero(value)) return `${label} must be greater than 0`;
  if (!isMultipleOf(value, step)) return `${label} must be a multiple of ${step}`;
  return null;
}
