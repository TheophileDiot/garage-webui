import { PageContextProvider } from "@/context/page-context";
import Router from "./router";
import { Toaster } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CSSProperties, useState } from "react";
import ThemeProvider from "@/components/containers/theme-provider";
import appStore from "@/stores/app-store";
import { useStore } from "zustand";
import "./styles.css";

/** Toasts take the tokens: the dialog surface, a strong rule, ink. A phone lifts them above the tab bar. */
const toastStyle = {
  "--normal-bg": "var(--lift-2)",
  "--normal-border": "var(--rule-strong)",
  "--normal-text": "var(--ink)",
  "--border-radius": "6px",
  fontFamily: "inherit",
} as CSSProperties;

const App = () => {
  const [queryClient] = useState(() => new QueryClient());
  const theme = useStore(appStore, (state) => state.theme);

  return (
    <PageContextProvider>
      <QueryClientProvider client={queryClient}>
        <Router />
      </QueryClientProvider>
      <Toaster
        theme={theme}
        style={toastStyle}
        mobileOffset={{ bottom: "72px", left: "16px", right: "16px" }}
        toastOptions={{
          classNames: {
            error: "!border-l-[3px] !border-l-bad",
            success: "!border-l-[3px] !border-l-ok",
          },
        }}
      />
      <ThemeProvider />
    </PageContextProvider>
  );
};

export default App;
