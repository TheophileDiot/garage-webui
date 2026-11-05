import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

/**
 * A mutation that refreshes what it changed, then runs the caller's own `onSuccess`.
 *
 * `refresh` gets the query client and the variables. When it returns a promise (`Promise.all(invalidate…)`) the
 * caller's `onSuccess` waits for it, so a dialog closes on fresh lists; when it returns nothing (`void invalidate()`)
 * the caller runs at once. Anything else the hook needs (an `onError` refresh, say) goes through `options`.
 */
export const useInvalidatingMutation = <TData, TVars>(
  mutationFn: (vars: TVars) => Promise<TData>,
  refresh: (client: QueryClient, vars: TVars) => unknown,
  options?: Partial<UseMutationOptions<TData, Error, TVars>>,
) => {
  const client = useQueryClient();
  return useMutation<TData, Error, TVars>({
    mutationFn,
    ...options,
    onSuccess: (...args) => {
      const next = () =>
        (options?.onSuccess as ((...a: typeof args) => unknown) | undefined)?.(
          ...args,
        );
      const done = refresh(client, args[1]);
      return done instanceof Promise ? done.then(next) : next();
    },
  });
};
