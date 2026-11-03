import { PageContextProvider } from "@/context/page-context";
import Router from "./router";
import { Toaster } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import ThemeProvider from "@/components/containers/theme-provider";
import appStore from "@/stores/app-store";
import { useStore } from "zustand";
import "./styles.css";

const App = () => {
  const [queryClient] = useState(() => new QueryClient());
  const theme = useStore(appStore, (state) => state.theme);

  return (
    <PageContextProvider>
      <QueryClientProvider client={queryClient}>
        <Router />
      </QueryClientProvider>
      <Toaster richColors theme={theme} />
      <ThemeProvider />
    </PageContextProvider>
  );
};

export default App;
