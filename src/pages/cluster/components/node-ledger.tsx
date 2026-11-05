import { Ledger, LedgerColumn } from "@/components/ui/ledger";
import { Meter, Status } from "@/components/ui/status";
import Diff from "@/components/ui/diff";
import Button from "@/components/ui/button";
import IconButton from "@/components/ui/icon-button";
import { dec, readableBytes } from "@/lib/utils";
import { Network, RouteIcon, Trash2 } from "lucide-react";
import {
  capacityLabel,
  diskReading,
  diskTone,
  NodeRow,
  nodeName,
  shortId,
} from "../model";
import { nodeMeta, nodeSeen, nodeStatus } from "../phone";
import ZoneMark from "./zone-mark";

type Props = {
  zone: string | null;
  rows: NodeRow[];
  zones: string[];
  selectedId?: string | null;
  onAssign: (row: NodeRow) => void;
  onUnassign: (row: NodeRow) => void;
};

/**
 * One zone's nodes as a ledger: a table on desktop, a compact row on a phone (name, one status, one line of role
 * and disk, Assign as the trailing target). Remove is a labelled button on a line of its own, away from Assign.
 */
const NodeLedger = ({
  zone,
  rows,
  zones,
  selectedId,
  onAssign,
  onUnassign,
}: Props) => {
  const columns: LedgerColumn<NodeRow>[] = [
    {
      key: "node",
      header: "Node",
      mobile: "title",
      width: "19%",
      cell: (r) => (
        <span className="inline-flex min-w-0 items-center gap-2">
          <ZoneMark zone={r.zone} zones={zones} up={r.node.isUp} />
          <span className="min-w-0">
            <span
              className="font-medium [overflow-wrap:anywhere]"
              title={r.node.hostname}
            >
              {r.node.hostname || "unnamed node"}
            </span>{" "}
            <span
              className="block font-mono text-caption text-ink-3 max-md:hidden"
              title={r.node.id}
            >
              {shortId(r.node.id)}
            </span>
            {r.staged ? (
              <span className="block text-caption text-warn">
                {r.removing ? "removal staged" : "change staged"}
              </span>
            ) : null}
          </span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      mobile: "meta",
      width: "13%",
      cell: (r) => {
        const status = nodeStatus(r.node);
        const seen = nodeSeen(r.node);
        return (
          <span className="grid">
            <Status tone={status.tone}>{status.word}</Status>
            {seen ? (
              <span className="text-caption text-bad">{seen}</span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: "addr",
      header: "Address",
      mobile: "hide",
      width: "13%",
      cell: (r) =>
        r.node.addr ? (
          <span
            className="font-mono text-caption text-ink-2"
            title={r.node.addr}
          >
            {r.node.addr}
          </span>
        ) : (
          <span className="text-ink-3">not connected</span>
        ),
    },
    {
      key: "tags",
      header: "Tags",
      mobile: "hide",
      width: "9%",
      cell: (r) =>
        r.tags.length ? (
          <span className="text-ink-2" title={r.tags.join(", ")}>
            {r.tags.join(" · ")}
          </span>
        ) : (
          <span className="text-ink-3">none</span>
        ),
    },
    {
      key: "capacity",
      header: "Capacity",
      mobile: "hide",
      width: "12%",
      cell: (r) => {
        if (r.removing)
          return (
            <Diff
              label={`Staged removal of ${nodeName(r.node)}`}
              className="leading-5"
              lines={[
                { sign: "-", text: capacityLabel(r.current?.capacity, dec) },
                { sign: "+", text: "removed" },
              ]}
            />
          );
        const was = r.current?.capacity;
        if (r.staged && r.current && r.capacity !== was)
          return (
            <Diff
              label={`Staged capacity change for ${nodeName(r.node)}`}
              className="leading-5"
              lines={[
                { sign: "-", text: capacityLabel(was, dec) },
                { sign: "+", text: `${capacityLabel(r.capacity, dec)} staged` },
              ]}
            />
          );
        if (r.capacity === null)
          return (
            <span className="inline-flex items-center gap-1.5">
              <Network size={14} aria-hidden /> gateway
            </span>
          );
        return r.capacity ? (
          dec(r.capacity)
        ) : (
          <span className="text-ink-3">not assigned</span>
        );
      },
    },
    {
      key: "data",
      header: "Data disk",
      mobile: "hide",
      width: "16%",
      cell: (r) => {
        if (r.capacity === null) return <span className="text-ink-3">n/a</span>;
        const d = diskReading(r.node);
        if (!d) return <span className="text-bad">no report</span>;
        return (
          <span className="grid w-full gap-1.5">
            <Meter
              value={d.used}
              max={d.total}
              tone={diskTone(d.free, d.total)}
              label={`${nodeName(r.node)} data disk: ${readableBytes(d.free)} free of ${readableBytes(d.total)}`}
            />
            <span className="text-ink-2">
              {readableBytes(d.free)} free ({Math.round(d.share * 100)}%)
            </span>
          </span>
        );
      },
    },
    {
      key: "meta",
      header: "Metadata free",
      align: "right",
      mobile: "hide",
      width: "9%",
      mobileLabel: "Metadata free",
      cell: (r) =>
        r.node.metadataPartition ? (
          readableBytes(r.node.metadataPartition.available)
        ) : (
          <span className="text-ink-3">n/a</span>
        ),
    },
    {
      key: "summary",
      header: <span className="sr-only">Role and disk</span>,
      mobile: "meta",
      phoneOnly: true,
      cell: (r) => {
        const m = nodeMeta(r, dec, readableBytes);
        return (
          <span className="text-ink-2">
            {m.role}
            {m.disk ? ` · ${m.disk}` : ""}
          </span>
        );
      },
    },
    {
      key: "remove",
      header: <span className="sr-only">Remove from layout</span>,
      mobile: "meta",
      phoneOnly: true,
      className: "max-md:mt-2 max-md:w-full",
      cell: (r) =>
        (r.current || r.staged) && !r.removing ? (
          <Button
            size="sm"
            variant="danger"
            icon={Trash2}
            aria-label={`Remove ${nodeName(r.node)} from layout`}
            onClick={() => onUnassign(r)}
          >
            Remove from layout
          </Button>
        ) : null,
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      mobile: "trail",
      align: "right",
      width: "6.5rem",
      cell: (r) => (
        <span className="row-actions inline-flex gap-1">
          <IconButton
            variant="secondary"
            icon={RouteIcon}
            label={`Assign ${nodeName(r.node)}`}
            onClick={() => onAssign(r)}
          />
          {(r.current || r.staged) && !r.removing ? (
            <IconButton
              variant="ghost-danger"
              icon={Trash2}
              label={`Remove ${nodeName(r.node)} from layout`}
              onClick={() => onUnassign(r)}
              className="max-md:hidden"
            />
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <Ledger
      caption={zone ? `Nodes in zone ${zone}` : "Nodes without a role"}
      compact
      columns={columns}
      rows={rows}
      rowKey={(r) => r.node.id}
      selectedKey={selectedId}
    />
  );
};

export default NodeLedger;
