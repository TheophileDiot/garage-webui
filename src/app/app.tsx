import Router from "./router";
import { Toaster } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CSSProperties, useState } from "react";
import ThemeProvider from "@/components/containers/theme-provider";
import appStore from "@/stores/app-store";
import { useStore } from "zustand";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import "./styles.css";

/** Toasts take the tokens: the surface, a strong rule, ink. */
const toastStyle = {
  "--normal-bg": "var(--surface)",
  "--normal-border": "var(--line-strong)",
  "--normal-text": "var(--ink)",
  "--border-radius": "8px",
  fontFamily: "inherit",
} as CSSProperties;

const App = () => {
  const [queryClient] = useState(() => new QueryClient());
  const theme = useStore(appStore, (state) => state.theme);
  // Top centre under 961 px: the phone shell's bottom bar and a sheet's footer stay uncovered. Desktop: bottom right.
  const phone = useMediaQuery("(max-width: 960px)");

  return (
    <>
      <QueryClientProvider client={queryClient}>
        <Router />
      </QueryClientProvider>
      <Toaster
        theme={theme}
        position={phone ? "top-center" : "bottom-right"}
        style={toastStyle}
        mobileOffset={{ top: "16px", left: "16px", right: "16px" }}
        toastOptions={{
          classNames: {
            error: "!border-l-[3px] !border-l-bad",
            success: "!border-l-[3px] !border-l-ok",
          },
        }}
      />
      <ThemeProvider />
    </>
  );
};

export default App;
