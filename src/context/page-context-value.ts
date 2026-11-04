import { createContext } from "react";

export type PageContextValues = {
  /** Sets document.title. Each page renders its own PageHeader. */
  title: string | null;
};

export const initialPageValues: PageContextValues = {
  title: null,
};

export const PageContext = createContext<
  | (PageContextValues & {
      setValue: (values: Partial<PageContextValues>) => void;
    })
  | null
>(null);
