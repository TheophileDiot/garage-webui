import { readableBytes } from "@/lib/utils";
import WebsiteAccessSection from "./overview-website-access";
import AliasesSection from "./overview-aliases";
import QuotaSection from "./overview-quota";
import { useBucketContext } from "../context";

const OverviewTab = () => {
  const { bucket: data } = useBucketContext();

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.4fr]">
      <section
        className="panel panel-pad lg:sticky lg:top-0"
        aria-labelledby="usage-heading"
      >
        <h2 id="usage-heading" className="title">
          Usage
        </h2>
        <dl className="mt-5 space-y-5">
          <div>
            <dt className="label-caps">Stored</dt>
            <dd className="display num mt-2">{readableBytes(data.bytes)}</dd>
          </div>
          <div>
            <dt className="label-caps">Objects</dt>
            <dd className="num mt-1 text-2xl font-extrabold tracking-tight">
              {data.objects.toLocaleString()}
            </dd>
          </div>
          {data.unfinishedMultipartUploads > 0 ? (
            <div>
              <dt className="label-caps">Unfinished multipart uploads</dt>
              <dd className="num mt-1 text-lg font-bold">
                {data.unfinishedMultipartUploads.toLocaleString()}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section
        className="panel panel-pad divide-y divide-base-300 [&>*]:py-6 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0"
        aria-label="Bucket settings"
      >
        <AliasesSection />
        <WebsiteAccessSection />
        <QuotaSection />
      </section>
    </div>
  );
};

export default OverviewTab;
