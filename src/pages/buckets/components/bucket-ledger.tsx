import { Link } from "react-router-dom";
import { Ledger, LedgerColumn } from "@/components/ui/ledger";
import Button from "@/components/ui/button";
import { Meter, Status } from "@/components/ui/status";
import { readableBytes } from "@/lib/utils";
import { safeRatio } from "@/lib/partitions";
import { Bucket } from "../types";
import { bucketName, quotaTone, quotaValue } from "../utils";

export type BucketRow = Bucket & {
  name: string;
  /** Every alias, global first, then local. */
  aliases: string[];
};

/** The buckets table. `largest` is the biggest bucket's size, the scale of the share meter. */
const BucketLedger = ({
  rows,
  largest,
}: {
  rows: BucketRow[];
  largest: number;
}) => {
  const columns: LedgerColumn<BucketRow>[] = [
    {
      key: "bucket",
      header: "Bucket",
      mobile: "title",
      width: "24%",
      cell: (b) => {
        const hasGlobal = (b.globalAliases?.length ?? 0) > 0;
        const extra = b.aliases.filter((a) => a !== b.name);
        return (
          <span className="flex min-w-0 items-baseline gap-2">
            <Link
              to={`/buckets/${b.id}`}
              title={b.name}
              className="xlink min-w-0 truncate font-medium max-md:[overflow-wrap:anywhere] max-md:whitespace-normal"
            >
              {hasGlobal ? (
                <span className="font-normal text-ink-3">s3://</span>
              ) : null}
              {b.name}
            </Link>
            {extra.length > 0 ? (
              <span
                className="shrink-0 text-caption text-ink-3 max-md:[overflow-wrap:anywhere]"
                title={`Also: ${extra.join(", ")}`}
              >
                +{extra.length} {extra.length === 1 ? "alias" : "aliases"}
                <span className="sr-only">: {extra.join(", ")}</span>
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: "id",
      header: "ID",
      width: "11%",
      cell: (b) => (
        <span title={b.id} className="text-ink-2">
          {b.id.slice(0, 8)}…
        </span>
      ),
    },
    {
      key: "objects",
      header: "Objects",
      align: "right",
      width: "9%",
      cell: (b) => b.objects.toLocaleString(),
    },
    {
      key: "size",
      header: "Size",
      align: "right",
      width: "9%",
      cell: (b) => readableBytes(b.bytes),
    },
    {
      key: "share",
      header: "Share",
      mobileLabel: "Size vs largest",
      width: "11%",
      cell: (b) => {
        const ratio = safeRatio(b.bytes, largest);
        return (
          <span className="grid w-full grid-cols-[minmax(2rem,1fr)_auto] items-center gap-2">
            <Meter
              max={largest}
              value={b.bytes}
              label={`${b.name} size relative to the largest bucket`}
            />
            <span className="w-9 text-right tabular-nums">
              {Math.round(ratio * 100)}%
            </span>
          </span>
        );
      },
    },
    {
      key: "quota",
      header: "Quota",
      width: "17%",
      cell: (b) => {
        const size = quotaValue(b.quotas?.maxSize);
        const objects = quotaValue(b.quotas?.maxObjects);
        if (size) {
          const ratio = safeRatio(b.bytes, size);
          return (
            <span
              className="grid w-full grid-cols-[minmax(2rem,1fr)_auto] items-center gap-2"
              title={
                objects
                  ? `Object quota: ${b.objects.toLocaleString()} of ${objects.toLocaleString()}`
                  : undefined
              }
            >
              <Meter
                max={size}
                value={b.bytes}
                tone={quotaTone(ratio)}
                label={`${b.name} size quota used`}
              />
              <span className="text-right tabular-nums">
                {Math.round(ratio * 100)}% of {readableBytes(size)}
              </span>
            </span>
          );
        }
        if (objects)
          return (
            <span className="tabular-nums">
              {b.objects.toLocaleString()} of {objects.toLocaleString()} objects
            </span>
          );
        return <span className="text-ink-3">no limit</span>;
      },
    },
    {
      key: "notes",
      header: "Notes",
      width: "12%",
      cell: (b) => {
        const notes = [
          b.websiteAccess ? (
            <Status key="w" tone="ok">
              website
            </Status>
          ) : null,
          b.unfinishedMultipartUploads > 0 ? (
            <Status key="m" tone="warn">
              {b.unfinishedMultipartUploads} unfinished
            </Status>
          ) : null,
          (b.globalAliases?.length ?? 0) === 0 ? (
            <span
              key="l"
              className="text-ink-3"
              title="No global alias: object browsing needs one"
            >
              local only
            </span>
          ) : null,
        ].filter(Boolean);
        return notes.length ? (
          <span className="flex min-w-0 flex-wrap gap-x-3">{notes}</span>
        ) : (
          <span className="text-ink-3">none</span>
        );
      },
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      mobile: "actions",
      width: "9.5rem",
      cell: (b) => (
        <span className="flex gap-1.5 md:justify-end">
          <Button
            size="sm"
            href={`/buckets/${b.id}`}
            aria-label={`Manage ${bucketName(b)}`}
          >
            Manage
          </Button>
          <Button
            size="sm"
            variant="primary"
            href={`/buckets/${b.id}?tab=browse`}
            aria-label={`Browse ${bucketName(b)}`}
          >
            Browse
          </Button>
        </span>
      ),
    },
  ];

  return (
    <Ledger
      caption="Buckets"
      columns={columns}
      rows={rows}
      rowKey={(b) => b.id}
    />
  );
};

export default BucketLedger;
