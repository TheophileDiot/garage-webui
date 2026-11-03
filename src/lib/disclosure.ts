import { createStore, useStore } from "zustand";

export const createDisclosure = <T = unknown>() => {
  const store = createStore(() => ({
    data: undefined as T | null | undefined,
    isOpen: false,
  }));

  return {
    store,
    use: () => useStore(store),
    open: (data?: T | null) => store.setState({ isOpen: true, data }),
    close: () => store.setState({ isOpen: false }),
  };
};
