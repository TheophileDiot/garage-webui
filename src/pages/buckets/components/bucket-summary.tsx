import { Link } from "react-router-dom";
import { Meter, Status } from "@/components/ui/status";
import { Panel } from "@/components/ui/page-header";
import { readableBytes } from "@/lib/utils";
import { safeRatio } from "@/lib/partitions";
import { Bucket } from "../types";
import { bucketName, bucketTotals, quotaTone, quotaValue } from "../utils";

/** Lower half of the Buckets page: totals and quota usage, all from the bucket list. */
const BucketSummary = ({ buckets }: { buckets: Bucket[] }) => {
  const { bytes: totalBytes, objects: totalObjects } = bucketTotals(buckets);
  const websites = buckets.filter((b) => b.websiteAccess).length;
  const pending = buckets.filter((b) => b.unfinishedMultipartUploads > 0);
  const withQuota = buckets
    .map((b) => ({
      b,
      size: quotaValue(b.quotas?.maxSize),
      objects: quotaValue(b.quotas?.maxObjects),
    }))
    .filter((q) => q.size || q.objects)
    .sort(
      (x, y) =>
        Math.max(
          safeRatio(y.b.bytes, y.size ?? 0),
          safeRatio(y.b.objects, y.objects ?? 0),
        ) -
        Math.max(
          safeRatio(x.b.bytes, x.size ?? 0),
          safeRatio(x.b.objects, x.objects ?? 0),
        ),
    );

  const totals: Array<[string, string]> = [
    ["Buckets", buckets.length.toLocaleString()],
    ["Stored", readableBytes(totalBytes)],
    ["Objects", totalObjects.toLocaleString()],
    ["Website buckets", websites.toLocaleString()],
  ];

  return (
    <div className="mt-4 grid gap-4 pb-8 lg:grid-cols-12">
      <Panel id="totals" title="Totals" className="lg:col-span-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
          {totals.map(([label, value]) => (
            <div key={label}>
              <dt className="text-ink-3">{label}</dt>
              <dd className="text-[22px] font-bold leading-tight tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 border-t border-rule pt-3">
          <h3 className="font-medium">Unfinished multipart uploads</h3>
          {pending.length === 0 ? (
            <p className="mt-1.5">
              <Status tone="ok">none</Status>
            </p>
          ) : (
            <ul className="mt-1.5 grid gap-1">
              {pending.map((b) => (
                <li key={b.id} className="min-w-0 [overflow-wrap:anywhere]">
                  <Status tone="warn" className="whitespace-normal">
                    <span>
                      <Link to={`/buckets/${b.id}`} className="xlink">
                        {bucketName(b)}
                      </Link>
                      : {b.unfinishedMultipartUploads} holding{" "}
                      {readableBytes(b.unfinishedMultipartUploadBytes)}
                    </span>
                  </Status>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>

      <Panel
        id="quota-usage"
        title="Quota usage"
        aside={`${withQuota.length} of ${buckets.length} with a quota`}
        className="lg:col-span-7"
      >
        {withQuota.length === 0 ? (
          <p className="text-ink-3">
            No bucket has a quota. Set one on a bucket&rsquo;s overview tab.
          </p>
        ) : (
          <ul className="grid gap-3">
            {withQuota.map(({ b, size, objects }) => {
              const name = bucketName(b);
              return (
                <li key={b.id} className="grid gap-1">
                  <Link
                    to={`/buckets/${b.id}`}
                    className="xlink min-w-0 font-medium [overflow-wrap:anywhere]"
                  >
                    {name}
                  </Link>
                  {size ? (
                    <QuotaLine
                      label={`${name} size quota used`}
                      value={b.bytes}
                      max={size}
                      text={`${readableBytes(b.bytes)} of ${readableBytes(size)}`}
                    />
                  ) : null}
                  {objects ? (
                    <QuotaLine
                      label={`${name} object quota used`}
                      value={b.objects}
                      max={objects}
                      text={`${b.objects.toLocaleString()} of ${objects.toLocaleString()} objects`}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
};

const QuotaLine = ({
  label,
  value,
  max,
  text,
}: {
  label: string;
  value: number;
  max: number;
  text: string;
}) => {
  const ratio = safeRatio(value, max);
  return (
    <div className="grid items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(3rem,1fr)_auto]">
      <Meter max={max} value={value} tone={quotaTone(ratio)} label={label} />
      <span className="tabular-nums sm:text-right">
        {Math.round(ratio * 100)}% · {text}
      </span>
    </div>
  );
};

export default BucketSummary;
