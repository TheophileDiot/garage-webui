import Page from "@/context/page-context";
import { useNodesHealth } from "./hooks";
import { useBuckets } from "../buckets/hooks";
import { useClusterStatus, getStatusNodes } from "../cluster/hooks";
import { cn, readableBytes } from "@/lib/utils";
import { ArrowRight, Database, RefreshCw } from "lucide-react";
import Button from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Meter, StatusPill } from "@/components/ui/status";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/state";
import { bucketName } from "../buckets/utils";
import { GetHealthResult } from "./types";

const QUORUM_COPY: Record<string, { label: string; text: string }> = {
  healthy: {
    label: "Quorum healthy",
    text: "Every partition has all of its replicas reachable.",
  },
  degraded: {
    label: "Quorum degraded",
    text: "Reads and writes still work, but some replicas are unreachable.",
  },
  unavailable: {
    label: "Quorum lost",
    text: "Some partitions cannot reach quorum. Writes to them will fail.",
  },
};

const MAX_BAYS = 24;

/** Count summary only; bays do not identify individual nodes. */
const Bays = ({ health }: { health: GetHealthResult }) => {
  const shown = Math.min(health.storageNodes, MAX_BAYS);
  return (
    <div>
      <div
        role="img"
        className="flex flex-wrap gap-1.5"
        aria-label={`Storage node count: ${health.storageNodesUp} of ${health.storageNodes} online`}
      >
        {Array.from({ length: shown }, (_, i) => {
          const up = i < health.storageNodesUp;
          return (
            <span
              aria-hidden="true"
              key={i}
              className={cn(
                "h-9 w-5 rounded-[3px] border-2",
                up
                  ? "border-success bg-success/80"
                  : "border-error bg-transparent",
              )}
            />
          );
        })}
        {health.storageNodes > MAX_BAYS ? (
          <span
            aria-hidden="true"
            className="self-center pl-1 text-sm text-base-content/70"
          >
            +{health.storageNodes - MAX_BAYS}
          </span>
        ) : null}
      </div>
    </div>
  );
};

const HomePage = () => {
  const healthQuery = useNodesHealth();
  const bucketQuery = useBuckets();
  const statusQuery = useClusterStatus();
  const health = healthQuery.data;
  const buckets = bucketQuery.data;

  const totalUsage =
    buckets?.reduce((sum, bucket) => sum + bucket.bytes, 0) ?? 0;
  const totalObjects =
    buckets?.reduce((sum, bucket) => sum + bucket.objects, 0) ?? 0;
  const largest = [...(buckets || [])]
    .sort((left, right) => right.bytes - left.bytes)
    .slice(0, 5);

  const disks = getStatusNodes(statusQuery.data).filter(
    (node) => node.dataPartition && node.dataPartition.total > 0,
  );
  const diskTotal = disks.reduce(
    (sum, node) => sum + (node.dataPartition?.total ?? 0),
    0,
  );
  const diskFree = disks.reduce(
    (sum, node) => sum + (node.dataPartition?.available ?? 0),
    0,
  );

  const quorum = health
    ? (QUORUM_COPY[health.status] ?? {
        label: "Quorum unknown",
        text: "Garage reported a status this console does not know.",
      })
    : null;
  const tone = healthQuery.isError
    ? "bad"
    : !health
      ? "idle"
      : health.status === "healthy"
        ? "ok"
        : health.status === "degraded"
          ? "warn"
          : "bad";
  const quorumOnly = health
    ? health.partitionsQuorum - health.partitionsAllOk
    : 0;
  const noQuorum = health ? health.partitions - health.partitionsQuorum : 0;

  const refresh = () => {
    void healthQuery.refetch();
    void bucketQuery.refetch();
    void statusQuery.refetch();
  };
  const updated = healthQuery.dataUpdatedAt
    ? new Date(healthQuery.dataUpdatedAt).toLocaleTimeString()
    : null;

  return (
    <div className="container space-y-6">
      <Page
        title="Overview"
        actions={
          <div className="flex items-center gap-3">
            {updated ? (
              <p className="num hidden text-xs text-base-content/70 sm:block">
                Updated {updated}
              </p>
            ) : null}
            <Button
              icon={RefreshCw}
              aria-label="Refresh overview"
              loading={healthQuery.isFetching || bucketQuery.isFetching}
              onClick={refresh}
            />
          </div>
        }
      />

      <section
        className="panel overflow-hidden"
        aria-labelledby="quorum-heading"
      >
        <div className="grid lg:grid-cols-[1.5fr_1fr]">
          <div className="panel-pad lg:p-8">
            <h2 id="quorum-heading" className="sr-only">
              Cluster quorum
            </h2>
            {healthQuery.isError ? (
              <ErrorState
                title="Cluster health unavailable"
                error={healthQuery.error}
                onRetry={() => void healthQuery.refetch()}
                className="items-start px-0 py-0 text-left"
              />
            ) : !health || !quorum ? (
              <div role="status" aria-label="Checking cluster">
                <div className="skeleton-line h-5 w-40" />
                <div className="skeleton-line mt-5 h-14 w-2/3" />
                <div className="skeleton-line mt-8 h-2.5 w-full rounded-full" />
                <span className="sr-only">Checking cluster…</span>
              </div>
            ) : (
              <>
                <StatusPill tone={tone}>{quorum.label}</StatusPill>
                <p className="display num mt-5">
                  {health.partitionsQuorum}
                  <span className="text-base-content/50">
                    {" "}
                    / {health.partitions}
                  </span>
                </p>
                <p className="mt-3 text-base font-bold">
                  partitions have quorum
                </p>
                <p className="muted mt-1 max-w-md text-sm">{quorum.text}</p>
                <Meter
                  className="mt-8"
                  max={health.partitions}
                  label={`${health.partitionsAllOk} partitions fully replicated, ${quorumOnly} with quorum only, ${noQuorum} without quorum`}
                  segments={[
                    { value: health.partitionsAllOk, className: "bg-success" },
                    { value: quorumOnly, className: "bg-warning" },
                    { value: noQuorum, className: "bg-error" },
                  ]}
                />
                <dl className="num mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-base-content/80">
                  <div className="flex items-center gap-2">
                    <dt className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-full bg-success"
                      />
                      All replicas
                    </dt>
                    <dd className="font-bold">{health.partitionsAllOk}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-full bg-warning"
                      />
                      Quorum only
                    </dt>
                    <dd className="font-bold">{quorumOnly}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-full bg-error"
                      />
                      No quorum
                    </dt>
                    <dd className="font-bold">{noQuorum}</dd>
                  </div>
                </dl>
              </>
            )}
          </div>
          <div className="border-t border-base-300 bg-base-200/40 panel-pad lg:border-l lg:border-t-0 lg:p-8">
            {health ? (
              <div className="space-y-6">
                <div>
                  <p className="label-caps">Storage nodes online</p>
                  <p className="num mt-2 text-3xl font-extrabold tracking-tight">
                    {health.storageNodesUp}
                    <span className="text-xl text-base-content/50">
                      {" "}
                      / {health.storageNodes}
                    </span>
                  </p>
                  <div className="mt-3">
                    <Bays health={health} />
                  </div>
                </div>
                <div>
                  <p className="label-caps">Nodes connected</p>
                  <p className="num mt-2 text-3xl font-extrabold tracking-tight">
                    {health.connectedNodes}
                    <span className="text-xl text-base-content/50">
                      {" "}
                      / {health.knownNodes}
                    </span>
                  </p>
                </div>
                <Link
                  to="/cluster"
                  className="link-latch inline-flex items-center gap-2 font-bold text-primary"
                >
                  Inspect cluster <ArrowRight size={16} aria-hidden />
                </Link>
              </div>
            ) : (
              <div className="space-y-6" aria-hidden>
                <div className="skeleton-line h-16 w-1/2" />
                <div className="skeleton-line h-16 w-1/2" />
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="panel panel-pad" aria-labelledby="disk-heading">
          <h2 id="disk-heading" className="title">
            Disk space on data partitions
          </h2>
          {statusQuery.isError ? (
            <ErrorState
              title="Disk usage unavailable"
              error={statusQuery.error}
              onRetry={() => void statusQuery.refetch()}
              className="items-start px-0 py-6 text-left"
            />
          ) : statusQuery.isPending ? (
            <div
              className="skeleton-line mt-5 h-16 w-full"
              role="status"
              aria-label="Loading disk usage"
            />
          ) : disks.length === 0 ? (
            <p className="muted mt-3 text-sm">
              No node reports a data partition yet.
            </p>
          ) : (
            <>
              <p className="num mt-4 text-3xl font-extrabold tracking-tight">
                {readableBytes(diskFree)}
                <span className="ml-1.5 text-base font-semibold text-base-content/70">
                  free of {readableBytes(diskTotal)}
                </span>
              </p>
              <Meter
                className="mt-4"
                max={diskTotal}
                label={`${readableBytes(diskTotal - diskFree)} used of ${readableBytes(diskTotal)}`}
                segments={[
                  {
                    value: diskTotal - diskFree,
                    className:
                      diskFree / diskTotal < 0.1
                        ? "bg-error"
                        : diskFree / diskTotal < 0.25
                          ? "bg-warning"
                          : "bg-primary",
                  },
                ]}
              />
              <p className="muted mt-3 text-xs">
                Reported by {disks.length}{" "}
                {disks.length === 1 ? "node" : "nodes"}. Replicas count once per
                node.
              </p>
            </>
          )}
        </section>

        <section
          className="panel panel-pad"
          aria-labelledby="footprint-heading"
        >
          <h2 id="footprint-heading" className="title">
            Stored data
          </h2>
          {bucketQuery.isError ? (
            <p className="muted mt-3 text-sm">Bucket totals unavailable.</p>
          ) : (
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div className="col-span-2">
                <dt className="sr-only">Total size</dt>
                <dd className="num text-3xl font-extrabold tracking-tight">
                  {buckets ? readableBytes(totalUsage) : "…"}
                </dd>
              </div>
              <div>
                <dt className="label-caps">Buckets</dt>
                <dd className="num mt-1 text-lg font-bold">
                  {buckets ? buckets.length : "…"}
                </dd>
              </div>
              <div>
                <dt className="label-caps">Objects</dt>
                <dd className="num mt-1 text-lg font-bold">
                  {buckets ? totalObjects.toLocaleString() : "…"}
                </dd>
              </div>
            </dl>
          )}
        </section>
      </div>

      <section
        className="panel overflow-hidden"
        aria-labelledby="bucket-footprint"
      >
        <div className="flex items-center justify-between gap-4 p-5 pb-3">
          <h2 id="bucket-footprint" className="title">
            Largest buckets
          </h2>
          <Link
            to="/buckets"
            className="link-latch text-sm font-bold text-primary"
          >
            All buckets
          </Link>
        </div>
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
            icon={Database}
            title="No buckets yet"
            action={
              <Button href="/buckets" color="primary">
                Create a bucket
              </Button>
            }
          >
            Buckets hold your objects. Create one to start storing data.
          </EmptyState>
        ) : (
          <table className="table table-stack">
            <thead>
              <tr>
                <th scope="col">Bucket</th>
                <th scope="col" className="md:w-1/3">
                  Share of stored data
                </th>
                <th scope="col" className="md:text-right">
                  Objects
                </th>
                <th scope="col" className="md:text-right">
                  Stored
                </th>
              </tr>
            </thead>
            <tbody>
              {largest.map((bucket) => (
                <tr key={bucket.id} className="row-hover">
                  <td data-primary>
                    <Link
                      to={`/buckets/${bucket.id}`}
                      className="link-latch block max-w-[18rem] truncate font-bold"
                    >
                      {bucketName(bucket)}
                    </Link>
                  </td>
                  <td data-label="Share" className="md:w-1/3">
                    <Meter
                      className="h-2 w-full md:max-w-xs"
                      max={totalUsage}
                      label={`${totalUsage ? Math.round((bucket.bytes / totalUsage) * 100) : 0}% of stored data`}
                      segments={[
                        { value: bucket.bytes, className: "bg-primary" },
                      ]}
                    />
                  </td>
                  <td data-label="Objects" className="md:text-right">
                    {bucket.objects.toLocaleString()}
                  </td>
                  <td data-label="Stored" className="md:text-right font-bold">
                    {readableBytes(bucket.bytes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};
export default HomePage;
