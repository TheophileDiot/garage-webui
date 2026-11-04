import { createStore } from "zustand";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  /**
   * The work behind the confirmation. With it the dialog shows a pending state while it runs, resolves `true` and
   * closes on success, and on rejection shows the error and stays open. Without it the dialog just resolves.
   */
  action?: () => Promise<unknown>;
};

type ConfirmState = Omit<ConfirmOptions, "action"> & {
  open: boolean;
  pending: boolean;
  error: string | null;
};

const closed: ConfirmState = {
  open: false,
  pending: false,
  error: null,
  title: "",
  message: "",
};

export const confirmStore = createStore<ConfirmState>(() => closed);

let resolver: ((value: boolean) => void) | null = null;
let current: ConfirmOptions["action"];
let seq = 0;

export const settle = (value: boolean) => {
  seq++;
  current = undefined;
  confirmStore.setState({ open: false, pending: false, error: null });
  resolver?.(value);
  resolver = null;
};

/** Called by the host when the user confirms. */
export const runConfirm = async () => {
  if (confirmStore.getState().pending) return;
  if (!current) return settle(true);
  const mine = seq;
  confirmStore.setState({ pending: true, error: null });
  try {
    await current();
  } catch (err) {
    // A newer dialog replaced this one while it ran: its state is not ours to touch.
    if (mine !== seq) return;
    confirmStore.setState({
      pending: false,
      error: (err as Error)?.message || "Something went wrong",
    });
    return;
  }
  if (mine === seq) settle(true);
};

/** In-app replacement for window.confirm. Resolves true when confirmed (and, with `action`, when it succeeded). */
export const confirmAction = ({ action, ...options }: ConfirmOptions) => {
  resolver?.(false);
  seq++;
  current = action;
  // Replace, not merge: a merge would leak the previous dialog's confirmLabel and danger into this one.
  confirmStore.setState({ ...closed, ...options, open: true }, true);
  return new Promise<boolean>((resolve) => {
    resolver = resolve;
  });
};
