import Page from "@/context/page-context";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { useNodesHealth } from "./hooks";
import { useBuckets } from "../buckets/hooks";
import {
  getStatusNodes,
  useClusterLayout,
  useClusterStatus,
  useNodeInfo,
} from "../cluster/hooks";
import {
  buildRows,
  layoutVersionOf,
  duration,
  nodeName,
  zonesOf,
} from "../cluster/model";
import ZoneMark from "../cluster/components/zone-mark";
import { dec, readableBytes } from "@/lib/utils";
import {
  hasPartitionCounts,
  ofCounts,
  partitionStates,
  safeRatio,
} from "@/lib/partitions";
import Button from "@/components/ui/button";
import { Meter, Status } from "@/components/ui/status";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/state";
import { PageHeader, Panel } from "@/components/ui/page-header";
import PartitionPanel from "@/components/ui/partition-map";
import Diff from "@/components/ui/diff";
import { bucketName, bucketTotals } from "../buckets/utils";
import { diskTone, headline, watchItems } from "./model";

const pct = (n: number, d: number) => Math.round(safeRatio(n, d) * 100);

const HomePage = () => {
  const healthQuery = useNodesHealth();
  const bucketQuery = useBuckets();
  const statusQuery = useClusterStatus();
  const layoutQuery = useClusterLayout();
  const { data: info } = useNodeInfo();
  const health = healthQuery.data;
  const buckets = bucketQuery.data;

  const rows = useMemo(
    () => buildRows(getStatusNodes(statusQuery.data), layoutQuery.data),
    [statusQuery.data, layoutQuery.data],
  );
  const zones = useMemo(() => zonesOf(rows), [rows]);
  const version = layoutVersionOf(statusQuery.data, layoutQuery.data);

  // Disks: data partitions that report. A node without a report is not necessarily down.
  const storage = rows.filter((r) => r.capacity !== null);
  const reporting = storage.filter(
    (r) => (r.node.dataPartition?.total ?? 0) > 0,
  );
  const diskTotal = reporting.reduce(
    (s, r) => s + (r.node.dataPartition?.total ?? 0),
    0,
  );
  const diskFree = reporting.reduce(
    (s, r) => s + (r.node.dataPartition?.available ?? 0),
    0,
  );

  const { bytes: storedBytes, objects: storedObjects } = bucketTotals(
    buckets ?? [],
  );
  const largest = useMemo(
    () => [...(buckets ?? [])].sort((a, b) => b.bytes - a.bytes).slice(0, 5),
    [buckets],
  );

  const states =
    health && hasPartitionCounts(health) ? partitionStates(health) : null;
  const stagedCount = layoutQuery.data?.stagedRoleChanges?.length ?? 0;

  const watch = useMemo(
    () =>
      watchItems({
        rows,
        quorumOnly: states?.quorumOnly ?? 0,
        layout: layoutQuery.data,
        buckets: buckets ?? [],
        name: bucketName,
        bytes: readableBytes,
        dec,
      }),
    [rows, states, layoutQuery.data, buckets],
  );

  const failedChecks = [
    statusQuery.isError ? "node status" : null,
    layoutQuery.isError ? "staged layout" : null,
    bucketQuery.isError ? "bucket quotas and uploads" : null,
  ].filter(Boolean);

  const refresh = () => {
    void healthQuery.refetch();
    void bucketQuery.refetch();
    void statusQuery.refetch();
    void layoutQuery.refetch();
  };
  const updated = healthQuery.dataUpdatedAt
    ? new Date(healthQuery.dataUpdatedAt).toLocaleTimeString()
    : null;
  const { title, text } = headline(health, healthQuery.isError);
  const meta = [
    text,
    info?.garageVersion ? `Garage ${info.garageVersion}` : null,
    info?.dbEngine ?? null,
    version != null ? `layout v${version}` : null,
  ].filter(Boolean);

  return (
    <>
      <Page title="Overview" />
      <PageHeader
        title={title}
        meta={meta.join(" · ")}
        actions={
          <>
            {updated ? (
              <span className="text-ink-3" role="status">
                Updated {updated}
              </span>
            ) : null}
            <Button
              icon={RefreshCw}
              aria-label="Refresh overview"
              loading={
                healthQuery.isFetching ||
                bucketQuery.isFetching ||
                statusQuery.isFetching
              }
              onClick={refresh}
            >
              Refresh
            </Button>
            <Button href="/cluster" icon={ArrowUpRight}>
              Open cluster
            </Button>
          </>
        }
      />

      <div className="grid gap-4 pb-6 lg:grid-cols-12">
        <Panel
          id="watch"
          title="Worth a look"
          aside={
            statusQuery.isPending || bucketQuery.isPending
              ? "checking…"
              : `${watch.length} ${watch.length === 1 ? "item" : "items"}`
          }
          flush
          className="max-lg:order-1 lg:order-3 lg:col-span-7"
        >
          {statusQuery.isPending && bucketQuery.isPending ? (
            <SkeletonRows rows={3} label="Checking nodes and buckets" />
          ) : (
            <ul className="grid">
              {failedChecks.length ? (
                <li className="border-b border-rule px-3 py-2.5" role="alert">
                  <Status tone="bad" className="!whitespace-normal">
                    Could not check {failedChecks.join(", ")}
                  </Status>
                  <p className="pl-[15px] text-ink-3">
                    Those items are not listed until the requests succeed.
                  </p>
                </li>
              ) : null}
              {watch.map((w) => {
                const body = (
                  <>
                    <Status
                      tone={w.tone}
                      className="!items-baseline !whitespace-normal"
                    >
                      {w.label}
                    </Status>
                    {w.diff ? (
                      <Diff
                        lines={w.diff}
                        label="Staged layout changes"
                        className="pl-[15px]"
                      />
                    ) : (
                      <span className="pl-[15px] text-ink-3">{w.detail}</span>
                    )}
                  </>
                );
                return (
                  <li
                    key={w.id}
                    className="border-b border-rule last:border-b-0"
                  >
                    {w.to ? (
                      <Link
                        to={w.to}
                        className="caret-row grid gap-0.5 px-3 py-2.5"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="grid gap-0.5 px-3 py-2.5">{body}</div>
                    )}
                  </li>
                );
              })}
              {watch.length === 0 && failedChecks.length === 0 ? (
                <li className="px-3 py-2.5 text-ink-2">
                  Nothing needs attention: every node answers, no layout change
                  is waiting, no bucket is near its quota and no upload is left
                  unfinished.
                </li>
              ) : null}
            </ul>
          )}
        </Panel>

        <Panel
          id="partitions"
          title="Partitions"
          aside={
            health && health.partitions > 0
              ? `${health.partitions.toLocaleString()} partitions`
              : undefined
          }
          className="max-lg:order-2 lg:order-1 lg:col-span-12"
        >
          <PartitionPanel
            health={health}
            isLoading={healthQuery.isPending}
            error={healthQuery.error}
            onRetry={() => void healthQuery.refetch()}
          />
        </Panel>

        <Panel
          id="nodes"
          title="Nodes"
          aside={
            health && ofCounts(health.connectedNodes, health.knownNodes)
              ? `${ofCounts(health.connectedNodes, health.knownNodes)} connected`
              : undefined
          }
          flush
          className="max-lg:order-3 lg:order-2 lg:col-span-5"
        >
          {statusQuery.isPending ? (
            <SkeletonRows rows={4} label="Loading nodes" />
          ) : statusQuery.isError ? (
            <ErrorState
              title="Nodes unavailable"
              error={statusQuery.error}
              onRetry={() => void statusQuery.refetch()}
              className="py-6"
            />
          ) : (
            <>
              <ul>
                {rows.map((r) => (
                  <li key={r.node.id}>
                    <Link
                      to={`/cluster?q=${encodeURIComponent(r.node.hostname || r.node.id)}`}
                      className="caret-row grid min-h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-b border-rule px-3 py-1.5"
                    >
                      <span className="min-w-0">
                        <span className="font-medium [overflow-wrap:anywhere]">
                          {nodeName(r.node)}
                        </span>{" "}
                        <span className="text-ink-3">
                          {r.zone ?? "no role"}
                        </span>
                        {!r.node.isUp ? (
                          <span className="block text-caption text-bad">
                            {r.node.lastSeenSecsAgo == null
                              ? "no last-seen time"
                              : `last seen ${duration(r.node.lastSeenSecsAgo)} ago`}
                          </span>
                        ) : null}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <ZoneMark
                          zone={r.zone}
                          zones={zones}
                          up={r.node.isUp}
                        />
                        <Status
                          tone={
                            r.node.draining
                              ? "warn"
                              : r.node.isUp
                                ? "ok"
                                : "bad"
                          }
                        >
                          {r.node.draining
                            ? "draining"
                            : r.node.isUp
                              ? "up"
                              : "down"}
                        </Status>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {health &&
              ofCounts(health.storageNodesUp, health.storageNodes) ? (
                <p className="px-3 py-2 text-ink-3">
                  {health.storageNodes} storage nodes, {health.storageNodesUp}{" "}
                  up
                  {health.knownNodes >= health.storageNodes
                    ? ` · ${health.knownNodes - health.storageNodes} other`
                    : ""}
                </p>
              ) : null}
              <p className="border-t border-rule px-3 py-2 text-ink-3">
                {version != null ? `layout v${version} · ` : ""}
                {layoutQuery.isError
                  ? "staged changes unavailable"
                  : layoutQuery.data
                    ? `${stagedCount} ${stagedCount === 1 ? "change" : "changes"} staged`
                    : "checking staged changes…"}
              </p>
            </>
          )}
        </Panel>

        <Panel
          id="disk"
          title="Disk"
          aside={
            statusQuery.data
              ? `${reporting.length} of ${storage.length} storage nodes report`
              : undefined
          }
          className="max-lg:order-4 lg:order-4 lg:col-span-5"
        >
          {statusQuery.isError ? (
            <ErrorState
              title="Disk usage unavailable"
              error={statusQuery.error}
              onRetry={() => void statusQuery.refetch()}
              className="items-start px-0 py-2 text-left"
            />
          ) : statusQuery.isPending ? (
            <div
              role="status"
              aria-label="Loading disk usage"
              className="grid gap-2"
            >
              <div className="h-6 w-2/3 bg-rule" />
              <div className="h-2 w-full bg-rule" />
            </div>
          ) : reporting.length === 0 ? (
            <p className="text-ink-2">No node reports a data partition yet.</p>
          ) : (
            <>
              <p className="text-[26px] font-bold leading-none">
                {readableBytes(diskFree)}{" "}
                <span className="text-body font-normal text-ink-3">
                  free of {readableBytes(diskTotal)}
                </span>
              </p>
              <Meter
                className="mt-3"
                value={diskTotal - diskFree}
                max={diskTotal}
                label={`${readableBytes(diskTotal - diskFree)} used of ${readableBytes(diskTotal)}`}
                tone="ink"
              />
              <p className="mt-1.5 text-ink-3">
                {pct(diskTotal - diskFree, diskTotal)}% used · replicas count
                once per node
              </p>
              <ul className="mt-4 grid gap-2.5">
                {storage.map((r) => {
                  const d = r.node.dataPartition;
                  const ok = !!d && d.total > 0;
                  return (
                    <li
                      key={r.node.id}
                      className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3"
                    >
                      <span className="truncate" title={nodeName(r.node)}>
                        {nodeName(r.node)}
                      </span>
                      {ok ? (
                        <>
                          <Meter
                            value={d.total - d.available}
                            max={d.total}
                            label={`${nodeName(r.node)} disk used`}
                            tone={diskTone(d.available, d.total)}
                          />
                          <span className="text-right text-ink-2">
                            {readableBytes(d.available)} free
                          </span>
                        </>
                      ) : (
                        <span className="col-span-2 text-bad">
                          {r.node.isUp
                            ? "no report"
                            : "no report, node is down"}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Panel>

        <Panel
          id="stored"
          title="Stored data"
          aside={
            <Link
              to="/buckets"
              className="xlink inline-flex items-center gap-2"
            >
              {buckets ? `all ${buckets.length} buckets` : "all buckets"}
            </Link>
          }
          className="max-lg:order-5 lg:order-5 lg:col-span-7"
        >
          {bucketQuery.isPending ? (
            <SkeletonRows label="Loading buckets" rows={3} />
          ) : bucketQuery.isError ? (
            <ErrorState
              title="Buckets unavailable"
              error={bucketQuery.error}
              onRetry={() => void bucketQuery.refetch()}
              className="items-start px-0 py-2 text-left"
            />
          ) : largest.length === 0 ? (
            <EmptyState
              title="No buckets yet"
              className="px-0 py-4"
              action={
                <Button href="/buckets" variant="primary">
                  Create a bucket
                </Button>
              }
            >
              Buckets hold your objects. Create one to start storing data.
            </EmptyState>
          ) : (
            <>
              <p className="text-[26px] font-bold leading-none">
                {readableBytes(storedBytes)}{" "}
                <span className="text-body font-normal text-ink-3">
                  in {storedObjects.toLocaleString()} objects across{" "}
                  {buckets?.length}{" "}
                  {buckets?.length === 1 ? "bucket" : "buckets"}
                </span>
              </p>
              <ul className="mt-4 grid gap-2.5">
                {largest.map((b) => {
                  const name = bucketName(b);
                  return (
                    <li
                      key={b.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto]"
                    >
                      <Link
                        to={`/buckets/${b.id}`}
                        className="xlink min-w-0 truncate"
                        title={name}
                      >
                        <span className="text-ink-3">s3://</span>
                        {name}
                      </Link>
                      <span className="text-right sm:order-3 sm:w-48">
                        {readableBytes(b.bytes)}{" "}
                        <span className="text-ink-3">
                          {pct(b.bytes, storedBytes)}%
                        </span>
                        <span className="block text-caption text-ink-3">
                          {b.objects.toLocaleString()}{" "}
                          {b.objects === 1 ? "object" : "objects"}
                        </span>
                      </span>
                      <Meter
                        className="col-span-2 sm:order-2 sm:col-span-1"
                        value={b.bytes}
                        max={storedBytes}
                        tone="gold"
                        label={`${name} share of stored data`}
                      />
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Panel>
      </div>
    </>
  );
};

export default HomePage;
