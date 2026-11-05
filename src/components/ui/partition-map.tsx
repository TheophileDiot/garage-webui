import {
  healthReading,
  partitionStates,
  safeRatio,
  type PartitionHealth,
} from "@/lib/partitions";
import { cn } from "@/lib/utils";
import {
  CSSProperties,
  KeyboardEvent,
  PointerEvent,
  useMemo,
  useState,
} from "react";
import Button from "./button";
import { StateGlyph, type GlyphState } from "./state-glyph";

/**
 * The partition map shows only what GetClusterHealth gives: counts of partitions by state. No zone, no replica
 * count, no placement. State reads by shape, colour and words together.
 */
const COPY: Record<
  Exclude<GlyphState, "unknown">,
  { name: string; note: string; short: string }
> = {
  full: {
    name: "All copies reachable",
    note: "every copy of these partitions answers",
    short: "all copies reachable",
  },
  degraded: {
    name: "Quorum only",
    note: "quorum holds, a copy is unreachable",
    short: "quorum only, a copy is unreachable",
  },
  lost: {
    name: "No quorum",
    note: "requests to these partitions fail",
    short: "no quorum, requests fail",
  },
};

type Counts = { full: number; quorumOnly: number; none: number };

const cellState = (i: number, c: Counts): Exclude<GlyphState, "unknown"> =>
  i < c.full ? "full" : i < c.full + c.quorumOnly ? "degraded" : "lost";

const describeCell = (i: number, total: number, c: Counts) =>
  `Cell ${i + 1} of ${total}: ${COPY[cellState(i, c)].short}.`;

type MapProps = {
  counts: Counts;
  /** Dim every cell not in this state. */
  focus?: GlyphState | null;
  active?: number | null;
  onActive?: (i: number | null) => void;
  className?: string;
};

// shortcut: renders one element per partition, fine for Garage's fixed 256; sample or cap it if a cluster ever reports thousands.
/** One cell per partition, grouped by state. Pointer or arrow keys select a cell; the parent shows its readout. */
const PartitionMap = ({
  counts,
  focus = null,
  active = null,
  onActive,
  className,
}: MapProps) => {
  const total = counts.full + counts.quorumOnly + counts.none;
  const { full, quorumOnly, none } = counts;
  const cells = useMemo(
    () =>
      Array.from({ length: total }, (_, i) =>
        cellState(i, { full, quorumOnly, none }),
      ),
    [total, full, quorumOnly, none],
  );
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const i = Number((e.target as HTMLElement).dataset.i);
    if (Number.isFinite(i)) onActive?.(i);
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = active ?? 0;
    const step: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: 16,
      ArrowUp: -16,
    };
    let next: number | null = null;
    if (e.key in step)
      next = Math.min(total - 1, Math.max(0, at + step[e.key]));
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = total - 1;
    if (next !== null) {
      e.preventDefault();
      onActive?.(next);
    }
  };
  const interactive = !!onActive;
  return (
    <div
      {...(interactive
        ? {
            role: "group",
            tabIndex: 0,
            "aria-label": `Partition map, ${total} cells grouped by state. Arrow keys move between cells.`,
            onPointerMove: move,
            onPointerLeave: () => onActive?.(null),
            onFocus: () => active === null && onActive?.(0),
            onBlur: () => onActive?.(null),
            onKeyDown: key,
          }
        : {
            role: "img",
            "aria-label": `Partition map: ${counts.full} with all copies reachable, ${counts.quorumOnly} with quorum only, ${counts.none} without quorum.`,
          })}
      data-focus={focus ?? undefined}
      className={cn("pmap", interactive && "pmap-live", className)}
    >
      {cells.map((s, i) => (
        <span key={i} className="cell" data-s={s} data-i={i} />
      ))}
      {interactive && active !== null ? (
        <span
          aria-hidden
          className="cell-ring"
          style={
            {
              "--col": active % 16,
              "--row": Math.floor(active / 16),
            } as CSSProperties
          }
        />
      ) : null}
    </div>
  );
};

/** 256 empty cells: loading, or no usable health. */
const IdleMap = () => (
  <div className="pmap pmap-idle" aria-hidden>
    {Array.from({ length: 256 }, (_, i) => (
      <span key={i} className="cell" />
    ))}
  </div>
);

const READ_IDLE =
  "Point at a cell, or focus the map and use the arrow keys, to read its state.";

/**
 * Map, legend and readout as one unit. The legend row highlights the cells it describes (hover, focus or click to
 * pin) and a cell answers the pointer with its state. With no usable health, or when the last refresh failed, it
 * shows an unavailable state with the reason and a retry instead of a map, so no count is ever invented and a
 * stale reading is never shown as current.
 */
const PartitionPanel = ({
  health,
  isLoading,
  error,
  onRetry,
  className,
}: {
  health?: PartitionHealth;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  className?: string;
}) => {
  const [active, setActive] = useState<number | null>(null);
  const [hover, setHover] = useState<GlyphState | null>(null);
  const [pinned, setPinned] = useState<GlyphState | null>(null);
  const focus = hover ?? pinned;

  if (isLoading && !health) {
    return (
      <div
        role="status"
        aria-label="Loading partition map"
        className={cn("grid gap-2", className)}
      >
        <IdleMap />
        <span className="sr-only">Loading partition map…</span>
      </div>
    );
  }

  const reading = healthReading(health, !!error);
  if (!reading.usable) {
    const detail = error ? (error as Error)?.message : undefined;
    return (
      <div
        role={error ? "alert" : "status"}
        className={cn("flex flex-wrap items-start gap-x-5 gap-y-4", className)}
      >
        <IdleMap />
        <div className="grid min-w-0 flex-[1_1_200px] justify-items-start gap-2 [overflow-wrap:anywhere]">
          <p className="flex items-center gap-2 font-semibold">
            <StateGlyph state="unknown" size={22} />
            Partition map unavailable
          </p>
          <p className="text-ink-2">{reading.reason}</p>
          {detail && detail !== reading.reason ? (
            <p className="text-ink-2">{detail}</p>
          ) : null}
          <p className="text-ink-2">
            No partition counts are shown until health is known.
          </p>
          <Button onClick={onRetry}>Try again</Button>
        </div>
      </div>
    );
  }

  const counts = partitionStates(reading.health);
  const total = counts.full + counts.quorumOnly + counts.none;
  const rows: Array<{
    key: keyof Counts;
    state: Exclude<GlyphState, "unknown">;
  }> = [
    { key: "full", state: "full" },
    { key: "quorumOnly", state: "degraded" },
    { key: "none", state: "lost" },
  ];

  return (
    <div className={className}>
      <p className="fig">
        {counts.full.toLocaleString()}
        <small>of {total.toLocaleString()} fully reachable</small>
      </p>
      <div className="mt-3.5 flex flex-wrap items-start gap-x-5 gap-y-4">
        <PartitionMap
          counts={counts}
          focus={focus}
          active={active}
          onActive={setActive}
        />
        <div
          role="group"
          aria-label="Highlight cells by state"
          className="flex min-w-0 flex-[1_1_210px] flex-col gap-0.5"
        >
          {rows.map(({ key, state }) => (
            <button
              key={state}
              type="button"
              aria-pressed={pinned === state}
              onClick={() => setPinned((p) => (p === state ? null : state))}
              onPointerEnter={() => setHover(state)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(state)}
              onBlur={() => setHover(null)}
              className="legend-row"
            >
              <StateGlyph state={state} size={22} />
              <span className="min-w-0">
                <span className="block font-semibold leading-tight">
                  {COPY[state].name}
                </span>
                <span className="mt-px block text-label leading-snug text-ink-3">
                  {COPY[state].note}
                </span>
              </span>
              <span className="text-right">
                <span
                  className={cn(
                    "block font-cond text-stat font-semibold leading-none",
                    counts[key] === 0 && "text-ink-3",
                  )}
                >
                  {counts[key].toLocaleString()}
                </span>
                <span className="mt-[3px] block text-label text-ink-3">
                  {Math.round(safeRatio(counts[key], total) * 100)}%
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <p
        className="mt-3.5 flex min-h-9 items-center gap-2 border-t border-line pt-3 text-ink-2"
        aria-live="polite"
      >
        {active !== null ? (
          <>
            <StateGlyph state={cellState(active, counts)} size={22} />
            {describeCell(active, total, counts)}
          </>
        ) : (
          READ_IDLE
        )}
      </p>
      <p className="mt-2 text-caption text-ink-3">
        One cell per partition, grouped by state. The API reports counts, not
        where a partition lives.
      </p>
    </div>
  );
};

export default PartitionPanel;
