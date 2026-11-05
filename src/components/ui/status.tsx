import { safeRatio } from "@/lib/partitions";
import { cn } from "@/lib/utils";
import {
  CircleCheck,
  CircleDashed,
  CircleX,
  TriangleAlert,
} from "lucide-react";
import { ReactNode } from "react";

export type Tone = "ok" | "warn" | "bad" | "idle";

const text: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-bad",
  idle: "text-ink-3",
};

const icon = {
  ok: CircleCheck,
  warn: TriangleAlert,
  bad: CircleX,
  idle: CircleDashed,
} as const;

/** Status = an icon shape plus a word, never colour alone: circle-check fine, triangle degraded, circle-x not fine, dashed unknown. */
export const Status = ({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) => {
  const Icon = icon[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap font-medium",
        text[tone],
        className,
      )}
    >
      <Icon size={15} aria-hidden className="shrink-0" />
      {children}
    </span>
  );
};

type Tint = "ink" | "ok" | "warn" | "bad";

const fill: Record<Tint, string> = {
  ink: "bg-bar",
  ok: "bg-ok",
  warn: "bg-warn",
  bad: "bg-bad",
};

type MeterProps = {
  max: number;
  label: string;
  value: number;
  tone?: Tint;
  /** Fills a grid cell without reserving the normal 90 px flex basis. */
  compact?: boolean;
  className?: string;
};

/**
 * Thin bar, 6 px. Always sits next to its numbers in text; the bar is a second reading, not the only one.
 * A zero or missing `max` draws an empty bar, never NaN.
 */
export const Meter = ({
  max,
  label,
  value,
  tone = "ink",
  compact = false,
  className,
}: MeterProps) => {
  const p = safeRatio(value, max) * 100;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max > 0 ? max : 0}
      aria-valuenow={Math.max(0, value)}
      aria-valuetext={`${Math.round(p)}%`}
      className={cn(
        "h-1.5 flex-1 overflow-hidden rounded-[2px] bg-track",
        compact ? "min-w-0 basis-auto" : "min-w-[60px] basis-[90px]",
        className,
      )}
    >
      <i
        className={cn("block h-full rounded-[2px]", fill[tone])}
        style={{ width: `${p}%` }}
      />
    </div>
  );
};
