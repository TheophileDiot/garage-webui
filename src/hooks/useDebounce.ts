import { useCallback, useEffect, useRef } from "react";

/** Stable debounced callback. It always calls the latest `fn`. */
export const useDebounce = <A extends unknown[]>(
  fn: (...args: A) => void,
  delay: number = 500,
) => {
  const fnRef = useRef(fn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fnRef.current = fn;
  });

  return useCallback(
    (...args: A) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => fnRef.current(...args), delay);
    },
    [delay],
  );
};
