import { safeRatio } from "@/lib/partitions";
import { cn } from "@/lib/utils";
import { CSSProperties, ReactNode } from "react";

export type Tone = "ok" | "warn" | "bad" | "idle";

const text: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-bad",
  idle: "text-ink-3",
};

/** Status = a shape plus a word. Filled square: fine. Hollow square: not fine. Triangle: degraded. Dash: unknown. */
export const Status = ({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 whitespace-nowrap font-medium",
      text[tone],
      className,
    )}
  >
    <svg
      width="9"
      height="9"
      viewBox="0 0 9 9"
      aria-hidden
      className="shrink-0"
    >
      {tone === "ok" && (
        <rect x="0.5" y="0.5" width="8" height="8" fill="currentColor" />
      )}
      {tone === "bad" && (
        <rect
          x="1"
          y="1"
          width="7"
          height="7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      )}
      {tone === "warn" && (
        <path d="M4.5 0.5 8.5 8.5H0.5Z" fill="currentColor" />
      )}
      {tone === "idle" && (
        <rect x="1" y="3.5" width="7" height="2" fill="currentColor" />
      )}
    </svg>
    {children}
  </span>
);

type Tint = "ink" | "ok" | "warn" | "bad" | "gold";

const fill: Record<Tint, string> = {
  ink: "var(--ink-2)",
  ok: "var(--ok)",
  warn: "var(--warn)",
  bad: "var(--bad)",
  gold: "var(--gold-text)",
};

type MeterProps = {
  max: number;
  label: string;
  value: number;
  tone?: Tint;
  className?: string;
};

/**
 * Cell meter. Always sits next to its numbers in text; the bar is a second reading, not the only one.
 * A zero or missing `max` draws an empty bar, never NaN.
 */
export const Meter = ({
  max,
  label,
  value,
  tone = "ink",
  className,
}: MeterProps) => {
  const p = safeRatio(value, max) * 100;
  const style = { "--meter-fill": fill[tone] } as CSSProperties;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max > 0 ? max : 0}
      aria-valuenow={Math.max(0, value)}
      aria-valuetext={`${Math.round(p)}%`}
      className={cn("meter w-full", className)}
      style={style}
    >
      <i style={{ width: `${p}%` }} />
    </div>
  );
};
