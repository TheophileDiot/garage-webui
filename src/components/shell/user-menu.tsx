import { ChevronUp, LogOut } from "lucide-react";
import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";
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
 * The account button pinned to the bottom of the sidebar. It opens a small panel with the theme choice and Sign
 * out. Escape closes it and returns focus to the button; a click or focus outside it closes it too.
 */
const UserMenu = ({
  name,
  onSignOut,
  signingOut,
}: {
  name: string;
  onSignOut: () => void;
  signingOut: boolean;
}) => {
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
        className="flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sb-ink hover:bg-sb-hover"
      >
        <span
          aria-hidden
          className="grid h-7 w-7 flex-none place-items-center rounded-full bg-sb-avatar-bg font-cond text-label font-semibold tracking-[0.04em] text-sb-avatar-ink"
        >
          {initials(name)}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium" title={name}>
          {name}
        </span>
        <ChevronUp
          size={16}
          aria-hidden
          className={`flex-none text-sb-ink-2 transition-transform duration-100 ${open ? "" : "rotate-180"}`}
        />
      </button>
      {open ? (
        <div
          id={uid}
          role="group"
          aria-label="Account"
          className="absolute inset-x-0 bottom-[calc(100%+6px)] z-50 rounded-lg border border-line-strong bg-surface p-1.5 text-ink shadow-pop"
        >
          <p className="lbl px-2.5 pb-1.5 pt-1.5">Theme</p>
          <ThemeChoice className="px-1 pb-1" />
          <hr className="my-1.5 border-0 border-t border-line" />
          <button
            type="button"
            disabled={signingOut}
            onClick={onSignOut}
            className="flex min-h-9 w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-surface-2 disabled:opacity-50"
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
