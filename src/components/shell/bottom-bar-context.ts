import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type Slot = {
  /** The element a page bar is drawn into; null on a wide screen, where there is no bottom bar at all. */
  el: HTMLElement | null;
  /** Pages with a bar in the slot right now. While there is one, it replaces the bottom navigation. */
  claims: number;
  claim: () => () => void;
};

export const BottomBarContext = createContext<Slot>({
  el: null,
  claims: 0,
  claim: () => () => {},
});

/** The shell's side: owns the slot element and the count of pages that fill it. */
export const useBottomBarState = () => {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [claims, setClaims] = useState(0);
  // Stable, so a page's effect does not re-run (and release and claim again) each time the count changes.
  const claim = useCallback(() => {
    setClaims((n) => n + 1);
    return () => setClaims((n) => n - 1);
  }, []);
  const value = useMemo<Slot>(
    () => ({ el, claims, claim }),
    [el, claims, claim],
  );
  return { value, claims, setEl };
};

/** True on phone (below 961 px), where the shell has a bottom bar a page can take over. */
export const useBottomBarAvailable = () =>
  useContext(BottomBarContext).el !== null;
