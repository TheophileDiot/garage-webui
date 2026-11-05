import { useSyncExternalStore } from "react";

/** Tracks a media query. The sidebar uses it to decide between the fixed column and the phone drawer. */
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
