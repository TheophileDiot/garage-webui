import { useCallback, useState } from "react";

export const useDisclosure = <T = unknown>() => {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<T | null | undefined>(null);

  return {
    isOpen,
    data,
    onOpen: useCallback((data?: T | null) => {
      setIsOpen(true);
      setData(data);
    }, []),
    onClose: useCallback(() => {
      setIsOpen(false);
    }, []),
  };
};
