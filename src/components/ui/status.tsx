import { cn } from "@/lib/utils";

type Tone = "ok" | "warn" | "bad" | "idle";

const dot: Record<Tone, string> = {
  ok: "bg-success",
  warn: "bg-warning",
  bad: "bg-error",
  idle: "bg-base-content/40",
};

const text: Record<Tone, string> = {
  ok: "text-success",
  warn: "text-warning",
  bad: "text-error",
  idle: "text-base-content/70",
};

/** Status is always a dot plus a text label, never colour alone. */
export const StatusPill = ({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: string;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-2 text-sm font-bold",
      text[tone],
      className,
    )}
  >
    <span
      aria-hidden
      className={cn("h-2 w-2 shrink-0 rounded-full", dot[tone])}
    />
    {children}
  </span>
);

type Segment = { value: number; className: string };

/** Stacked meter. Segments are drawn left to right, widths are shares of `max`. */
export const Meter = ({
  segments,
  max,
  label,
  className,
}: {
  segments: Segment[];
  max: number;
  label: string;
  className?: string;
}) => {
  const total = Math.max(max, 1);
  return (
    <div role="img" aria-label={label} className={cn("meter", className)}>
      {segments.map((segment, i) =>
        segment.value > 0 ? (
          <span
            key={i}
            className={segment.className}
            style={{
              width: `${(segment.value / total) * 100}%`,
              animationDelay: `${i * 120}ms`,
            }}
          />
        ) : null,
      )}
    </div>
  );
};
