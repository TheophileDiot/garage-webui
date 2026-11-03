import { Node } from "../types";
import { cn, handleError, readableBytes } from "@/lib/utils";
import {
  Check,
  CircleAlert,
  Network,
  RouteIcon,
  Search,
  Server,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import ConnectNodeDialog from "./connect-node-dialog";
import AssignNodeDialog from "./assign-node-dialog";
import { assignNodeDialog } from "../stores";
import {
  useApplyChanges,
  useClusterLayout,
  useRevertChanges,
  useUnassignNode,
} from "../hooks";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Button from "@/components/ui/button";
import { Meter, StatusPill } from "@/components/ui/status";
import { EmptyState } from "@/components/ui/state";
import { confirmAction } from "@/components/ui/confirm-store";

type NodeListProps = {
  nodes: Node[];
};

const NodesList = ({ nodes }: NodeListProps) => {
  const { data, refetch } = useClusterLayout();
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const unassignNode = useUnassignNode({
    onSuccess: () => {
      toast.success("Node unassigned");
      refetch();
    },
    onError: handleError,
  });

  const revertChanges = useRevertChanges({
    onSuccess: () => {
      toast.success("Layout reverted");
      refetch();
    },
    onError: handleError,
  });

  const applyChanges = useApplyChanges({
    onSuccess: () => {
      toast.success("Layout applied");
      setTimeout(refetch, 100);
      queryClient.invalidateQueries({ queryKey: ["status"] });
    },
    onError: handleError,
  });

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return nodes
      .filter((item) => {
        if (!q) return true;
        return (
          item.hostname.toLowerCase().includes(q) ||
          item.id.includes(q) ||
          item.addr.includes(q) ||
          item.role?.zone?.toLowerCase().includes(q) ||
          item.role?.tags?.some((tag) => tag.toLowerCase().includes(q))
        );
      })
      .map((item) => {
        const role = data?.roles?.find((r) => r.id === item.role?.id);
        const stagedChanges = data?.stagedRoleChanges?.find(
          (i) => i.id === item.id,
        );
        return {
          ...item,
          role: stagedChanges || role || item.role,
          isStaged: !!stagedChanges,
        };
      });
  }, [nodes, data, search]);

  const onAssign = (node: Node) => {
    assignNodeDialog.open({
      nodeId: node.id,
      zone: node.role?.zone,
      capacity: node.role?.capacity,
      tags: node.role?.tags,
    });
  };

  const onUnassign = async (node: Node) => {
    const ok = await confirmAction({
      title: "Unassign node",
      message: `Stage removal of ${node.hostname} from the layout. Nothing changes until you apply the layout.`,
      confirmLabel: "Stage removal",
      danger: true,
    });
    if (ok) unassignNode.mutate(node.id);
  };

  const onRevert = async () => {
    if (data?.version == null) return;
    const ok = await confirmAction({
      title: "Revert staged changes",
      message:
        "Discard every staged layout change and keep the current layout.",
      confirmLabel: "Revert changes",
      danger: true,
    });
    if (ok) revertChanges.mutate(data.version + 1);
  };

  const onApply = async () => {
    if (data?.version == null) return;
    const ok = await confirmAction({
      title: "Apply layout changes",
      message:
        "Garage will rebalance data across nodes. This can move a lot of data and cannot be undone once applied.",
      confirmLabel: "Apply layout",
    });
    if (ok) applyChanges.mutate(data.version + 1);
  };

  const hasStagedChanges = !!data && data.stagedRoleChanges?.length > 0;
  const busy = revertChanges.isPending || applyChanges.isPending;

  return (
    <>
      <div className="flex flex-col gap-3 p-5 pb-4 sm:flex-row sm:items-center">
        <label className="input input-bordered flex w-full items-center gap-2 sm:max-w-sm">
          <Search
            size={16}
            aria-hidden
            className="shrink-0 text-base-content/70"
          />
          <span className="sr-only">Search nodes</span>
          <input
            type="search"
            className="grow bg-transparent outline-none"
            placeholder="Search host, zone, tag or id"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="flex-1" />
        {hasStagedChanges ? (
          <div className="flex gap-2">
            <Button onClick={onRevert} disabled={busy}>
              Revert
            </Button>
            <Button
              color="primary"
              icon={Check}
              onClick={onApply}
              loading={applyChanges.isPending}
              disabled={busy}
            >
              Apply layout
            </Button>
          </div>
        ) : (
          <ConnectNodeDialog />
        )}
      </div>

      {hasStagedChanges && (
        <div
          role="status"
          className="mx-5 mb-4 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm"
        >
          <CircleAlert
            size={18}
            className="mt-0.5 shrink-0 text-warning"
            aria-hidden
          />
          <p>
            Layout changes are staged and not active yet. Apply them to start
            rebalancing, or revert to discard them.
          </p>
        </div>
      )}

      {applyChanges.data?.message ? (
        <div
          role="status"
          className="relative mx-5 mb-4 rounded-lg border border-success/40 bg-success/10 p-4 pr-12 text-sm"
        >
          <pre className="mono overflow-x-auto whitespace-pre-wrap">
            {applyChanges.data.message.join("\n")}
          </pre>
          <Button
            onClick={applyChanges.reset}
            className="absolute right-2 top-2"
            color="ghost"
            size="sm"
            icon={X}
            aria-label="Dismiss message"
          />
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={nodes.length ? Search : Server}
          title={
            nodes.length ? "No node matches your search" : "No nodes reported"
          }
        >
          {nodes.length
            ? "Try a host name, zone, tag or part of a node id."
            : "Garage did not return any node. Connect a node to get started."}
        </EmptyState>
      ) : (
        <table className="table table-stack">
          <thead>
            <tr>
              <th scope="col">Node</th>
              <th scope="col">Zone</th>
              <th scope="col">Capacity</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const removing =
                item.role != null && "remove" in item.role && item.role.remove;
              const isGateway =
                item.role != null && item.role.capacity === null;
              const free = item.dataPartition;
              return (
                <tr
                  key={item.id}
                  className={cn(
                    "row-hover",
                    item.isStaged && "bg-warning/10",
                    removing && "bg-error/10",
                  )}
                >
                  <td data-primary>
                    <p className="font-bold">{item.hostname}</p>
                    <p className="mono text-base-content/70">{item.addr}</p>
                    <p
                      className="mono max-w-[16rem] truncate text-base-content/70"
                      title={item.id}
                    >
                      {item.id}
                    </p>
                    {item.isStaged ? (
                      <p className="mt-1 text-xs font-bold text-warning">
                        {removing ? "Removal staged" : "Change staged"}
                      </p>
                    ) : null}
                  </td>
                  <td data-label="Zone">
                    <div>
                      <p className="font-bold">
                        {item.role?.zone || "Unassigned"}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1 max-md:justify-end md:max-w-[14rem]">
                        {item.role?.tags?.map((tag) => (
                          <span
                            key={tag}
                            className="rounded border border-base-300 px-1.5 py-0.5 text-xs font-bold"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td data-label="Capacity" className="md:min-w-[11rem]">
                    <div>
                      {isGateway ? (
                        <p className="inline-flex items-center gap-1.5 font-bold">
                          <Network size={16} aria-hidden /> Gateway
                        </p>
                      ) : (
                        <p className="num font-bold">
                          {item.role?.capacity
                            ? readableBytes(item.role.capacity, 1000)
                            : "Not assigned"}
                        </p>
                      )}
                      {!isGateway && free && free.total > 0 ? (
                        <div className="mt-2 md:w-44 max-md:ml-auto max-md:w-44">
                          <Meter
                            className="h-1.5"
                            max={free.total}
                            label={`${readableBytes(free.available)} free of ${readableBytes(free.total)}`}
                            segments={[
                              {
                                value: free.total - free.available,
                                className:
                                  free.available / free.total < 0.1
                                    ? "bg-error"
                                    : free.available / free.total < 0.25
                                      ? "bg-warning"
                                      : "bg-primary",
                              },
                            ]}
                          />
                          <p className="num mt-1 text-xs text-base-content/70">
                            {readableBytes(free.available)} free (
                            {Math.round((free.available / free.total) * 100)}%)
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td data-label="Status">
                    <StatusPill
                      tone={item.draining ? "warn" : item.isUp ? "ok" : "bad"}
                    >
                      {item.draining
                        ? "Draining"
                        : item.isUp
                          ? "Active"
                          : "Offline"}
                    </StatusPill>
                  </td>
                  <td data-label="" className="md:text-right">
                    <span className="inline-flex gap-1">
                      <Button
                        size="sm"
                        icon={RouteIcon}
                        onClick={() => onAssign(item)}
                        aria-label={`Assign ${item.hostname}`}
                      >
                        Assign
                      </Button>
                      {item.role != null && !removing && (
                        <Button
                          size="sm"
                          color="ghost"
                          className="text-error hover:bg-error/10"
                          icon={Trash2}
                          onClick={() => onUnassign(item)}
                          aria-label={`Remove ${item.hostname} from layout`}
                        />
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <AssignNodeDialog />
    </>
  );
};

export default NodesList;
