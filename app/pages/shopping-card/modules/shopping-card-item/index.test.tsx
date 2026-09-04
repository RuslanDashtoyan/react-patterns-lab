/**
 * Tests for <ShoppingCardItem />.
 *
 * WHY THIS COMPONENT IS TRICKY TO TEST:
 * Clicking "+" / "-" updates the number on screen INSTANTLY (it's local
 * `useState`), but the parent only finds out about the new value 1000ms
 * later, via the `useDebounce` hook. So there are really two things to
 * verify separately:
 *   1) the UI updates right away (no waiting)
 *   2) `handleQuantityChange` (the prop) fires exactly once, ~1000ms
 *      after the user stops clicking
 *
 * To test #2 without actually pausing the test for a real second, we use
 * Jest's "fake timers". They swap out `setTimeout` for a version we can
 * fast-forward by calling `jest.advanceTimersByTime(ms)` — time passes
 * instantly from the test's point of view.
 */

import { render, screen, fireEvent, act } from "@testing-library/react";
import { ShoppingCardItem } from "./index";

// Props every test starts from. Individual tests spread this and override
// only the fields they care about, so each test stays short and focused.
const baseProps = {
  id: "item-1",
  name: "Bananas",
  price: 3,
  quantity: 5,
  selectedQuantity: 0,
};

describe("ShoppingCardItem", () => {
  // Turn on fake timers before every test in this file...
  beforeEach(() => {
    jest.useFakeTimers();
  });

  // ...and turn them back off afterwards, so fake-timer state never leaks
  // into a different test file.
  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders the item's name, price and remaining stock", () => {
    render(<ShoppingCardItem {...baseProps} />);

    // `render` mounts the component into a hidden in-memory DOM (jsdom).
    // `screen.getByText` throws (failing the test) if the text isn't found,
    // so just calling it is already an assertion that the text exists.
    expect(screen.getByText("Bananas")).toBeInTheDocument();
    expect(screen.getByText("Price: 3$")).toBeInTheDocument();

    // "remaining stock" shown = quantity(5) - selectedQuantity(0) = 5
    expect(screen.getByText("Quantity: 5")).toBeInTheDocument();
  });

  it("updates the on-screen count immediately when '+' is clicked", () => {
    render(<ShoppingCardItem {...baseProps} />);

    // `getByRole("button", { name: "+" })` finds the <button> whose visible
    // text is "+". Using getByRole is preferred over getByText for
    // interactive elements because it also confirms it's a real button
    // (i.e. accessible/clickable), not just some text on the page.
    fireEvent.click(screen.getByRole("button", { name: "+" }));

    // No timers were advanced here — this proves the count on screen
    // changes right away, independent of the 1000ms debounce.
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("does not let the count go below 0", () => {
    render(<ShoppingCardItem {...baseProps} selectedQuantity={0} />);

    const minusButton = screen.getByRole("button", { name: "-" });
    fireEvent.click(minusButton); // already at 0, should stay at 0
    fireEvent.click(minusButton);

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("does not let the count exceed the available quantity", () => {
    render(<ShoppingCardItem {...baseProps} quantity={2} />);

    const plusButton = screen.getByRole("button", { name: "+" });
    fireEvent.click(plusButton); // 0 -> 1
    fireEvent.click(plusButton); // 1 -> 2
    fireEvent.click(plusButton); // 2 -> would be 3, but max is 2, so ignored

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Quantity: 0")).toBeInTheDocument(); // 2 - 2 left
  });

  it("does NOT call handleQuantityChange just from mounting", () => {
    const handleQuantityChange = jest.fn();
    render(
      <ShoppingCardItem
        {...baseProps}
        handleQuantityChange={handleQuantityChange}
      />,
    );

    // Even if we let the full debounce delay pass on a freshly-mounted
    // component (no clicks at all), the parent should NOT be notified.
    // `act()` tells React "state might change while this callback runs —
    // apply those updates before moving on", which is required whenever a
    // timer we fast-forward ends up triggering a state update.
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(handleQuantityChange).not.toHaveBeenCalled();
  });

  it("calls handleQuantityChange with the settled value after 1000ms", () => {
    const handleQuantityChange = jest.fn();
    render(
      <ShoppingCardItem
        {...baseProps}
        handleQuantityChange={handleQuantityChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "+" }));

    // Right after the click, the debounce timer has just started —
    // nothing should have been sent to the parent yet.
    expect(handleQuantityChange).not.toHaveBeenCalled();

    // Fast-forward exactly the debounce delay.
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(handleQuantityChange).toHaveBeenCalledTimes(1);
    expect(handleQuantityChange).toHaveBeenCalledWith("item-1", 1);
  });

  it("only calls handleQuantityChange once for a burst of rapid clicks", () => {
    const handleQuantityChange = jest.fn();
    render(
      <ShoppingCardItem
        {...baseProps}
        handleQuantityChange={handleQuantityChange}
      />,
    );

    const plusButton = screen.getByRole("button", { name: "+" });

    // Simulate an impatient user clicking 3 times, always less than 1000ms
    // apart. Each click resets the debounce countdown back to 1000ms,
    // exactly like `useDebounce` is designed to do.
    fireEvent.click(plusButton); // count = 1
    act(() => {
      jest.advanceTimersByTime(900);
    });
    fireEvent.click(plusButton); // count = 2, timer restarts
    act(() => {
      jest.advanceTimersByTime(900);
    });
    fireEvent.click(plusButton); // count = 3, timer restarts again

    // Still nothing sent to the parent — the countdown never finished.
    expect(handleQuantityChange).not.toHaveBeenCalled();

    // Now let it finish uninterrupted.
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Exactly ONE call, with the final settled count — not one call per
    // click. This is the whole point of debouncing.
    expect(handleQuantityChange).toHaveBeenCalledTimes(1);
    expect(handleQuantityChange).toHaveBeenCalledWith("item-1", 3);
  });
});
