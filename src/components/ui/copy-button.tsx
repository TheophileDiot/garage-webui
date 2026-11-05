import { copyToClipboard } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Copies `value`. "Copied" shows only after the browser took it; a failure toasts and the label stays "Copy".
 * `iconOnly` drops the word and keeps the accessible name, for a value that already sits in a tight line.
 */
const CopyButton = ({
  value,
  label,
  className,
  iconOnly = false,
}: {
  value: string;
  /** Accessible name; it should contain the word "copy". */
  label: string;
  className?: string;
  iconOnly?: boolean;
}) => {
  const [done, setDone] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    const ok = await copyToClipboard(value);
    if (!ok) return;
    setDone(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDone(false), 1400);
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={label}
      title={iconOnly ? label : undefined}
      className={cn(
        "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded border border-transparent text-ink-3 transition-colors duration-100 desk:h-[30px]",
        "hover:border-line hover:bg-surface-2 hover:text-ink",
        iconOnly ? "w-9 desk:w-[30px]" : "px-2",
        className,
      )}
    >
      {done ? (
        <Check size={14} aria-hidden className="text-ok" />
      ) : (
        <Copy size={14} aria-hidden />
      )}
      {iconOnly ? (
        <span className="sr-only" aria-live="polite">
          {done ? "Copied" : ""}
        </span>
      ) : (
        <span aria-live="polite" className="text-caption">
          {done ? "Copied" : "Copy"}
        </span>
      )}
    </button>
  );
};

export default CopyButton;
