import Page from "@/context/page-context";
import { getStatusNodes, useClusterStatus, useNodeInfo } from "./hooks";
import NodesList from "./components/nodes-list";
import { useMemo } from "react";
import { ErrorState, SkeletonRows } from "@/components/ui/state";
import { StatusPill } from "@/components/ui/status";
import { useNodesHealth } from "../home/hooks";

const ClusterPage = () => {
  const { data, isPending, error, refetch } = useClusterStatus();
  const { data: node } = useNodeInfo();
  const { data: health } = useNodesHealth();

  const nodes = useMemo(() => getStatusNodes(data), [data]);
  const up = nodes.filter((item) => item.isUp).length;

  return (
    <div className="container space-y-6">
      <Page title="Cluster" />

      <section className="panel panel-pad" aria-labelledby="details-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="details-heading" className="title">
            Cluster details
          </h2>
          {health ? (
            <StatusPill
              tone={
                health.status === "healthy"
                  ? "ok"
                  : health.status === "degraded"
                    ? "warn"
                    : "bad"
              }
            >
              {`${health.partitionsQuorum}/${health.partitions} partitions with quorum`}
            </StatusPill>
          ) : null}
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
          <Detail title="Garage version" value={node?.garageVersion} />
          <Detail title="Database engine" value={node?.dbEngine} />
          <Detail
            title="Layout version"
            value={data?.layoutVersion ?? data?.layout?.version}
          />
          <Detail
            title="Nodes up"
            value={data ? `${up} of ${nodes.length}` : undefined}
          />
        </dl>
      </section>

      <section
        className="panel overflow-hidden"
        aria-labelledby="nodes-heading"
      >
        <h2 id="nodes-heading" className="title px-5 pt-5">
          Nodes
        </h2>
        {isPending ? (
          <SkeletonRows label="Loading nodes" rows={4} />
        ) : error ? (
          <ErrorState
            title="Could not load the cluster"
            error={error}
            onRetry={() => void refetch()}
          />
        ) : (
          <NodesList nodes={nodes} />
        )}
      </section>
    </div>
  );
};

const Detail = ({
  title,
  value,
}: {
  title: string;
  value?: string | number | null;
}) => (
  <div>
    <dt className="label-caps">{title}</dt>
    <dd className="num mt-1 text-xl font-extrabold tracking-tight">
      {value ?? <span className="text-base-content/50">…</span>}
    </dd>
  </div>
);

export default ClusterPage;
