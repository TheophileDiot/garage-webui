import { createSheetHistory } from "@/lib/sheet-history";
import { useEffect, useRef } from "react";

/** Narrow windows (the phone shell) and touch screens of any width, a tablet or a phone in landscape included. */
const BACK_QUERY = "(max-width: 960px), (pointer: coarse)";

const depthOf = (state: unknown) =>
  (state as { sheetDepth?: number } | null)?.sheetDepth ?? 0;

let history_: ReturnType<typeof createSheetHistory> | undefined;
let seq = 0;

/** One controller for the page, listening to popstate from the first sheet on. */
const sheets = () => {
  if (!history_) {
    history_ = createSheetHistory({
      // Keep the router's own state (key, idx) in the entry: it reads them back on popstate.
      push: (sheetDepth) =>
        window.history.pushState({ ...window.history.state, sheetDepth }, ""),
      go: (delta) => window.history.go(delta),
    });
    window.addEventListener("popstate", () =>
      history_!.popped(depthOf(window.history.state)),
    );
  }
  return history_;
};

/**
 * While a sheet is open on a phone, Back closes it and nothing else (see `lib/sheet-history`). `onBack` closes the
 * sheet and returns true, or returns false when it cannot close now (an action runs); it is read at Back time, so
 * pass the current one. Desktop (a wide screen with a mouse) keeps the browser's own Back.
 */
export const useSheetBack = (open: boolean, onBack: () => boolean) => {
  const latest = useRef(onBack);
  latest.current = onBack;
  useEffect(() => {
    if (!open || !window.matchMedia(BACK_QUERY).matches) return;
    const id = ++seq;
    sheets().open(id, () => latest.current());
    return () => sheets().close(id);
  }, [open]);
};

/**
 * Navigate away from under open sheets: their history entries go first, then `go` runs. Use it for a navigation a
 * sheet triggers (Open cluster, a search result, a delete that moves on), so the new page does not stack on a
 * sheet entry and Back from it lands on the page the user left.
 */
export const afterSheetsClosed = (go: () => void) => sheets().release(go);
