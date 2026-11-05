import appStore from "@/stores/app-store";
import { useEffect } from "react";
import { useStore } from "zustand";

/** Light and Dark set `data-theme`; System removes it, so the tokens follow the OS preference. */
const ThemeProvider = () => {
  const theme = useStore(appStore, (i) => i.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light" || theme === "dark")
      root.setAttribute("data-theme", theme);
    else root.removeAttribute("data-theme");
  }, [theme]);

  return null;
};

export default ThemeProvider;
