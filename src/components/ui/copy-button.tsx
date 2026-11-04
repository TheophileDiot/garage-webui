import { copyToClipboard } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Copies `value`. "Copied" shows only after the browser took it; a failure toasts and the label stays "Copy". */
const CopyButton = ({
  value,
  label,
  className,
}: {
  value: string;
  /** Accessible name; it should contain the word "copy". */
  label: string;
  className?: string;
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
      className={cn(
        "relative isolate inline-flex h-8 shrink-0 items-center gap-1.5 overflow-hidden rounded-sm px-2 text-ink-3 transition-colors duration-caret md:h-6",
        "before:absolute before:inset-0 before:-z-10 before:origin-left before:scale-x-0 before:bg-transparent hover:before:bg-gold focus-visible:before:bg-gold before:transition-transform before:duration-caret before:ease-caret",
        "hover:text-gold-ink hover:before:scale-x-100 focus-visible:text-gold-ink focus-visible:before:scale-x-100",
        className,
      )}
    >
      {done ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
      <span aria-live="polite" className="text-caption">
        {done ? "Copied" : "Copy"}
      </span>
    </button>
  );
};

export default CopyButton;
