import {
  allocateCells,
  hasUsableHealth,
  partitionStates,
  runsFromCounts,
  type PartitionHealth,
} from "@/lib/partitions";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

/**
 * The partition map shows only what GetClusterHealth gives: counts of partitions by state. No zone, no replica
 * count, no placement. A "sliver" is a three-level state glyph: three lit bars, two lit and one outlined, one lit
 * and two outlined. State reads by shape, colour and words together.
 */
export type GlyphState = "full" | "degraded" | "lost" | "unknown";

const TONE: Record<GlyphState, string> = {
  full: "var(--ok)",
  degraded: "var(--warn)",
  lost: "var(--bad)",
  unknown: "var(--ink-3)",
};
/** The same colours on the dark sidebar, which has its own token set. */
const SIDEBAR = {
  ok: "var(--sb-ok)",
  warn: "var(--sb-warn)",
  bad: "var(--sb-bad)",
  mute: "var(--sb-ink-2)",
};
const LIT: Record<GlyphState, number> = {
  full: 3,
  degraded: 2,
  lost: 1,
  unknown: 0,
};

/** Three bars; the number lit is the state. `unknown` draws three dashes. */
export const StateGlyph = ({
  state,
  size = 18,
  className,
}: {
  state: GlyphState;
  size?: number;
  className?: string;
}) => (
  <svg
    aria-hidden
    viewBox="0 0 18 14"
    width={size}
    height={(size * 14) / 18}
    className={cn("shrink-0", className)}
  >
    {[0, 1, 2].map((i) => {
      if (state === "unknown")
        return (
          <rect
            key={i}
            x={i * 6.5}
            y="6"
            width="5"
            height="2"
            fill="var(--ink-3)"
          />
        );
      const on = i < LIT[state];
      return (
        <rect
          key={i}
          x={i * 6.5 + (on ? 0 : 0.6)}
          y={on ? 1 : 1.6}
          width={on ? 5 : 3.8}
          height={on ? 12 : 10.8}
          rx="1"
          fill={on ? TONE[state] : "none"}
          stroke={on ? "none" : "var(--ink-3)"}
          strokeWidth="1.2"
        />
      );
    })}
  </svg>
);

/**
 * The map at 16 x 16 pixels for the shell: the same counts as the big map, scaled to 256 pixels. At 32 px every
 * cell is 2 px, so a single quorum-only or no-quorum cell is visible. `onSidebar` uses the sidebar colours.
 * With no usable health it draws a dashed outline, never counts.
 */
export const StatusGlyph = ({
  health,
  size = 32,
  onSidebar = false,
  className,
}: {
  /** Pass only a reading that `healthReading` called usable; anything else draws the unavailable outline. */
  health?: PartitionHealth;
  size?: number;
  onSidebar?: boolean;
  className?: string;
}) => {
  const paths = useMemo(
    () =>
      hasUsableHealth(health)
        ? runsFromCounts(allocateCells(partitionStates(health), 256))
        : null,
    [health],
  );
  const c = onSidebar
    ? SIDEBAR
    : {
        ok: "var(--ok)",
        warn: "var(--warn)",
        bad: "var(--bad)",
        mute: "var(--ink-3)",
      };

  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={cn("shrink-0 rounded-[2px]", className)}
    >
      {paths ? (
        <>
          <path d={paths.full} fill={c.ok} />
          <path d={paths.degraded} fill={c.warn} />
          <path d={paths.lost} fill={c.bad} />
        </>
      ) : (
        <>
          <rect
            x="0.5"
            y="0.5"
            width="15"
            height="15"
            fill="none"
            stroke={c.mute}
            strokeDasharray="2 2"
          />
          <rect x="4" y="7.25" width="8" height="1.5" fill={c.mute} />
        </>
      )}
    </svg>
  );
};
