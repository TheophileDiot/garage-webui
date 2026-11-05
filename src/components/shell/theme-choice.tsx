import { Themes, themes } from "@/app/themes";
import { cn } from "@/lib/utils";
import appStore from "@/stores/app-store";
import { LucideIcon, Monitor, Moon, Sun } from "lucide-react";
import { KeyboardEvent, useRef } from "react";
import { useStore } from "zustand";

const OPTIONS: Record<Themes, { label: string; icon: LucideIcon }> = {
  light: { label: "Light", icon: Sun },
  dark: { label: "Dark", icon: Moon },
  system: { label: "System", icon: Monitor },
};

/**
 * Light, Dark or System as one radio group (roving tab stop, arrow keys select). System clears the stored choice,
 * so the OS preference decides. Used in the user menu and on the sign-in page.
 */
const ThemeChoice = ({ className }: { className?: string }) => {
  const theme = useStore(appStore, (s) => s.theme);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + themes.length) % themes.length;
    appStore.setTheme(themes[next]);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn("grid grid-cols-3 gap-1", className)}
    >
      {themes.map((t, i) => {
        const { label, icon: Icon } = OPTIONS[t];
        const on = theme === t;
        return (
          <button
            key={t}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => appStore.setTheme(t)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-md border px-1 py-2 text-caption transition-colors duration-100 md:min-h-[58px]",
              on
                ? "border-ink bg-surface-2 font-semibold text-ink"
                : "border-line bg-surface font-medium text-ink-2 hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Icon size={16} aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
};

export default ThemeChoice;
