import { Bucket } from "../types";
import { Globe } from "lucide-react";
import { readableBytes } from "@/lib/utils";
import Button from "@/components/ui/button";
import { Meter } from "@/components/ui/status";
import { bucketName } from "../utils";

type Props = {
  data: Bucket & { aliases: string[] };
  largest: number;
};

/** One ledger row: name and ids on the left, usage in the middle, actions on the right. */
const BucketCard = ({ data, largest }: Props) => {
  const extra = data.aliases.slice(1);
  return (
    <li className="row-hover grid gap-4 p-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="title truncate">{bucketName(data)}</h2>
          {data.websiteAccess ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-base-300 px-2 py-0.5 text-xs font-bold text-base-content/80">
              <Globe size={12} aria-hidden /> Website
            </span>
          ) : null}
        </div>
        <p className="mono mt-1 truncate text-base-content/70" title={data.id}>
          {data.id.slice(0, 16)}…
        </p>
        {extra.length > 0 ? (
          <p className="mt-1 truncate text-xs text-base-content/70">
            Also: {extra.join(", ")}
          </p>
        ) : null}
      </div>

      <div className="min-w-0">
        <dl className="flex items-baseline justify-between gap-4">
          <div>
            <dt className="label-caps">Stored</dt>
            <dd className="num mt-0.5 text-lg font-extrabold tracking-tight">
              {readableBytes(data.bytes)}
            </dd>
          </div>
          <div className="text-right">
            <dt className="label-caps">Objects</dt>
            <dd className="num mt-0.5 text-lg font-extrabold tracking-tight">
              {data.objects.toLocaleString()}
            </dd>
          </div>
        </dl>
        <Meter
          className="mt-3 h-1.5"
          max={largest}
          label="Size relative to the largest bucket"
          segments={[{ value: data.bytes, className: "bg-primary" }]}
        />
      </div>

      <div className="flex gap-2 md:justify-end">
        <Button
          href={`/buckets/${data.id}`}
          aria-label={`Manage ${bucketName(data)}`}
        >
          Manage
        </Button>
        <Button
          color="primary"
          href={`/buckets/${data.id}?tab=browse`}
          aria-label={`Browse ${bucketName(data)}`}
        >
          Browse
        </Button>
      </div>
    </li>
  );
};

export default BucketCard;
