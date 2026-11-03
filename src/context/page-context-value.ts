import { createContext, ReactNode } from "react";

export type PageContextValues = {
  title: string | null;
  prev: string | null;
  actions: ReactNode | null;
};

export const initialPageValues: PageContextValues = {
  title: null,
  prev: null,
  actions: null,
};

export const PageContext = createContext<
  | (PageContextValues & {
      setValue: (values: Partial<PageContextValues>) => void;
    })
  | null
>(null);
