import { readableBytes } from "@/lib/utils";
import { Meter, Status } from "@/components/ui/status";
import { Panel } from "@/components/ui/page-header";
import { safeRatio } from "@/lib/partitions";
import WebsiteAccessSection from "./overview-website-access";
import AliasesSection from "./overview-aliases";
import QuotaSection from "./overview-quota";
import { useBucketContext } from "../context";
import { quotaTone, quotaValue } from "../../utils";

const OverviewTab = () => {
  const { bucket: data } = useBucketContext();
  const maxSize = quotaValue(data.quotas?.maxSize);
  const maxObjects = quotaValue(data.quotas?.maxObjects);
  const sizeRatio = safeRatio(data.bytes, maxSize ?? 0);
  const objectRatio = safeRatio(data.objects, maxObjects ?? 0);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-12">
      <div className="grid content-start gap-4 lg:col-span-7">
        <Panel id="usage" title="Usage">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-ink-3">Stored</p>
              <p className="text-[26px] font-bold leading-tight [overflow-wrap:anywhere]">
                {readableBytes(data.bytes)}
              </p>
            </div>
            <div>
              <p className="text-ink-3">Objects</p>
              <p className="text-[26px] font-bold leading-tight tabular-nums">
                {data.objects.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="mt-5 border-t border-rule pt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-medium">Size quota</h3>
              <p className="text-ink-2">
                {maxSize
                  ? `${readableBytes(data.bytes)} of ${readableBytes(maxSize)}`
                  : "no limit"}
              </p>
            </div>
            {maxSize ? (
              <>
                <Meter
                  className="mt-2.5"
                  value={data.bytes}
                  max={maxSize}
                  tone={quotaTone(sizeRatio)}
                  label="Size quota used"
                />
                <p
                  className={
                    sizeRatio >= 0.75 ? "mt-1.5 text-warn" : "mt-1.5 text-ink-3"
                  }
                >
                  {Math.round(sizeRatio * 100)}% used,{" "}
                  {readableBytes(Math.max(0, maxSize - data.bytes))} left
                </p>
              </>
            ) : (
              <p className="mt-1.5 text-ink-3">
                Writes are limited only by cluster disk.
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-medium">Object quota</h3>
              <p className="text-ink-2">
                {maxObjects
                  ? `${data.objects.toLocaleString()} of ${maxObjects.toLocaleString()}`
                  : "no limit"}
              </p>
            </div>
            {maxObjects ? (
              <Meter
                className="mt-2.5"
                value={data.objects}
                max={maxObjects}
                tone={quotaTone(objectRatio)}
                label="Object quota used"
              />
            ) : null}
          </div>

          <div className="mt-5 border-t border-rule pt-4">
            <h3 className="font-medium">Unfinished multipart uploads</h3>
            <p className="mt-1.5 text-ink-2">
              {data.unfinishedMultipartUploads > 0 ? (
                <Status tone="warn" className="whitespace-normal">
                  {data.unfinishedMultipartUploads.toLocaleString()}{" "}
                  {data.unfinishedMultipartUploads === 1 ? "upload" : "uploads"}{" "}
                  holding {readableBytes(data.unfinishedMultipartUploadBytes)}
                </Status>
              ) : (
                <Status tone="ok">none</Status>
              )}
            </p>
          </div>
        </Panel>

        <QuotaSection />
      </div>

      <div className="grid content-start gap-4 lg:col-span-5">
        <AliasesSection />
        <WebsiteAccessSection />
      </div>
    </div>
  );
};

export default OverviewTab;
