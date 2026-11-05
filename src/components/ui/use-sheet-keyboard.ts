import { keyboardInset } from "@/lib/keyboard-inset";
import { useEffect } from "react";

/** A field that opens the soft keyboard: not a checkbox, a button or a picker. */
const isTextField = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable ||
    el.tagName === "TEXTAREA" ||
    (el instanceof HTMLInputElement &&
      !/^(checkbox|radio|button|submit|reset|range|file|color|image|hidden)$/.test(
        el.type,
      )));

/**
 * Keeps a sheet above the soft keyboard. Gecko, iOS Safari and Chrome overlay the keyboard on the layout viewport
 * (only the visual viewport shrinks), so a sheet fixed to the bottom ends under it. While a text field in the sheet
 * has focus and the keyboard covers the page (`keyboardInset`), this sets `data-kb`, `--kb` (how far up) and
 * `--vvh` (how tall the room is) on the sheet: `styles.css` anchors it to the keyboard's top edge, footer visible,
 * and its body scrolls. The values change on the element directly, not through React state, so a pan or a resize
 * costs one style write per frame. Without a keyboard, or while zoomed, nothing is set and the sheet is as it was.
 */
export const useSheetKeyboard = (el: HTMLElement | null) => {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!el || !vv) return;
    let focused = false;
    let raf = 0;
    let last = 0;
    const apply = () => {
      raf = 0;
      const inset = focused
        ? keyboardInset({
            innerHeight: window.innerHeight,
            height: vv.height,
            offsetTop: vv.offsetTop,
            scale: vv.scale,
          })
        : 0;
      if (inset > 0) {
        el.dataset.kb = "";
        el.style.setProperty("--kb", `${inset}px`);
        el.style.setProperty("--vvh", `${vv.height}px`);
        // The browser scrolled the field into view before the sheet moved: do it again in the sheet's own body, a
        // frame later (with reduced motion every property still "transitions" for 0.01 ms, so the new size lands then).
        if (!last)
          requestAnimationFrame(() =>
            (document.activeElement as HTMLElement | null)?.scrollIntoView?.({
              block: "nearest",
            }),
          );
      } else {
        delete el.dataset.kb;
        el.style.removeProperty("--kb");
        el.style.removeProperty("--vvh");
      }
      last = inset;
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onIn = (e: FocusEvent) => {
      focused = isTextField(e.target);
      schedule();
    };
    const onOut = () => {
      focused = false;
      schedule();
    };
    el.addEventListener("focusin", onIn);
    el.addEventListener("focusout", onOut);
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    return () => {
      el.removeEventListener("focusin", onIn);
      el.removeEventListener("focusout", onOut);
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [el]);
};

/**
 * Whether a sheet should put the cursor in its first field when it opens. Not on a touch screen: the keyboard would
 * cover half the sheet before the user has seen it. With a mouse and a keyboard, yes, as before.
 */
export const autoFocusField = () =>
  !window.matchMedia("(pointer: coarse)").matches;
