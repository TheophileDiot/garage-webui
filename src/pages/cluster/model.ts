import { safeRatio } from "../../lib/partitions.ts";
import type {
  GetClusterLayoutResult,
  GetStatusResult,
  Node,
  Role,
  StagedRole,
} from "./types";

// Pure helpers shared by the Overview and Cluster pages. Imports only types and `lib/partitions.ts` (relative, with
// extension), so `node --test` runs them.

export type DiffLine = { sign: "+" | "-" | " "; text: string };

/** One node as the pages show it: the applied role with any staged change laid over it. */
export type NodeRow = {
  node: Node;
  /** Role in the running layout. */
  current?: Role;
  staged?: StagedRole;
  /** A removal is staged: the node keeps its current role until the layout is applied. */
  removing: boolean;
  /** Zone after staged changes; `null` = the node has no role. */
  zone: string | null;
  tags: string[];
  /** Bytes; `null` = gateway; `undefined` = no role. */
  capacity: number | null | undefined;
};

const isRemoval = (role?: Role | StagedRole | null) =>
  role != null && "remove" in role && !!role.remove;

export const shortId = (id: string) =>
  id.length > 10 ? `${id.slice(0, 8)}…` : id;

/** The layout version the pages show: from the status, else from the layout itself. */
export const layoutVersionOf = (
  status?: Pick<GetStatusResult, "layoutVersion" | "layout">,
  layout?: Pick<GetClusterLayoutResult, "version">,
): number | undefined =>
  status?.layoutVersion ?? status?.layout?.version ?? layout?.version;

/** A node's name: its hostname, else a short id (a node that is down may report none). */
export const nodeName = (node: { id: string; hostname?: string | null }) =>
  node.hostname || shortId(node.id);

/** "5 min 12 s", "2 h 3 min", "3 d 4 h". */
export const duration = (secs: number) => {
  const s = Math.max(0, Math.round(secs));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m} min ${s % 60} s` : `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
};

export const buildRows = (
  nodes: Node[],
  layout?: GetClusterLayoutResult,
): NodeRow[] =>
  nodes.map((node) => {
    const current =
      layout?.roles?.find((r) => r.id === node.id) ??
      (node.role && !isRemoval(node.role) ? (node.role as Role) : undefined);
    const staged = layout?.stagedRoleChanges?.find((s) => s.id === node.id);
    const removing = !!staged && !!staged.remove;
    const change = staged && !removing ? staged : undefined;
    const zone = change?.zone ?? current?.zone ?? null;
    const capacity =
      change && change.capacity !== undefined
        ? change.capacity
        : current?.capacity;
    return {
      node,
      current,
      staged,
      removing,
      zone: zone || null,
      tags: change?.tags ?? current?.tags ?? [],
      capacity,
    };
  });

export const matchesQuery = (row: NodeRow, query: string) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const { node } = row;
  return (
    (node.hostname ?? "").toLowerCase().includes(q) ||
    node.id.toLowerCase().includes(q) ||
    (node.addr ?? "").toLowerCase().includes(q) ||
    (row.zone ?? "").toLowerCase().includes(q) ||
    row.tags.some((tag) => tag.toLowerCase().includes(q))
  );
};

/** Distinct zones, sorted. */
export const zonesOf = (rows: NodeRow[]) =>
  [...new Set(rows.map((r) => r.zone).filter((z): z is string => !!z))].sort();

type ZoneGroup = { zone: string | null; rows: NodeRow[] };

/** Rows grouped by zone, sorted; nodes without a role last. */
export const groupByZone = (rows: NodeRow[]): ZoneGroup[] => {
  const groups: ZoneGroup[] = zonesOf(rows).map((zone) => ({
    zone,
    rows: rows.filter((r) => r.zone === zone),
  }));
  const none = rows.filter((r) => !r.zone);
  if (none.length) groups.push({ zone: null, rows: none });
  return groups;
};

export const capacityLabel = (
  capacity: number | null | undefined,
  fmt: (bytes: number) => string,
) =>
  capacity === null
    ? "gateway"
    : capacity === undefined || capacity === 0
      ? "not assigned"
      : fmt(capacity);

const roleText = (
  zone: string | null | undefined,
  capacity: number | null | undefined,
  tags: string[] | undefined,
  fmt: (bytes: number) => string,
) =>
  [
    `zone ${zone || "none"}`,
    capacityLabel(capacity, fmt),
    tags?.length ? `tags ${tags.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

/** Every staged change as diff lines: removals included, changed fields only, new assignments in full. */
export const stagedLines = (
  layout: GetClusterLayoutResult | undefined,
  rows: NodeRow[],
  fmt: (bytes: number) => string,
): DiffLine[] => {
  const lines: DiffLine[] = [];
  for (const s of layout?.stagedRoleChanges ?? []) {
    const row = rows.find((r) => r.node.id === s.id);
    const cur = layout?.roles?.find((r) => r.id === s.id) ?? row?.current;
    lines.push({
      sign: " ",
      text: `${row?.node.hostname || "unnamed node"}  ${shortId(s.id)}`,
    });
    if (s.remove) {
      lines.push(
        cur
          ? {
              sign: "-",
              text: roleText(cur.zone, cur.capacity, cur.tags, fmt),
            }
          : { sign: "-", text: "not in the layout" },
        { sign: "+", text: "removed from the layout" },
      );
      continue;
    }
    const before = {
      zone: cur?.zone,
      capacity: cur?.capacity,
      tags: cur?.tags ?? [],
    };
    const start = lines.length;
    const zoneChanged = s.zone !== undefined && s.zone !== before.zone;
    const capChanged =
      s.capacity !== undefined && s.capacity !== before.capacity;
    const tagsChanged =
      s.tags !== undefined && s.tags.join("\n") !== before.tags.join("\n");
    if (zoneChanged) {
      if (cur) lines.push({ sign: "-", text: `zone ${before.zone}` });
      lines.push({ sign: "+", text: `zone ${s.zone}` });
    }
    if (capChanged) {
      if (cur)
        lines.push({ sign: "-", text: capacityLabel(before.capacity, fmt) });
      lines.push({ sign: "+", text: capacityLabel(s.capacity, fmt) });
    }
    if (tagsChanged) {
      if (cur)
        lines.push({
          sign: "-",
          text: `tags ${before.tags.join(", ") || "none"}`,
        });
      lines.push({ sign: "+", text: `tags ${s.tags?.join(", ") || "none"}` });
    }
    if (lines.length === start)
      lines.push({ sign: " ", text: "same as the running layout" });
  }
  return lines;
};

export type ZoneSummary = {
  zone: string | null;
  nodes: number;
  up: number;
  /** Sum of layout capacities in bytes; gateways add nothing. */
  capacity: number;
  /** Free bytes on the data partitions that report. */
  free: number;
  total: number;
  reporting: number;
};

/** Free share of a data disk below which a page calls it low (warn) or nearly full (bad). */
const DISK_FREE = { warn: 0.25, bad: 0.1 } as const;

export const diskTone = (available: number, total: number) => {
  const free = available / total;
  return free < DISK_FREE.bad ? "bad" : free < DISK_FREE.warn ? "warn" : "ink";
};

/** A node's data disk: `null` when it reports none (a missing report does not imply the node is down). */
export const diskReading = (n: Pick<Node, "dataPartition">) => {
  const d = n.dataPartition;
  if (!d || !(d.total > 0)) return null;
  return {
    total: d.total,
    used: d.total - d.available,
    free: d.available,
    share: safeRatio(d.available, d.total),
  };
};

/** Total and free bytes over the rows whose node reports a data disk. */
export const sumDisks = (rows: NodeRow[]) => {
  let total = 0;
  let free = 0;
  let reporting = 0;
  for (const r of rows) {
    const d = diskReading(r.node);
    if (!d) continue;
    total += d.total;
    free += d.free;
    reporting++;
  }
  return { total, free, reporting };
};

export const summarizeZones = (rows: NodeRow[]): ZoneSummary[] =>
  groupByZone(rows).map(({ zone, rows: rs }) => ({
    zone,
    nodes: rs.length,
    up: rs.filter((r) => r.node.isUp).length,
    capacity: rs.reduce((s, r) => s + (r.capacity ?? 0), 0),
    ...sumDisks(rs),
  }));
