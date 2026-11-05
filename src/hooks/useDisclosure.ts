import { useCallback, useState } from "react";

/** Open/closed state for a dialog. `onOpen` ignores its arguments, so it can be wired straight to `onClick`. */
export const useDisclosure = () => {
  const [isOpen, setIsOpen] = useState(false);

  return {
    isOpen,
    onOpen: useCallback(() => setIsOpen(true), []),
    onClose: useCallback(() => setIsOpen(false), []),
  };
};
