/**
 * Learning aid: counts how many times a component COMMITS (renders to the
 * DOM) and writes the number straight into a <span> — without causing an
 * extra render itself. Attach the returned ref to any element.
 */
import { useEffect, useRef } from "react";

export function useCommitCount<T extends HTMLElement = HTMLSpanElement>() {
  const count = useRef(0);
  const ref = useRef<T>(null);

  useEffect(() => {
    count.current += 1;
    if (ref.current) ref.current.textContent = `renders: ${count.current}`;
  });

  return ref;
}
