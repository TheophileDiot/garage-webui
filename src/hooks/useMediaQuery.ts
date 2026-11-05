import { useSyncExternalStore } from "react";

/** Tracks a media query. The shell uses it to decide between the sidebar and the phone shell (bottom bar). */
export const useMediaQuery = (query: string) =>
  useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
