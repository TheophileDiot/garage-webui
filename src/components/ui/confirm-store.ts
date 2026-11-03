import { createStore } from "zustand";

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
};

export type ConfirmState = ConfirmOptions & { open: boolean };

export const confirmStore = createStore<ConfirmState>(() => ({
  open: false,
  title: "",
  message: "",
}));
let resolver: ((value: boolean) => void) | null = null;

export const settle = (value: boolean) => {
  confirmStore.setState({ open: false });
  resolver?.(value);
  resolver = null;
};

/** In-app replacement for window.confirm. Resolves true when confirmed. */
export const confirmAction = (options: ConfirmOptions) => {
  resolver?.(false);
  confirmStore.setState({ ...options, open: true });
  return new Promise<boolean>((resolve) => {
    resolver = resolve;
  });
};
