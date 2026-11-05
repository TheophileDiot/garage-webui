import { Ledger, LedgerColumn } from "@/components/ui/ledger";
import { Meter, Status } from "@/components/ui/status";
import Diff from "@/components/ui/diff";
import IconButton from "@/components/ui/icon-button";
import { dec, readableBytes } from "@/lib/utils";
import { Network, RouteIcon, Trash2 } from "lucide-react";
import {
  capacityLabel,
  diskReading,
  diskTone,
  duration,
  NodeRow,
  nodeName,
  shortId,
} from "../model";
import ZoneMark from "./zone-mark";

type Props = {
  zone: string | null;
  rows: NodeRow[];
  zones: string[];
  selectedId?: string | null;
  onAssign: (row: NodeRow) => void;
  onUnassign: (row: NodeRow) => void;
};

/** One zone's nodes as a ledger: a table on desktop, labelled stacks on a phone. */
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
              className="block font-mono text-caption text-ink-3"
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
      width: "13%",
      cell: (r) => (
        <span className="grid">
          <Status tone={r.node.draining ? "warn" : r.node.isUp ? "ok" : "bad"}>
            {r.node.draining ? "draining" : r.node.isUp ? "active" : "offline"}
          </Status>
          {!r.node.isUp ? (
            <span className="text-caption text-bad">
              {r.node.lastSeenSecsAgo == null
                ? "no last-seen time"
                : `seen ${duration(r.node.lastSeenSecsAgo)} ago`}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "addr",
      header: "Address",
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
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      mobile: "actions",
      align: "right",
      width: "6.5rem",
      cell: (r) => (
        <span className="row-actions inline-flex gap-1 max-md:[&_button]:min-h-9 max-md:[&_button]:min-w-9">
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
            />
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <Ledger
      caption={zone ? `Nodes in zone ${zone}` : "Nodes without a role"}
      columns={columns}
      rows={rows}
      rowKey={(r) => r.node.id}
      selectedKey={selectedId}
    />
  );
};

export default NodeLedger;
