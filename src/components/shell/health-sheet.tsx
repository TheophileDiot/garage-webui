import { cn } from "@/lib/utils";
import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import Button from "../ui/button";
import Dialog from "../ui/dialog";
import { StatusGlyph } from "../ui/state-glyph";
import { useClusterSummary } from "./use-cluster-summary";

const toneIcon = {
  ok: { Icon: CircleCheck, cls: "text-ok" },
  warn: { Icon: TriangleAlert, cls: "text-warn" },
  bad: { Icon: CircleAlert, cls: "text-bad" },
  idle: { Icon: CircleDashed, cls: "text-ink-3" },
} as const;

/**
 * What the sidebar's health block says, for the phone: the status word with its icon, the partition glyph, node
 * and layout counts, and a way to the Cluster page. A reading that is unavailable, a failed refresh included,
 * says why and offers a retry instead of any count, exactly as the sidebar does.
 */
const HealthSheet = ({
  open,
  onClose,
  onOpenCluster,
}: {
  open: boolean;
  onClose: () => void;
  onOpenCluster: () => void;
}) => {
  const cluster = useClusterSummary();
  const { Icon, cls } = toneIcon[cluster.tone];
  const retry = cluster.failed || cluster.unavailableReason;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Cluster health"
      size="sm"
      actions={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" onClick={onOpenCluster}>
            Open cluster
          </Button>
        </>
      }
    >
      <div role="status" className="flex items-start gap-3">
        <StatusGlyph
          health={cluster.health}
          size={32}
          className="flex-none outline outline-1 outline-offset-1 outline-line"
        />
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold">
            <Icon size={18} aria-hidden className={cn("flex-none", cls)} />
            <span className="first-letter:uppercase">{cluster.word}</span>
          </p>
          <p className="mt-0.5 text-caption text-ink-3">
            {cluster.unavailableReason ??
              `${cluster.nodes} · ${cluster.layout}`}
          </p>
          {cluster.staged > 0 ? (
            <p className="mt-0.5 text-caption text-ink-3">
              {cluster.staged} staged layout{" "}
              {cluster.staged === 1 ? "change" : "changes"} waiting to be
              applied
            </p>
          ) : null}
        </div>
      </div>
      {retry ? (
        <Button
          icon={RefreshCw}
          size="sm"
          className="mt-3"
          onClick={cluster.retry}
        >
          Try again
        </Button>
      ) : null}
    </Dialog>
  );
};

export default HealthSheet;
