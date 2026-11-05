import { Link } from "react-router-dom";
import {
  CircleX,
  FolderOpen,
  Globe,
  Settings,
  TriangleAlert,
} from "lucide-react";
import { Ledger, LedgerChevron, LedgerColumn } from "@/components/ui/ledger";
import CopyButton from "@/components/ui/copy-button";
import IconButton from "@/components/ui/icon-button";
import { Meter, Status } from "@/components/ui/status";
import { cn, readableBytes } from "@/lib/utils";
import { bucketPath } from "@/lib/routes";
import { Bucket } from "../types";
import {
  bucketTotals,
  grantedKeys,
  QuotaUse,
  quotaAmount,
  quotaPercent,
  quotaTone,
  quotaUses,
  s3Uri,
} from "../utils";
import { textLink } from "../styles";

export type BucketRow = Bucket & {
  name: string;
  /** Every alias, global first, then local. */
  aliases: string[];
};

/** One quota as a bar and its numbers. The icon and the word, not the colour, carry a warning. */
const QuotaLine = ({ q, name }: { q: QuotaUse; name: string }) => {
  const tone = quotaTone(q.ratio);
  const of = quotaAmount(q.kind, q.max);
  return (
    <span className="grid grid-cols-[minmax(48px,1fr)_auto] items-center gap-2.5">
      <Meter
        max={q.max}
        value={q.used}
        tone={tone}
        label={`${name} ${q.kind} quota used`}
        compact
      />
      <span className="whitespace-nowrap tabular-nums">
        {tone !== "ink" ? (
          <>
            {tone === "bad" ? (
              <CircleX
                size={14}
                aria-hidden
                className="mr-1 inline align-[-2px] text-bad"
              />
            ) : (
              <TriangleAlert
                size={14}
                aria-hidden
                className="mr-1 inline align-[-2px] text-warn"
              />
            )}
            <span className="sr-only">
              {tone === "bad" ? "Quota full: " : "Near the quota: "}
            </span>
          </>
        ) : null}
        <b className="font-semibold">{quotaPercent(q)}%</b>{" "}
        <span className="text-ink-2">of {of}</span>
      </span>
    </span>
  );
};

/** The buckets table: name and short ID, objects, size, quota bars, website, keys, row actions and a totals row. */
const BucketLedger = ({
  rows,
  total,
}: {
  rows: BucketRow[];
  /** Buckets before the search filter, for the totals label. */
  total: number;
}) => {
  const { bytes, objects } = bucketTotals(rows);
  const websites = rows.filter((b) => b.websiteAccess).length;

  const columns: LedgerColumn<BucketRow>[] = [
    {
      key: "bucket",
      header: "Bucket",
      mobile: "title",
      width: "27%",
      cell: (b) => {
        const extra = b.aliases.filter((a) => a !== b.name);
        const unfinished = b.unfinishedMultipartUploads;
        return (
          <span className="block min-w-0">
            <Link
              to={bucketPath(b.id)}
              title={b.name}
              className="block min-h-6 truncate font-medium leading-6 text-ink hover:underline hover:underline-offset-2 max-md:flex touch:min-h-9 max-md:items-center max-md:whitespace-normal max-md:leading-snug max-md:[overflow-wrap:anywhere]"
            >
              {b.name}
            </Link>
            <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-caption text-ink-3">
              <span className="font-mono font-normal" title={b.id}>
                {b.id.slice(0, 8)}
              </span>
              {extra.length > 0 ? (
                <span title={`Also: ${extra.join(", ")}`}>
                  +{extra.length} {extra.length === 1 ? "alias" : "aliases"}
                  <span className="sr-only">: {extra.join(", ")}</span>
                </span>
              ) : null}
              {(b.globalAliases?.length ?? 0) === 0 ? (
                <span title="No global alias: object browsing needs one">
                  local alias only
                </span>
              ) : null}
              {unfinished > 0 ? (
                <Status tone="warn" className="text-caption">
                  {unfinished} unfinished{" "}
                  {unfinished === 1 ? "upload" : "uploads"}
                </Status>
              ) : null}
            </span>
          </span>
        );
      },
    },
    {
      key: "objects",
      header: "Objects",
      align: "right",
      width: "9%",
      mobile: "meta",
      cell: (b) => (
        <span className="tabular-nums">
          {b.objects.toLocaleString()}
          <span className="md:hidden">
            {b.objects === 1 ? " object" : " objects"}
          </span>
        </span>
      ),
    },
    {
      key: "size",
      header: "Size",
      align: "right",
      width: "9%",
      mobile: "meta",
      cell: (b) => (
        <span className="tabular-nums">{readableBytes(b.bytes)}</span>
      ),
    },
    {
      key: "quota",
      header: "Quota",
      width: "23%",
      mobile: "meta",
      cell: (b) => {
        const uses = quotaUses(b);
        return uses.length ? (
          <span className="grid gap-1.5">
            {uses.map((q) => (
              <QuotaLine key={q.kind} q={q} name={b.name} />
            ))}
          </span>
        ) : (
          <span className="text-ink-3 max-md:hidden">No quota</span>
        );
      },
    },
    {
      key: "website",
      header: "Website",
      width: "11%",
      mobile: "meta",
      cell: (b) =>
        b.websiteAccess ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-caption font-medium text-link">
            <Globe size={13} aria-hidden />
            Website
          </span>
        ) : (
          <span className="max-md:hidden">
            <span aria-hidden className="text-ink-3">
              —
            </span>
            <span className="sr-only">Not served as a website</span>
          </span>
        ),
    },
    {
      key: "keys",
      header: "Keys",
      align: "right",
      width: "6%",
      cell: (b) => {
        const n = grantedKeys(b.keys).length;
        return n > 0 ? (
          <Link
            to={bucketPath(b.id, "access")}
            aria-label={`${n} ${n === 1 ? "key" : "keys"} with access to ${b.name}`}
            className={cn(textLink, "min-w-6 justify-center tabular-nums")}
          >
            {n}
          </Link>
        ) : (
          <span className="tabular-nums text-ink-3">0</span>
        );
      },
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      width: "9.5rem",
      cell: (b) => (
        <div className="row-actions">
          <IconButton
            label={`Browse objects of ${b.name}`}
            icon={FolderOpen}
            href={bucketPath(b.id, "objects")}
          />
          <IconButton
            label={`Settings of ${b.name}`}
            icon={Settings}
            href={bucketPath(b.id, "settings")}
          />
          <CopyButton
            value={s3Uri(b)}
            label={`Copy S3 address of ${b.name}`}
            iconOnly
            className="touch:h-9 touch:w-9 desk:h-[34px] desk:w-[34px]"
          />
        </div>
      ),
    },
    {
      key: "open",
      header: <span className="sr-only">Open</span>,
      mobile: "trail",
      phoneOnly: true,
      cell: (b) => (
        <LedgerChevron to={bucketPath(b.id)} label={`Open ${b.name}`} />
      ),
    },
  ];

  return (
    <Ledger
      caption="Buckets"
      compact
      columns={columns}
      rows={rows}
      rowKey={(b) => b.id}
      footer={{
        bucket:
          rows.length === total
            ? `Total · ${total} ${total === 1 ? "bucket" : "buckets"}`
            : `Total · ${rows.length} of ${total} buckets`,
        // One element, so the phone row's flex layout cannot drop the space before the word ("26objects").
        objects: (
          <span>
            {objects.toLocaleString()}
            <span className="md:hidden">
              {objects === 1 ? " object" : " objects"}
            </span>
          </span>
        ),
        size: readableBytes(bytes),
        website: `${websites} ${websites === 1 ? "site" : "sites"}`,
      }}
    />
  );
};

export default BucketLedger;
