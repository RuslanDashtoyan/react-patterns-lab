/**
 * Price / size math on DECIMAL STRINGS — never JS floats.
 *
 * Why: 0.1 + 0.2 === 0.30000000000000004 in floating point. On an exchange
 * that is a wrong price. So prices travel over the wire as strings
 * ("65000.12"), live in state as strings, and any arithmetic goes through
 * big.js, which does exact base-10 math.
 *
 * The only place we ever call Number() on a size is for a CSS width (depth
 * bars) — purely visual, never money.
 */
import Big from "big.js";

// `Big()` with no args returns an independent constructor, so this config
// doesn't leak into other code using big.js.
const Dec = Big();
Dec.DP = 20; // decimal places for division
Dec.NE = -30; // never switch to exponential notation in toString()
Dec.PE = 40;

type DecimalInput = string | Big;

const DECIMAL_RE = /^\d+(\.\d+)?$/;

/** "12.5" -> true, "12." / "1e5" / "-1" / "" -> false */
export const isDecimalString = (value: string) => DECIMAL_RE.test(value);

export const add = (a: DecimalInput, b: DecimalInput) => Dec(a).plus(b).toString();
export const sub = (a: DecimalInput, b: DecimalInput) => Dec(a).minus(b).toString();
export const mul = (a: DecimalInput, b: DecimalInput) => Dec(a).times(b).toString();

/** Compare: -1 | 0 | 1 */
export const cmp = (a: DecimalInput, b: DecimalInput) => Dec(a).cmp(b);

export const isZero = (value: DecimalInput) => Dec(value).eq(0);

/** Number of decimals in a step, e.g. "0.001" -> 3 */
export const decimalsOf = (step: string) => (step.split(".")[1] ?? "").length;

/** Format with exactly `dp` decimals: toFixed("1.5", 2) -> "1.50" */
export const toFixed = (value: DecimalInput, dp: number) => Dec(value).toFixed(dp);

/** Is `value` an exact multiple of `step`? ("65000.12", "0.01") -> true */
export const isMultipleOf = (value: DecimalInput, step: DecimalInput) =>
  Dec(value).mod(step).eq(0);

/** price ± steps * tick, formatted to the tick's precision */
export const offsetByTicks = (price: string, tick: string, steps: number) =>
  Dec(price).plus(Dec(tick).times(steps)).toFixed(decimalsOf(tick));
