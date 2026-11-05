import { ReactNode } from "react";
import { Meter, Status } from "@/components/ui/status";
import { SummaryStrip } from "@/components/ui/summary-strip";
import { readableBytes } from "@/lib/utils";
import {
  quotaAmount,
  quotaFraction,
  quotaPercent,
  quotaTone,
  quotaUses,
  QuotaUse,
} from "../../utils";
import { useBucketContext } from "../context";

/** "412.0 GB" as a figure with a muted unit. */
const Figure = ({ text }: { text: string }) => {
  const [n, unit] = text.split(" ");
  return (
    <>
      {n}
      {unit ? <small>{unit}</small> : null}
    </>
  );
};

/** Size, objects, quota and unfinished uploads of the bucket, above every tab. */
const BucketFacts = () => {
  const { bucket } = useBucketContext();
  const uses = quotaUses(bucket);
  // The quota closest to its limit leads; the other one is written under it.
  const lead = uses.reduce<QuotaUse | undefined>(
    (a, b) => (a && a.ratio >= b.ratio ? a : b),
    undefined,
  );
  const other = uses.find((q) => q !== lead);
  const tone = lead ? quotaTone(lead.ratio) : "ink";

  const quota: ReactNode = lead ? (
    <>
      {quotaPercent(lead)}%<small>of {quotaAmount(lead.kind, lead.max)}</small>
    </>
  ) : (
    <span className="text-ink-3">No limit</span>
  );

  const pending = bucket.unfinishedMultipartUploads;

  return (
    <SummaryStrip
      label="Bucket summary"
      className="mb-4"
      items={[
        {
          label: "Size",
          value: <Figure text={readableBytes(bucket.bytes)} />,
        },
        { label: "Objects", value: bucket.objects.toLocaleString() },
        {
          label: "Quota",
          value: quota,
          detail: lead ? (
            <div className="grid gap-1.5 text-caption text-ink-2">
              <Meter
                max={lead.max}
                value={lead.used}
                tone={tone}
                label={`${lead.kind === "size" ? "Size" : "Object"} quota used`}
                compact
              />
              {tone === "bad" ? (
                <Status tone="bad">Quota full</Status>
              ) : tone === "warn" ? (
                <Status tone="warn">Near the limit</Status>
              ) : null}
              {other ? (
                <span className="tabular-nums">
                  {quotaPercent(other)}% · {quotaFraction(other)}
                </span>
              ) : null}
            </div>
          ) : undefined,
        },
        {
          label: "Unfinished uploads",
          value: pending.toLocaleString(),
          detail:
            pending > 0 ? (
              <Status tone="warn" className="whitespace-normal text-caption">
                Holding {readableBytes(bucket.unfinishedMultipartUploadBytes)}
              </Status>
            ) : undefined,
        },
      ]}
    />
  );
};

export default BucketFacts;
