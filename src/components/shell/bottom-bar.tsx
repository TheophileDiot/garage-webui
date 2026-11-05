import {
  PropsWithChildren,
  ReactNode,
  useContext,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import { BottomBarContext, Slot } from "./bottom-bar-context";

/**
 * A page's own bottom bar, drawn in place of the bottom navigation while it is mounted (the objects browser's
 * selection bar, say). One bar at a time: unmount it, or render nothing, and the navigation is back. It draws
 * nothing on a wide screen, so keep the desktop version of the control where it was and show it there with
 * `useBottomBarAvailable() === false` (from `bottom-bar-context`). The bar is fixed to the bottom with the
 * safe-area inset; give it normal content and let it be as tall as it needs, the shell measures it and pads the
 * page.
 */
export const BottomBarSlot = ({ children }: { children: ReactNode }) => {
  const { el, claim } = useContext(BottomBarContext);
  const on = el !== null;
  useLayoutEffect(() => (on ? claim() : undefined), [on, claim]);
  return el ? createPortal(children, el) : null;
};

export const BottomBarProvider = ({
  value,
  children,
}: PropsWithChildren<{ value: Slot }>) => (
  <BottomBarContext.Provider value={value}>
    {children}
  </BottomBarContext.Provider>
);
