import { Link } from "react-router-dom";
import { Meter, Status } from "@/components/ui/status";
import { Panel } from "@/components/ui/page-header";
import { cn, readableBytes } from "@/lib/utils";
import { bucketPath } from "@/lib/routes";
import { Bucket } from "../types";
import {
  bucketName,
  quotaFraction,
  quotaPercent,
  quotaTone,
  quotaUses,
} from "../utils";
import { textLink } from "../styles";

/** Lower half of the Buckets page: quota usage and unfinished uploads across the list, from the list itself. */
const BucketSummary = ({ buckets }: { buckets: Bucket[] }) => {
  const pending = buckets.filter((b) => b.unfinishedMultipartUploads > 0);
  const withQuota = buckets
    .map((b) => ({ b, uses: quotaUses(b) }))
    .filter((q) => q.uses.length > 0)
    .sort(
      (x, y) =>
        Math.max(...y.uses.map((u) => u.ratio)) -
        Math.max(...x.uses.map((u) => u.ratio)),
    );

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Panel
        id="quota-usage"
        title="Quota usage"
        meta={`${withQuota.length} of ${buckets.length} with a quota`}
      >
        {withQuota.length === 0 ? (
          <p className="text-ink-3">
            No bucket has a quota. Set one in a bucket&rsquo;s settings.
          </p>
        ) : (
          <ul className="grid gap-4">
            {withQuota.map(({ b, uses }) => {
              const name = bucketName(b);
              return (
                <li key={b.id} className="grid gap-1.5">
                  <Link
                    to={bucketPath(b.id)}
                    title={name}
                    className={cn(
                      textLink,
                      "min-w-0 justify-self-start font-medium [overflow-wrap:anywhere]",
                    )}
                  >
                    {name}
                  </Link>
                  {uses.map((q) => (
                    <div
                      key={q.kind}
                      className="grid items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(3rem,1fr)_auto]"
                    >
                      <Meter
                        max={q.max}
                        value={q.used}
                        tone={quotaTone(q.ratio)}
                        label={`${name} ${q.kind} quota used`}
                        compact
                      />
                      <span className="tabular-nums sm:text-right">
                        {quotaPercent(q)}% · {quotaFraction(q)}
                      </span>
                    </div>
                  ))}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel
        id="unfinished-uploads"
        title="Unfinished multipart uploads"
        meta={`${pending.length} ${pending.length === 1 ? "bucket" : "buckets"}`}
      >
        {pending.length === 0 ? (
          <Status tone="ok">None</Status>
        ) : (
          <ul className="grid gap-2">
            {pending.map((b) => (
              <li key={b.id} className="min-w-0 [overflow-wrap:anywhere]">
                <Status tone="warn" className="whitespace-normal">
                  <span>
                    <Link
                      to={bucketPath(b.id)}
                      title={bucketName(b)}
                      className={textLink}
                    >
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
      </Panel>
    </div>
  );
};

export default BucketSummary;
