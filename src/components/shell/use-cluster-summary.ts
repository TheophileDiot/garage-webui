import {
  getStatusNodes,
  useClusterLayout,
  useClusterStatus,
  useNodesHealth,
} from "@/pages/cluster/hooks";
import { layoutVersionOf } from "@/pages/cluster/model";
import { summarizeHealth } from "@/lib/cluster-summary";

/**
 * What the shell says about the cluster, from the live health, status and layout queries. Never a placeholder as
 * fact: a failed health refresh makes the reading unavailable even when an earlier one is still cached.
 */
export const useClusterSummary = () => {
  const health = useNodesHealth();
  const status = useClusterStatus();
  const layout = useClusterLayout();
  const {
    word,
    tone,
    nodes,
    layout: layoutText,
    quorumOnly,
    reading,
    label,
    sidebarLabel,
  } = summarizeHealth({
    health: health.data,
    failed: health.isError,
    layoutVersion: layoutVersionOf(status.data, layout.data),
    statusFailed: status.isError,
  });
  const staged = layout.data?.stagedRoleChanges?.length ?? 0;

  return {
    /** The reading the glyph may draw: only a usable one, never stale counts after a failed refresh. */
    health: reading.usable ? reading.health : undefined,
    /** Why there is no glyph, when there is none and the query is not simply loading. */
    unavailableReason:
      !reading.usable && (health.data || health.isError)
        ? reading.reason
        : null,
    failed: health.isError,
    retry: () => void health.refetch(),
    word,
    tone,
    nodes,
    layout: layoutText,
    quorumOnly,
    staged,
    nodeList: getStatusNodes(status.data),
    label,
    sidebarLabel,
  };
};
