/**
 * What the shell and the Overview say about the cluster, from one health reading. Pure: its only import is
 * `partitions.ts`, also pure, so node --test runs this file as it is.
 */
import {
  hasPartitionCounts,
  healthReading,
  ofCounts,
  partitionStates,
  type PartitionHealth,
} from "./partitions.ts";

/** The same four literals as `Tone` in `components/ui/status.tsx`. */
export type HealthTone = "ok" | "warn" | "bad" | "idle";

/** The fields of GetClusterHealth this module reads; a partial body is a valid input. */
export type HealthBody = Partial<PartitionHealth> & {
  knownNodes?: number;
  connectedNodes?: number;
  storageNodes?: number;
  storageNodesUp?: number;
};

/**
 * Tone of a health status. A failed refresh is bad whatever is cached; no reading, or a status Garage does not
 * send (`unknown` included), is idle.
 */
export const healthTone = (
  status: string | undefined,
  failed: boolean,
): HealthTone =>
  failed
    ? "bad"
    : status === "healthy"
      ? "ok"
      : status === "degraded"
        ? "warn"
        : status === "unavailable"
          ? "bad"
          : "idle";

/**
 * The shell's cluster sentences. Never a placeholder as fact: a failed health refresh reads as unavailable even
 * when an earlier reading is still cached.
 */
export const summarizeHealth = (i: {
  health?: HealthBody;
  /** The health query's last refresh failed. */
  failed: boolean;
  layoutVersion?: number;
  /** The status query failed, so no layout version can come. */
  statusFailed: boolean;
}) => {
  const h = i.health;
  const reading = healthReading(h, i.failed);

  const word = i.failed
    ? "status unavailable"
    : !h
      ? "checking…"
      : h.status === "healthy" ||
          h.status === "degraded" ||
          h.status === "unavailable"
        ? h.status
        : "unknown";
  const tone = healthTone(h?.status, i.failed);

  // Storage nodes first: they include a configured node that is down, which "known nodes" leaves out.
  const nodeCounts =
    h && !i.failed
      ? (ofCounts(h.storageNodesUp, h.storageNodes) ??
        ofCounts(h.connectedNodes, h.knownNodes))
      : null;
  const nodes = i.failed
    ? "health request failed"
    : h
      ? nodeCounts
        ? `${nodeCounts} nodes`
        : "node counts unavailable"
      : "loading nodes…";
  const layout =
    i.layoutVersion !== undefined
      ? `layout v${i.layoutVersion}`
      : i.statusFailed
        ? "layout unavailable"
        : "layout …";
  const counted = reading.usable && hasPartitionCounts(reading.health);
  const quorumOnly = reading.usable
    ? partitionStates(reading.health).quorumOnly
    : 0;
  const onQuorum = `${quorumOnly} partitions on quorum only`;

  return {
    word,
    tone,
    nodes,
    layout,
    counted,
    quorumOnly,
    reading,
    label: `Cluster ${word}${counted ? `: ${onQuorum}` : ""}`,
    /** Starts with the text the sidebar link shows, so the accessible name contains its visible label (WCAG 2.5.3). */
    sidebarLabel: `${word} ${nodes} ${layout}${counted ? `. Cluster: ${onQuorum}` : ""}`,
  };
};
