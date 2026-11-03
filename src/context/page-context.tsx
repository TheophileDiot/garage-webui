import {
  memo,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  initialPageValues,
  PageContext,
  PageContextValues,
} from "./page-context-value";

export const PageContextProvider = ({ children }: PropsWithChildren) => {
  const [values, setValues] = useState<PageContextValues>(initialPageValues);

  useEffect(() => {
    document.title = values.title
      ? `${values.title} · Garage`
      : "Garage · Storage console";
  }, [values.title]);

  const setValue = useCallback((value: Partial<PageContextValues>) => {
    setValues((prev) => ({ ...prev, ...value }));
  }, []);

  return (
    <PageContext.Provider value={{ ...values, setValue }}>
      {children}
    </PageContext.Provider>
  );
};

type PageProps = Partial<PageContextValues>;

const Page = memo((props: PageProps) => {
  const context = useContext(PageContext);
  if (!context) {
    throw new Error("Page component must be used within a PageContextProvider");
  }
  const { setValue } = context;

  useEffect(() => {
    setValue(props);

    return () => {
      setValue(initialPageValues);
    };
  }, [props, setValue]);

  return null;
});

export default Page;
