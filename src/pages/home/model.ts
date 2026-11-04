import type { Tone } from "@/components/ui/status";
import { ofCounts } from "../../lib/partitions.ts";
import { quotaTone, quotaValue } from "../buckets/utils.ts";
import type { Bucket } from "../buckets/types";
import {
  duration,
  nodeName,
  stagedLines,
  type DiffLine,
  type NodeRow,
} from "../cluster/model.ts";
import type { GetClusterLayoutResult } from "../cluster/types";
import type { GetHealthResult } from "./types";

// Pure helpers for the Overview: the headline sentence and the "worth a look" list. Imports only types and other
// pure modules (relative, with extension), so `node --test` runs them.

/** The page's one sentence about the cluster, from the health status and counts only. */
export const headline = (
  health: GetHealthResult | undefined,
  failed: boolean,
): { title: string; text: string } => {
  if (failed && !health)
    return {
      title: "Health unavailable",
      text: "Garage did not answer the health request, so nothing about quorum is shown.",
    };
  if (!health) return { title: "Overview", text: "Checking the cluster…" };
  const { partitionsQuorum: q, partitions: p } = health;
  const known = ofCounts(q, p);
  const counts = known
    ? `${known} partitions have quorum.`
    : "Garage did not report partition counts.";
  switch (health.status) {
    case "healthy":
      return {
        title: "Healthy",
        text: `Every partition has all of its copies reachable. ${counts}`,
      };
    case "degraded":
      if (!known)
        return {
          title: "Degraded",
          text: `Some copies are unreachable. ${counts}`,
        };
      return q === p
        ? {
            title: "Degraded, quorum holds",
            text: `Reads and writes still work, but some copies are unreachable. ${counts}`,
          }
        : {
            title: "Degraded, some partitions lack quorum",
            text: `Requests to those partitions fail. ${counts}`,
          };
    case "unavailable":
      return {
        title: "Unavailable, quorum lost",
        text: `Some partitions cannot reach quorum. Writes to them will fail. ${counts}`,
      };
    default:
      return {
        title: "Status unknown",
        text: "Garage reported a status this console does not know.",
      };
  }
};

type Watch = {
  id: string;
  tone: Tone;
  label: string;
  detail?: string;
  diff?: DiffLine[];
  to?: string;
};

export type WatchBucket = Pick<
  Bucket,
  | "id"
  | "globalAliases"
  | "localAliases"
  | "bytes"
  | "unfinishedMultipartUploads"
  | "unfinishedMultipartUploadBytes"
> & { quotas?: { maxSize?: number | null } };

/** Free share of a data disk below which the Overview calls it low (warn) or nearly full (bad). */
const DISK_FREE = { warn: 0.25, bad: 0.1 } as const;

export const diskTone = (available: number, total: number) => {
  const free = available / total;
  return free < DISK_FREE.bad ? "bad" : free < DISK_FREE.warn ? "warn" : "ink";
};

/** What needs a look, in order: unreachable nodes, a staged layout, buckets near a quota, unfinished uploads. */
export const watchItems = ({
  rows,
  quorumOnly,
  layout,
  buckets,
  name,
  bytes,
  dec,
}: {
  rows: NodeRow[];
  /** Partitions on quorum only, 0 when health carries no counts. */
  quorumOnly: number;
  layout?: GetClusterLayoutResult;
  buckets: WatchBucket[];
  name: (b: WatchBucket) => string;
  bytes: (n: number) => string;
  dec: (n: number) => string;
}): Watch[] => {
  const list: Watch[] = [];
  for (const r of rows) {
    if (r.node.isUp) continue;
    list.push({
      id: `down-${r.node.id}`,
      tone: "warn",
      label: `${nodeName(r.node)} unreachable`,
      detail: `${
        r.node.lastSeenSecsAgo == null
          ? "No last-seen time reported."
          : `Last seen ${duration(r.node.lastSeenSecsAgo)} ago.`
      }${quorumOnly > 0 ? ` ${quorumOnly.toLocaleString()} partitions have quorum only.` : ""}`,
      to: `/cluster?q=${encodeURIComponent(r.node.hostname || r.node.id)}`,
    });
  }
  const stagedCount = layout?.stagedRoleChanges?.length ?? 0;
  if (stagedCount > 0)
    list.push({
      id: "staged",
      tone: "idle",
      label: `Layout change staged, not applied (${stagedCount})`,
      diff: stagedLines(layout, rows, dec),
      to: "/cluster",
    });
  for (const b of buckets) {
    const label = name(b);
    const max = quotaValue(b.quotas?.maxSize);
    if (max && quotaTone(b.bytes / max) !== "ink")
      list.push({
        id: `quota-${b.id}`,
        tone: "warn",
        label: `${label} at ${Math.round((b.bytes / max) * 100)}% of its quota`,
        detail: `${bytes(b.bytes)} of ${bytes(max)}.`,
        to: `/buckets/${b.id}`,
      });
    if (b.unfinishedMultipartUploads > 0)
      list.push({
        id: `mp-${b.id}`,
        tone: "idle",
        label: `${label} has ${b.unfinishedMultipartUploads.toLocaleString()} unfinished multipart ${b.unfinishedMultipartUploads === 1 ? "upload" : "uploads"}`,
        detail: `${bytes(b.unfinishedMultipartUploadBytes)} held by uploads that never completed.`,
        to: `/buckets/${b.id}`,
      });
  }
  return list;
};
