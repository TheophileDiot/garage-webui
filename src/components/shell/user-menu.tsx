import { cn } from "@/lib/utils";
import { ChevronUp, LogOut } from "lucide-react";
import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { hit44 } from "../ui/button-styles";
import ThemeChoice from "./theme-choice";

const initials = (name: string) => {
  const words = name.split(/[\s@._-]+/).filter(Boolean);
  const letters =
    words.length > 1
      ? words[0][0] + words[1][0]
      : (words[0] ?? "A").slice(0, 2);
  return letters.toUpperCase();
};

/**
 * The account button. In the sidebar it is pinned to the bottom and opens its panel upward; `variant="bar"` is the
 * phone's avatar-only button in the top bar, whose panel opens downward from the right edge. The panel holds the
 * theme choice and Sign out. Escape closes it and returns focus to the button; a click or focus outside it
 * closes it too.
 */
const UserMenu = ({
  name,
  onSignOut,
  signingOut,
  variant = "sidebar",
}: {
  name: string;
  onSignOut: () => void;
  signingOut: boolean;
  variant?: "sidebar" | "bar";
}) => {
  const bar = variant === "bar";
  const [open, setOpen] = useState(false);
  const uid = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // A pointer press or focus landing outside closes it. Not a blur handler: Safari does not focus a clicked button.
    const away = (e: Event) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("focusin", away);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("focusin", away);
    };
  }, [open]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    }
  };

  return (
    <div ref={wrap} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={open ? uid : undefined}
        onClick={() => setOpen((o) => !o)}
        aria-label={bar ? `Account: ${name}` : undefined}
        className={cn(
          bar
            ? cn(hit44, "grid size-9 flex-none place-items-center rounded-full")
            : "flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sb-ink hover:bg-sb-hover",
        )}
      >
        <span
          aria-hidden
          // A template, not `cn`: tailwind-merge drops `text-label` (a size) next to the `text-sb-avatar-ink` colour.
          className={`grid flex-none place-items-center rounded-full bg-sb-avatar-bg font-cond text-label font-semibold tracking-[0.04em] text-sb-avatar-ink ${bar ? "size-9" : "h-7 w-7"}`}
        >
          {initials(name)}
        </span>
        {bar ? null : (
          <>
            <span className="min-w-0 flex-1 truncate font-medium" title={name}>
              {name}
            </span>
            <ChevronUp
              size={16}
              aria-hidden
              className={`flex-none text-sb-ink-2 transition-transform duration-100 ${open ? "" : "rotate-180"}`}
            />
          </>
        )}
      </button>
      {open ? (
        <div
          id={uid}
          role="group"
          aria-label="Account"
          className={cn(
            "absolute z-50 rounded-lg border border-line-strong bg-surface p-1.5 text-ink shadow-pop",
            bar
              ? "right-0 top-[calc(100%+8px)] w-[min(17rem,calc(100vw-1rem))]"
              : "inset-x-0 bottom-[calc(100%+6px)]",
          )}
        >
          <p className="lbl px-2.5 pb-1.5 pt-1.5">Theme</p>
          <ThemeChoice className="px-1 pb-1" />
          <hr className="my-1.5 border-0 border-t border-line" />
          <button
            type="button"
            disabled={signingOut}
            onClick={onSignOut}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-surface-2 disabled:opacity-50 desk:min-h-9"
          >
            <LogOut size={16} aria-hidden className="text-ink-3" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default UserMenu;
