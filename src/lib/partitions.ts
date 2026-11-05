/** Pure helpers for the partition counts of GetClusterHealth. No imports: node --test runs this file as it is. */

type PartitionCounts = {
  partitions: number;
  partitionsQuorum: number;
  partitionsAllOk: number;
};

/** What the partition views need from GetClusterHealth: the counts and the overall status. */
export type PartitionHealth = PartitionCounts & { status: string };

const isCount = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);

/** "a of b" when both are finite counts, else null: a partial health body must never print "undefined". */
export const ofCounts = (a?: number, b?: number) =>
  isCount(a) && isCount(b)
    ? `${a.toLocaleString()} of ${b.toLocaleString()}`
    : null;

/** True when health carries all three partition counts. */
export const hasPartitionCounts = (h: Partial<PartitionCounts>) =>
  isCount(h.partitions) &&
  isCount(h.partitionsQuorum) &&
  isCount(h.partitionsAllOk);

/** Health we can draw: a known status and at least one partition. */
export const hasUsableHealth = <H extends Partial<PartitionHealth>>(
  h?: H,
): h is H & PartitionHealth =>
  !!h &&
  h.status !== "unknown" &&
  hasPartitionCounts(h) &&
  (h.partitions ?? 0) > 0;

/** Why no partition counts are drawn, for a health body that is not usable. */
const unavailableReason = (h?: Partial<PartitionHealth>) =>
  !h
    ? "No health reading yet."
    : h.status === "unknown"
      ? "The cluster reports its health as unknown."
      : !hasPartitionCounts(h)
        ? "The health reply carries no partition counts."
        : "The cluster reports no partitions.";

/**
 * Whether a health query's result can be drawn. A refresh that failed makes it unusable even when an earlier,
 * healthy reading is still cached: stale counts are never shown as if they were current.
 */
export const healthReading = <H extends Partial<PartitionHealth>>(
  health: H | undefined,
  isError: boolean,
):
  | { usable: true; health: H & PartitionHealth }
  | { usable: false; reason: string } =>
  isError
    ? { usable: false, reason: "The last health refresh failed." }
    : hasUsableHealth(health)
      ? { usable: true, health }
      : { usable: false, reason: unavailableReason(health) };

const atLeastZero = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/**
 * Partitions by what the API can tell: every copy reachable, quorum only, no quorum.
 * Health reports counts, never which partition is where.
 */
export const partitionStates = (h: PartitionCounts) => ({
  full: atLeastZero(h.partitionsAllOk),
  quorumOnly: atLeastZero(h.partitionsQuorum - h.partitionsAllOk),
  none: atLeastZero(h.partitions - h.partitionsQuorum),
});

/** n / d clamped to [0, 1]; 0 when the denominator is not a positive number. */
export const safeRatio = (n: number, d: number) => {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return 0;
  return Math.min(1, Math.max(0, n / d));
};

/**
 * Scale the three counts to `cells` equal cells (largest remainder), so a state that exists always gets one cell
 * and the total is exact. Used by the 16 x 16 shell glyph; an empty or inconsistent input allocates nothing.
 */
export const allocateCells = (
  states: { full: number; quorumOnly: number; none: number },
  cells: number,
) => {
  const counts = [states.full, states.quorumOnly, states.none].map(atLeastZero);
  const sum = counts.reduce((a, b) => a + b, 0);
  if (sum <= 0 || cells <= 0) return { full: 0, quorumOnly: 0, none: 0 };
  const exact = counts.map((c) => (c / sum) * cells);
  const out = exact.map(Math.floor);
  const order = exact
    .map((v, i) => ({ i, r: v - Math.floor(v) }))
    .sort((a, b) => b.r - a.r);
  const left = cells - out.reduce((a, b) => a + b, 0);
  for (let k = 0; k < left; k++) out[order[k % 3].i]++;
  for (let i = 0; i < 3; i++) {
    if (counts[i] > 0 && out[i] === 0) {
      const big = out.indexOf(Math.max(...out));
      out[big]--;
      out[i]++;
    }
  }
  return { full: out[0], quorumOnly: out[1], none: out[2] };
};

/**
 * SVG path runs for a `side` x `side` pixel grid filled in order with `px` cells (full, then quorum only, then
 * none): one rectangle per row segment instead of one per pixel. Unfilled cells draw nothing.
 */
export const runsFromCounts = (
  px: { full: number; quorumOnly: number; none: number },
  side = 16,
) => {
  const runs = { full: "", degraded: "", lost: "" };
  const at = (row: number, col: number): keyof typeof runs | null => {
    const i = row * side + col;
    return i < px.full
      ? "full"
      : i < px.full + px.quorumOnly
        ? "degraded"
        : i < px.full + px.quorumOnly + px.none
          ? "lost"
          : null;
  };
  for (let row = 0; row < side; row++) {
    let col = 0;
    while (col < side) {
      const s = at(row, col);
      let end = col + 1;
      while (end < side && at(row, end) === s) end++;
      if (s) runs[s] += `M${col} ${row}h${end - col}v1h-${end - col}z`;
      col = end;
    }
  }
  return runs;
};
