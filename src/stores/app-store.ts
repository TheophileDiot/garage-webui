import { Themes } from "@/app/themes";
import { createStore } from "zustand";
import { persist } from "zustand/middleware";

type AppState = {
  theme: Themes;
};

/** No stored choice means System: the document gets no `data-theme` and the OS preference decides. */
const store = createStore(
  persist<AppState>(() => ({ theme: "system" }), {
    name: "appdata",
    // Anything but an explicit light or dark falls back to System, so a hand-edited value cannot wedge the theme.
    merge: (persisted, current) => {
      const theme = (persisted as Partial<AppState> | undefined)?.theme;
      return {
        ...current,
        theme: theme === "light" || theme === "dark" ? theme : "system",
      };
    },
  }),
);

const appStore = {
  ...store,
  setTheme: (theme: AppState["theme"]) => store.setState({ theme }),
};

export default appStore;
