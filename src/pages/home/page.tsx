import Page from "@/context/page-context";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useBuckets } from "../buckets/hooks";
import {
  getStatusNodes,
  useClusterLayout,
  useClusterStatus,
  useNodeInfo,
  useNodesHealth,
} from "../cluster/hooks";
import {
  buildRows,
  capacityLabel,
  diskReading,
  diskTone,
  layoutVersionOf,
  duration,
  nodeName,
  shortId,
  stagedLines,
  sumDisks,
  zonesOf,
} from "../cluster/model";
import ZoneMark from "../cluster/components/zone-mark";
import { healthTone } from "@/lib/cluster-summary";
import { bucketPath, searchPath } from "@/lib/routes";
import { dec, readableBytes } from "@/lib/utils";
import {
  healthReading,
  ofCounts,
  partitionStates,
  safeRatio,
} from "@/lib/partitions";
import Button from "@/components/ui/button";
import { Meter, Status } from "@/components/ui/status";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/state";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { Ledger } from "@/components/ui/ledger";
import { Notice } from "@/components/ui/notice";
import PartitionPanel from "@/components/ui/partition-map";
import Diff from "@/components/ui/diff";
import { bucketName, bucketTotals } from "../buckets/utils";
import { headline, watchItems } from "./model";

const pct = (n: number, d: number) => Math.round(safeRatio(n, d) * 100);

const HomePage = () => {
  const healthQuery = useNodesHealth();
  const bucketQuery = useBuckets();
  const statusQuery = useClusterStatus();
  const layoutQuery = useClusterLayout();
  const { data: info } = useNodeInfo();
  const reading = healthReading(healthQuery.data, !!healthQuery.error);
  const health = reading.usable ? reading.health : undefined;
  const buckets = bucketQuery.data;
  const rows = useMemo(
    () => buildRows(getStatusNodes(statusQuery.data), layoutQuery.data),
    [statusQuery.data, layoutQuery.data],
  );
  const zones = useMemo(() => zonesOf(rows), [rows]);
  const version = layoutVersionOf(statusQuery.data, layoutQuery.data);
  // A missing disk report does not imply that a node is down.
  const storage = rows.filter((r) => r.capacity !== null);
  const { total: diskTotal, free: diskFree, reporting } = sumDisks(storage);
  const { bytes: storedBytes, objects: storedObjects } = bucketTotals(
    buckets ?? [],
  );
  const largest = useMemo(
    () => [...(buckets ?? [])].sort((a, b) => b.bytes - a.bytes).slice(0, 5),
    [buckets],
  );
  const states = health ? partitionStates(health) : null;
  const watch = watchItems({
    rows: statusQuery.isError ? [] : rows,
    quorumOnly: states?.quorumOnly ?? 0,
    layout: layoutQuery.isError ? undefined : layoutQuery.data,
    buckets: bucketQuery.isError ? [] : (buckets ?? []),
    name: bucketName,
    bytes: readableBytes,
    dec,
  });
  const staged = watch.find((w) => w.id === "staged");
  const otherWatch = watch.filter((w) => w.id !== "staged");
  const stagedCount = layoutQuery.data?.stagedRoleChanges?.length ?? 0;
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

  return (
    <>
      <Page title="Overview" />
      <PageHeader
        title="Overview"
        meta="Storage and cluster health"
        actions={
          <>
            {updated ? (
              <span className="text-caption text-ink-3" role="status">
                Updated {updated}
              </span>
            ) : null}
            <Button
              icon={RefreshCw}
              aria-label="Refresh overview"
              loading={
                healthQuery.isFetching ||
                bucketQuery.isFetching ||
                statusQuery.isFetching ||
                layoutQuery.isFetching
              }
              onClick={refresh}
            >
              Refresh
            </Button>
            <Button href="/cluster">Open cluster</Button>
          </>
        }
      />

      <div className="grid min-w-0 gap-4 pb-6">
        <section
          aria-label="Cluster health"
          className="flex flex-wrap items-center justify-between gap-5 rounded-lg border border-line bg-surface px-5 py-4 lg:flex-nowrap"
        >
          <div className="min-w-0 flex-[1_1_24rem]">
            <h2 className="font-cond text-title font-semibold">
              <Status
                className="!whitespace-normal [&_svg]:h-6 [&_svg]:w-6"
                tone={healthTone(health?.status, false)}
              >
                {!reading.usable && !healthQuery.isPending
                  ? "Health unavailable"
                  : title}
              </Status>
            </h2>
            <p
              className="mt-1 text-ink-2"
              role={healthQuery.isError ? "alert" : "status"}
            >
              {!reading.usable && !healthQuery.isPending
                ? reading.reason
                : text}
            </p>
            {health ? (
              <p className="mt-1 text-caption text-ink-3">
                {ofCounts(health.connectedNodes, health.knownNodes)} nodes
                connected · {health.storageNodesUp} of {health.storageNodes}{" "}
                storage nodes up
                {health.knownNodes >= health.storageNodes
                  ? ` · ${health.knownNodes - health.storageNodes} other`
                  : ""}
              </p>
            ) : !healthQuery.isPending ? (
              <Button
                className="mt-2"
                onClick={() => void healthQuery.refetch()}
              >
                Try again
              </Button>
            ) : null}
          </div>
          <dl className="grid w-full grid-cols-2 gap-x-5 gap-y-3 md:grid-cols-[0.8fr_0.9fr_1.1fr_1.8fr] lg:w-[500px] lg:shrink-0">
            {[
              ["Garage", info?.garageVersion ?? "Not reported"],
              [
                "Layout",
                version != null ? `Version ${version}` : "Not reported",
              ],
              ["Replication", "Not reported"],
              ["Database", info?.dbEngine ?? "Not reported"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="min-w-0 md:border-l md:border-line md:pl-5"
              >
                <dt className="lbl">{label}</dt>
                <dd className="mt-1 font-medium [overflow-wrap:anywhere]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {staged ? (
          <Notice
            action={
              <Link
                className="inline-flex min-h-9 items-center text-link underline underline-offset-2"
                to="/cluster"
              >
                Review in Cluster →
              </Link>
            }
          >
            <p className="font-semibold">{staged.label}</p>
            <Diff
              className="mt-1"
              lines={staged.diff ?? []}
              label="Staged layout changes"
            />
          </Notice>
        ) : null}

        <Panel
          id="nodes"
          title="Nodes"
          meta={
            health
              ? `${ofCounts(health.connectedNodes, health.knownNodes)} connected`
              : undefined
          }
          flush
        >
          {statusQuery.isPending ? (
            <SkeletonRows rows={4} label="Loading nodes" />
          ) : statusQuery.isError ? (
            <ErrorState
              title="Nodes unavailable"
              error={statusQuery.error}
              onRetry={() => void statusQuery.refetch()}
            />
          ) : (
            <>
              <Ledger
                caption="Cluster nodes"
                rows={rows}
                rowKey={(r) => r.node.id}
                empty={
                  <EmptyState title="No nodes reported">
                    Garage did not return any node.
                  </EmptyState>
                }
                columns={[
                  {
                    key: "node",
                    header: "Node",
                    mobile: "title",
                    width: "24%",
                    cell: (r) => (
                      <div className="min-w-0">
                        <Link
                          className="inline-flex min-h-9 max-w-full items-center gap-2 font-semibold text-link hover:underline"
                          title={nodeName(r.node)}
                          to={searchPath(
                            "cluster",
                            r.node.hostname || r.node.id,
                          )}
                        >
                          <ZoneMark
                            zone={r.zone}
                            zones={zones}
                            up={r.node.isUp}
                          />
                          <span className="truncate">{nodeName(r.node)}</span>
                        </Link>
                        <span
                          className="block font-mono text-caption text-ink-3"
                          title={r.node.id}
                        >
                          {shortId(r.node.id)}
                        </span>
                        <span
                          className="block font-mono text-caption text-ink-3"
                          title={r.node.addr ?? undefined}
                        >
                          {r.node.addr ?? "Not connected"}
                        </span>
                      </div>
                    ),
                  },
                  {
                    key: "zone",
                    header: "Zone",
                    width: "12%",
                    cell: (r) => (
                      <span title={r.zone ?? undefined}>
                        {r.zone ?? "No role"}
                      </span>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    width: "17%",
                    cell: (r) => (
                      <>
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
                            ? "Draining"
                            : r.node.isUp
                              ? "Connected"
                              : "Offline"}
                        </Status>
                        {!r.node.isUp ? (
                          <span className="block text-caption text-bad">
                            {r.node.lastSeenSecsAgo == null
                              ? "No last-seen time"
                              : `Last seen ${duration(r.node.lastSeenSecsAgo)} ago`}
                          </span>
                        ) : null}
                      </>
                    ),
                  },
                  {
                    key: "disk",
                    header: "Disk usage",
                    width: "25%",
                    cell: (r) => {
                      const d = diskReading(r.node);
                      return d ? (
                        <div className="grid gap-1.5">
                          <Meter
                            value={d.used}
                            max={d.total}
                            tone={diskTone(d.free, d.total)}
                            label={`${nodeName(r.node)} disk used`}
                          />
                          <span className="text-caption text-ink-2">
                            {readableBytes(d.used)} of {readableBytes(d.total)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-ink-3">
                          {r.node.isUp
                            ? "No report"
                            : "No report, node is down"}
                        </span>
                      );
                    },
                  },
                  {
                    key: "capacity",
                    header: "Layout capacity",
                    cell: (r) => (
                      <>
                        {r.staged ? (
                          <>
                            <span className="text-caption text-warn">
                              {r.removing ? "Removal staged" : "Change staged"}
                            </span>
                            <Diff
                              lines={stagedLines(
                                {
                                  version: version ?? 0,
                                  roles: r.current ? [r.current] : [],
                                  stagedRoleChanges: [r.staged],
                                },
                                [r],
                                dec,
                              )}
                              label={`Staged change for ${nodeName(r.node)}`}
                            />
                          </>
                        ) : (
                          capacityLabel(r.capacity, dec)
                        )}
                      </>
                    ),
                  },
                ]}
              />
              <p className="border-t border-line px-4 py-2 text-caption text-ink-3">
                {version != null ? `Layout v${version} · ` : ""}
                {layoutQuery.isError
                  ? "Staged changes unavailable"
                  : layoutQuery.data
                    ? `${stagedCount} ${stagedCount === 1 ? "change" : "changes"} staged`
                    : "Checking staged changes…"}
              </p>
            </>
          )}
        </Panel>

        <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="grid min-w-0 gap-4">
            <Panel
              id="stored"
              title="Stored data"
              meta={
                <Link
                  to="/buckets"
                  className="inline-flex min-h-9 items-center text-link hover:underline"
                >
                  {buckets
                    ? `View all ${buckets.length} buckets`
                    : "View all buckets"}
                </Link>
              }
              flush
            >
              {bucketQuery.isPending ? (
                <SkeletonRows label="Loading buckets" rows={3} />
              ) : bucketQuery.isError ? (
                <ErrorState
                  title="Buckets unavailable"
                  error={bucketQuery.error}
                  onRetry={() => void bucketQuery.refetch()}
                />
              ) : largest.length === 0 ? (
                <EmptyState
                  title="No buckets yet"
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
                  <dl className="grid grid-cols-2 gap-4 border-b border-line p-4">
                    <div className="flex flex-col">
                      <dt className="order-2 mt-1 text-caption text-ink-3">
                        Total size
                      </dt>
                      <dd className="fig">{readableBytes(storedBytes)}</dd>
                    </div>
                    <div className="flex flex-col">
                      <dt className="order-2 mt-1 text-caption text-ink-3">
                        Objects
                      </dt>
                      <dd className="fig">{storedObjects.toLocaleString()}</dd>
                    </div>
                  </dl>
                  <h3 className="lbl px-4 py-2.5">Largest buckets</h3>
                  <Ledger
                    caption="Largest buckets by stored size"
                    rows={largest}
                    rowKey={(b) => b.id}
                    columns={[
                      {
                        key: "bucket",
                        header: "Bucket",
                        mobile: "title",
                        width: "35%",
                        cell: (b) => (
                          <div className="min-w-0">
                            <Link
                              to={bucketPath(b.id)}
                              title={bucketName(b)}
                              className="inline-flex min-h-9 max-w-full items-center font-semibold text-link hover:underline"
                            >
                              <span className="truncate">{bucketName(b)}</span>
                            </Link>
                            <span
                              className="block font-mono text-caption text-ink-3"
                              title={b.id}
                            >
                              {shortId(b.id)}
                            </span>
                          </div>
                        ),
                      },
                      {
                        key: "objects",
                        header: "Objects",
                        align: "right",
                        cell: (b) => b.objects.toLocaleString(),
                      },
                      {
                        key: "size",
                        header: "Size",
                        align: "right",
                        cell: (b) => readableBytes(b.bytes),
                      },
                      {
                        key: "share",
                        header: "Share of stored",
                        width: "25%",
                        cell: (b) => (
                          <div className="grid gap-1.5">
                            <Meter
                              value={b.bytes}
                              max={storedBytes}
                              tone="ink"
                              label={`${bucketName(b)} share of stored data`}
                            />
                            <span className="text-caption text-ink-3">
                              {pct(b.bytes, storedBytes)}%
                            </span>
                          </div>
                        ),
                      },
                    ]}
                  />
                </>
              )}
            </Panel>
            <Panel
              id="watch"
              title="Worth a look"
              meta={
                statusQuery.isPending || bucketQuery.isPending
                  ? "Checking…"
                  : `${otherWatch.length} ${otherWatch.length === 1 ? "item" : "items"}`
              }
              flush
            >
              {statusQuery.isPending && bucketQuery.isPending ? (
                <SkeletonRows rows={3} label="Checking nodes and buckets" />
              ) : (
                <ul>
                  {failedChecks.length ? (
                    <li className="border-b border-line px-4 py-3" role="alert">
                      <Status tone="bad" className="!whitespace-normal">
                        Could not check {failedChecks.join(", ")}
                      </Status>
                      <p className="mt-1 text-ink-3">
                        Those items are not listed until the requests succeed.
                      </p>
                    </li>
                  ) : null}
                  {otherWatch.map((w) => (
                    <li
                      key={w.id}
                      className="border-b border-line last:border-b-0"
                    >
                      <Link
                        to={w.to ?? "/cluster"}
                        className="grid gap-1 px-4 py-3 hover:bg-surface-2"
                      >
                        <Status
                          tone={w.tone}
                          className="!items-baseline !whitespace-normal"
                        >
                          {w.label}
                        </Status>
                        <span className="text-caption text-ink-3">
                          {w.detail}
                        </span>
                      </Link>
                    </li>
                  ))}
                  {watch.length === 0 && failedChecks.length === 0 ? (
                    <li className="px-4 py-3 text-ink-2">
                      Nothing needs attention: every node answers, no layout
                      change is waiting, no bucket is near its quota and no
                      upload is left unfinished.
                    </li>
                  ) : otherWatch.length === 0 && failedChecks.length === 0 ? (
                    <li className="px-4 py-3 text-ink-2">
                      No other items need attention.
                    </li>
                  ) : null}
                </ul>
              )}
            </Panel>
          </div>
          <div className="grid min-w-0 gap-4">
            <Panel
              id="disk"
              title="Disk usage"
              meta={
                statusQuery.data
                  ? `${reporting} of ${storage.length} storage nodes report`
                  : undefined
              }
            >
              {statusQuery.isError ? (
                <ErrorState
                  title="Disk usage unavailable"
                  error={statusQuery.error}
                  onRetry={() => void statusQuery.refetch()}
                  className="items-start px-0 py-2 text-left"
                />
              ) : statusQuery.isPending ? (
                <SkeletonRows rows={2} label="Loading disk usage" />
              ) : reporting === 0 ? (
                <p className="text-ink-2">
                  No node reports a data partition yet.
                </p>
              ) : (
                <>
                  <p className="fig">
                    {readableBytes(diskTotal - diskFree)}
                    <small>used</small>
                  </p>
                  <p className="mt-1 text-caption text-ink-3">
                    Of {readableBytes(diskTotal)} total ·{" "}
                    {readableBytes(diskFree)} free
                  </p>
                  <Meter
                    className="mt-3"
                    value={diskTotal - diskFree}
                    max={diskTotal}
                    label={`${readableBytes(diskTotal - diskFree)} used of ${readableBytes(diskTotal)}`}
                    tone="ink"
                  />
                  <p className="mt-2 text-caption text-ink-3">
                    {pct(diskTotal - diskFree, diskTotal)}% used · replicas
                    count once per node
                  </p>
                  <ul className="mt-4 grid gap-3">
                    {storage.map((r) => {
                      const d = diskReading(r.node);
                      return (
                        <li
                          key={r.node.id}
                          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1"
                        >
                          <span className="truncate" title={nodeName(r.node)}>
                            {nodeName(r.node)}
                          </span>
                          {d ? (
                            <>
                              <span className="text-caption text-ink-2">
                                {readableBytes(d.free)} free
                              </span>
                              <Meter
                                className="col-span-2"
                                value={d.used}
                                max={d.total}
                                label={`${nodeName(r.node)} disk used`}
                                tone={diskTone(d.free, d.total)}
                              />
                            </>
                          ) : (
                            <span className="text-caption text-bad">
                              {r.node.isUp
                                ? "No report"
                                : "No report, node is down"}
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
              id="partitions"
              title="Partitions"
              meta={
                health
                  ? `${health.partitions.toLocaleString()} total`
                  : undefined
              }
            >
              <PartitionPanel
                health={healthQuery.data}
                isLoading={healthQuery.isPending}
                error={healthQuery.error}
                onRetry={() => void healthQuery.refetch()}
              />
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
};

export default HomePage;
