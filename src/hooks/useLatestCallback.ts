import { useCallback, useLayoutEffect, useRef } from 'react';

/** Stable event callback that always uses the most recently committed state. */
export function useLatestCallback<Args extends unknown[], Result>(callback: (...args: Args) => Result) {
  const currentCallback = useRef(callback);
  useLayoutEffect(() => {
    currentCallback.current = callback;
  });
  return useCallback((...args: Args): Result => currentCallback.current(...args), []);
}
