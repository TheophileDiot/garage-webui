import { addressForRoute, toAddressBucket, toSegments } from "@/lib/address";
import { useBuckets } from "@/pages/buckets/hooks";
import { Search } from "lucide-react";
import { useLayoutEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { AddressText } from "../ui/page-header";
import Kbd from "../ui/kbd";

/**
 * Route change in the site's own idiom: the new address types itself into the bar at the caret.
 * Steps follow the character count (34 ms each), capped at 420 ms. Instant under reduced motion.
 */
const useTypeOn = (key: string) => {
  const ref = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (first.current) {
      first.current = false;
      return;
    }
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !el.animate
    )
      return;
    const chars = Math.max(1, (el.textContent ?? "").length);
    const a = el.animate([{ width: "0px" }, { width: `${el.scrollWidth}px` }], {
      duration: Math.min(chars * 34, 420),
      easing: `steps(${Math.min(chars, 40)}, end)`,
    });
    return () => a.cancel();
  }, [key]);
  return ref;
};

/** The address bar: where you are as an S3-style address, and the way to the palette. */
const AddressBar = ({ onOpenPalette }: { onOpenPalette: () => void }) => {
  const { pathname, search } = useLocation();
  const { data: buckets } = useBuckets();
  const text = useMemo(
    () =>
      addressForRoute(pathname, search, (buckets ?? []).map(toAddressBucket)),
    [pathname, search, buckets],
  );
  const { scheme, segments, trailing } = useMemo(
    () => toSegments(text, pathname),
    [text, pathname],
  );
  const typed = useTypeOn(`${pathname}${search}`);

  return (
    <div
      className="flex h-9 min-w-0 flex-1 items-center rounded-sm border border-rule-strong bg-sunk md:h-8 md:max-w-[56rem]"
      title={text}
    >
      <nav
        aria-label="Address"
        className="flex min-w-0 max-w-[75%] shrink items-center overflow-hidden whitespace-nowrap pl-2.5"
      >
        <span ref={typed} className="inline-flex overflow-hidden">
          <AddressText
            scheme={scheme}
            segments={segments}
            trailing={trailing}
            className="flex-nowrap"
          />
        </span>
      </nav>
      <button
        type="button"
        onClick={onOpenPalette}
        className="group flex h-full min-w-10 flex-1 items-center justify-end gap-2 px-2.5 text-ink-3 transition-colors duration-caret hover:bg-fill hover:text-ink"
      >
        <span className="caret-blink ml-1 mr-auto" aria-hidden />
        <span className="hidden sm:inline">Go to…</span>
        <Search size={14} aria-hidden className="sm:hidden" />
        <span className="sr-only sm:hidden">Go to…</span>
        <span className="hidden gap-0.5 sm:flex">
          <Kbd>ctrl</Kbd>
          <Kbd>k</Kbd>
        </span>
      </button>
    </div>
  );
};

export default AddressBar;
