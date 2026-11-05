import Page from "@/context/page-context";
import {
  getStatusNodes,
  useApplyChanges,
  useClusterLayout,
  useClusterStatus,
  useNodeInfo,
  useNodesHealth,
  useRevertChanges,
  useUnassignNode,
} from "./hooks";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { ErrorState, EmptyState, SkeletonRows } from "@/components/ui/state";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { SearchField } from "@/components/ui/input";
import Button from "@/components/ui/button";
import IconButton from "@/components/ui/icon-button";
import Diff from "@/components/ui/diff";
import { Ledger } from "@/components/ui/ledger";
import { Status } from "@/components/ui/status";
import { confirmAction } from "@/components/ui/confirm-store";
import { dec, readableBytes } from "@/lib/utils";
import { healthReading, ofCounts } from "@/lib/partitions";
import PartitionPanel from "@/components/ui/partition-map";
import NodeLedger from "./components/node-ledger";
import ConnectNodeDialog from "./components/connect-node-dialog";
import AssignNodeDialog from "./components/assign-node-dialog";
import { assignNodeDialog } from "./stores";
import {
  buildRows,
  groupByZone,
  layoutVersionOf,
  matchesQuery,
  NodeRow,
  nodeName,
  stagedLines,
  summarizeZones,
  ZoneSummary,
  zonesOf,
} from "./model";

const ClusterPage = () => {
  const status = useClusterStatus();
  const layoutQuery = useClusterLayout();
  const { data: info } = useNodeInfo();
  const healthQuery = useNodesHealth();
  const reading = healthReading(healthQuery.data, !!healthQuery.error);
  const health = reading.usable ? reading.health : undefined;
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const focus = params.get("node");
  const [applyMessage, setApplyMessage] = useState<string[] | null>(null);

  const layout = layoutQuery.data;
  const nodes = useMemo(() => getStatusNodes(status.data), [status.data]);
  const rows = useMemo(() => buildRows(nodes, layout), [nodes, layout]);
  const zones = useMemo(() => zonesOf(rows), [rows]);
  const visible = useMemo(
    () => rows.filter((r) => matchesQuery(r, q)),
    [rows, q],
  );
  const groups = useMemo(() => groupByZone(visible), [visible]);
  const summary = useMemo(() => summarizeZones(rows), [rows]);
  const lines = useMemo(() => stagedLines(layout, rows, dec), [layout, rows]);

  const up = rows.filter((r) => r.node.isUp).length;
  const version = layoutVersionOf(status.data, layout);
  const staged = layout?.stagedRoleChanges ?? [];
  const hasStaged = staged.length > 0;

  const unassign = useUnassignNode({
    onSuccess: () => toast.success("Node unassigned"),
  });
  const revert = useRevertChanges({
    onSuccess: () => toast.success("Layout reverted"),
  });
  const apply = useApplyChanges({
    onSuccess: () => toast.success("Layout applied"),
  });
  const busy = revert.isPending || apply.isPending;

  const setQuery = (value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set("q", value);
        else next.delete("q");
        return next;
      },
      { replace: true },
    );

  const onAssign = (row: NodeRow) =>
    assignNodeDialog.open({
      nodeId: row.node.id,
      zone: row.zone ?? undefined,
      capacity: row.capacity,
      tags: row.tags,
    });

  const onUnassign = (row: NodeRow) =>
    void confirmAction({
      title: "Unassign node",
      message: `Stage removal of ${nodeName(row.node)} from the layout. Nothing changes until you apply the layout.`,
      confirmLabel: "Stage removal",
      danger: true,
      action: () => unassign.mutateAsync(row.node.id),
    });

  const onRevert = () => {
    if (layout?.version == null) return;
    void confirmAction({
      title: "Revert staged changes",
      message:
        "Discard every staged layout change and keep the current layout.",
      confirmLabel: "Revert changes",
      danger: true,
      action: () => revert.mutateAsync(layout.version + 1),
    });
  };

  const onApply = () => {
    if (layout?.version == null) return;
    void confirmAction({
      title: `Apply layout v${layout.version + 1}`,
      message:
        "Garage will rebalance data across nodes. This can move a lot of data and cannot be undone once applied.",
      confirmLabel: "Apply layout",
      action: async () => {
        const result = await apply.mutateAsync(layout.version + 1);
        setApplyMessage(result?.message?.length ? result.message : null);
      },
    });
  };

  const meta = [
    status.data
      ? `${nodes.length} nodes in ${zones.length} ${zones.length === 1 ? "zone" : "zones"}`
      : null,
    status.data ? `${up} of ${nodes.length} up` : null,
    version != null ? `layout v${version}` : null,
    info?.garageVersion ? `Garage ${info.garageVersion}` : null,
    info?.dbEngine ?? null,
    health && ofCounts(health.partitionsQuorum, health.partitions)
      ? `${ofCounts(health.partitionsQuorum, health.partitions)} partitions with quorum`
      : null,
  ].filter(Boolean);

  return (
    <>
      <Page title="Cluster" />
      <PageHeader
        title="Cluster"
        meta={meta.length ? meta.join(" · ") : "Loading cluster details…"}
        actions={<ConnectNodeDialog />}
      />

      <div className="grid gap-4 pb-8">
        <Panel
          id="staged"
          title="Staged layout change"
          aside={
            layout
              ? hasStaged
                ? `becomes layout v${layout.version + 1}`
                : `layout v${layout.version}`
              : undefined
          }
          className={hasStaged ? "border-warn bg-warn-soft" : undefined}
        >
          {layoutQuery.isError ? (
            <div role="alert" className="grid justify-items-start gap-2">
              <p className="text-bad [overflow-wrap:anywhere]">
                Staged changes unavailable: {layoutQuery.error?.message}
              </p>
              <Button onClick={() => void layoutQuery.refetch()}>
                Try again
              </Button>
            </div>
          ) : !layout ? (
            <p className="text-ink-3" role="status">
              Loading the layout…
            </p>
          ) : hasStaged ? (
            <div className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <p className="mb-2 text-ink-2">
                  Layout changes are staged and not active yet. Apply them to
                  start rebalancing, or revert to discard them.
                </p>
                <Diff label="Staged layout changes" lines={lines} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={onRevert} disabled={busy}>
                  Revert
                </Button>
                <Button
                  variant="primary"
                  icon={Check}
                  onClick={onApply}
                  disabled={busy}
                >
                  Apply layout
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-ink-2" role="status">
              No staged changes. The running layout matches what you see below.
            </p>
          )}
        </Panel>

        {applyMessage ? (
          <Panel
            id="apply-result"
            title="Layout applied"
            aside={
              <IconButton
                icon={X}
                label="Dismiss message"
                onClick={() => setApplyMessage(null)}
              />
            }
          >
            <pre role="status" className="overflow-x-auto whitespace-pre-wrap">
              {applyMessage.join("\n")}
            </pre>
          </Panel>
        ) : null}

        <div className="max-w-sm">
          <SearchField
            label="Search nodes"
            placeholder="Host, zone, tag, address or id"
            autoComplete="off"
            value={q}
            onChange={(e) => setQuery(e.target.value)}
          />
          {q && status.data ? (
            <p className="mt-1 text-caption text-ink-3" role="status">
              {visible.length} of {rows.length} nodes match
            </p>
          ) : null}
        </div>

        {status.isPending ? (
          <Panel title="Nodes" flush>
            <SkeletonRows label="Loading nodes" rows={4} />
          </Panel>
        ) : status.isError ? (
          <Panel title="Nodes" flush>
            <ErrorState
              title="Could not load the cluster"
              error={status.error}
              onRetry={() => void status.refetch()}
            />
          </Panel>
        ) : rows.length === 0 ? (
          <Panel title="Nodes" flush>
            <EmptyState title="No nodes reported">
              Garage did not return any node. Connect a node to get started.
            </EmptyState>
          </Panel>
        ) : visible.length === 0 ? (
          <Panel title="Nodes" flush>
            <EmptyState title="No node matches your search">
              Try a host name, zone, tag, address or part of a node id.
            </EmptyState>
          </Panel>
        ) : (
          groups.map((g) => {
            const s = summary.find((z) => z.zone === g.zone);
            const label = g.zone ? `Zone ${g.zone}` : "No role";
            return (
              <Panel
                key={g.zone ?? "none"}
                id={g.zone ? `zone-${g.zone}` : "zone-none"}
                title={label}
                aside={
                  s
                    ? `${s.up} of ${s.nodes} up${g.zone ? ` · ${dec(s.capacity)}` : ""}`
                    : undefined
                }
                flush
              >
                <NodeLedger
                  zone={g.zone}
                  rows={g.rows}
                  zones={zones}
                  selectedId={focus}
                  onAssign={onAssign}
                  onUnassign={onUnassign}
                />
              </Panel>
            );
          })
        )}

        <Panel
          id="partitions"
          title="Partitions"
          meta={
            health ? `${health.partitions.toLocaleString()} total` : undefined
          }
        >
          <PartitionPanel
            health={healthQuery.data}
            isLoading={healthQuery.isPending}
            error={healthQuery.error}
            onRetry={() => void healthQuery.refetch()}
          />
        </Panel>

        {rows.length > 0 ? (
          <Panel
            id="zone-summary"
            title="Zones at a glance"
            aside="from the nodes above, staged changes included"
            flush
          >
            <Ledger<ZoneSummary>
              caption="Nodes and capacity per zone"
              rows={summary}
              rowKey={(z) => z.zone ?? "none"}
              columns={[
                {
                  key: "zone",
                  header: "Zone",
                  mobile: "title",
                  cell: (z) => z.zone ?? "no role",
                },
                {
                  key: "nodes",
                  header: "Nodes",
                  cell: (z) => (
                    <Status
                      tone={
                        z.up === z.nodes ? "ok" : z.up === 0 ? "bad" : "warn"
                      }
                    >
                      {z.up} of {z.nodes} up
                    </Status>
                  ),
                },
                {
                  key: "capacity",
                  header: "Capacity",
                  align: "right",
                  cell: (z) => (z.capacity ? dec(z.capacity) : "none"),
                },
                {
                  key: "free",
                  header: "Data disk free",
                  align: "right",
                  cell: (z) =>
                    z.reporting
                      ? `${readableBytes(z.free)} of ${readableBytes(z.total)}`
                      : "no report",
                },
              ]}
            />
          </Panel>
        ) : null}
      </div>

      <AssignNodeDialog />
    </>
  );
};

export default ClusterPage;
