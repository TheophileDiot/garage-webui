import type { Node } from "./types";
import { capacityLabel, diskReading, duration, type NodeRow } from "./model.ts";

// Pure helpers for a node's compact phone row (name line, one status, one meta line). Imports only `model.ts`
// (relative, with extension), so `node --test` runs them.

export type NodeStatus = {
  word: "draining" | "active" | "offline";
  tone: "warn" | "ok" | "bad";
};

/** The status a node shows: draining wins over active, an unreachable node is offline. */
export const nodeStatus = (
  node: Pick<Node, "draining" | "isUp">,
): NodeStatus =>
  node.draining
    ? { word: "draining", tone: "warn" }
    : node.isUp
      ? { word: "active", tone: "ok" }
      : { word: "offline", tone: "bad" };

/** "seen 5 min ago" for a node that is down, `null` while it is up. */
export const nodeSeen = (
  node: Pick<Node, "isUp" | "lastSeenSecsAgo">,
): string | null =>
  node.isUp
    ? null
    : node.lastSeenSecsAgo == null
      ? "no last-seen time"
      : `seen ${duration(node.lastSeenSecsAgo)} ago`;

/**
 * The two facts under a node's name on a phone: its role (capacity, gateway, not assigned, or a staged change) and
 * its data disk. `disk` is `null` for a gateway, which stores nothing; a missing report says so and does not imply
 * the node is down. `fmt` formats the capacity, `diskFmt` (default `fmt`) the free space.
 */
export const nodeMeta = (
  r: Pick<NodeRow, "node" | "staged" | "removing" | "capacity">,
  fmt: (bytes: number) => string,
  diskFmt: (bytes: number) => string = fmt,
): { role: string; disk: string | null } => {
  const role = r.removing
    ? "removal staged"
    : r.staged
      ? `${capacityLabel(r.capacity, fmt)}, change staged`
      : capacityLabel(r.capacity, fmt);
  if (r.capacity === null) return { role, disk: null };
  const d = diskReading(r.node);
  return {
    role,
    disk: d
      ? `${diskFmt(d.free)} free (${Math.round(d.share * 100)}%)`
      : "no disk report",
  };
};
