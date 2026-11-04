import type { Tone } from "@/components/ui/status";
import { getStatusNodes, useClusterStatus } from "@/pages/cluster/hooks";
import { layoutVersionOf } from "@/pages/cluster/model";
import { useNodesHealth } from "@/pages/home/hooks";
import {
  hasPartitionCounts,
  ofCounts,
  partitionStates,
} from "@/lib/partitions";

/** What the shell says about the cluster, from the live health and status queries. Never a placeholder as fact. */
export const useClusterSummary = () => {
  const health = useNodesHealth();
  const status = useClusterStatus();
  const h = health.data;

  const layoutVersion = layoutVersionOf(status.data);

  const word = health.isError
    ? "status unavailable"
    : !h
      ? "checking…"
      : h.status === "healthy"
        ? "healthy"
        : h.status === "degraded"
          ? "degraded"
          : h.status === "unavailable"
            ? "unavailable"
            : "unknown";
  const tone: Tone = health.isError
    ? "bad"
    : !h
      ? "idle"
      : h.status === "healthy"
        ? "ok"
        : h.status === "degraded"
          ? "warn"
          : h.status === "unavailable"
            ? "bad"
            : "idle";

  const nodeCounts = h ? ofCounts(h.connectedNodes, h.knownNodes) : null;
  const nodes = h
    ? nodeCounts
      ? `${nodeCounts} nodes`
      : "node counts unavailable"
    : health.isError
      ? "health request failed"
      : "loading nodes…";
  const layout =
    layoutVersion !== undefined
      ? `layout v${layoutVersion}`
      : status.isError
        ? "layout unavailable"
        : "layout …";
  const counted = !!h && hasPartitionCounts(h);
  const quorumOnly = counted ? partitionStates(h).quorumOnly : 0;

  return {
    health: h,
    word,
    tone,
    nodes,
    layout,
    quorumOnly,
    nodeList: getStatusNodes(status.data),
    label: `Cluster ${word}${counted ? `: ${quorumOnly} partitions on quorum only` : ""}`,
    /** Starts with the text the rail link shows, so the accessible name contains its visible label (WCAG 2.5.3). */
    railLabel: `${word} ${nodes} ${layout}${counted ? `. Cluster: ${quorumOnly} partitions on quorum only` : ""}`,
  };
};
