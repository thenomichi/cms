import { useCallback, useRef, useState } from "react";

/**
 * Tracks which fields the user has touched, so isDirty doesn't
 * require a full JSON.stringify of form state on every render.
 */
export function useTripDirty() {
  const setRef = useRef<Set<string>>(new Set());
  // Tick counter forces re-render when the set changes; the set itself
  // is mutated in place to keep markDirty O(1) and allocation-free.
  const [, setTick] = useState(0);

  const markDirty = useCallback((key: string) => {
    if (!setRef.current.has(key)) {
      setRef.current.add(key);
      setTick((t) => t + 1);
    }
  }, []);

  const reset = useCallback(() => {
    if (setRef.current.size > 0) {
      setRef.current = new Set();
      setTick((t) => t + 1);
    }
  }, []);

  return {
    isDirty: setRef.current.size > 0,
    dirtyKeys: Array.from(setRef.current),
    markDirty,
    reset,
  };
}
