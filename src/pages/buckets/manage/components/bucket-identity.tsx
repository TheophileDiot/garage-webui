import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import Chips from "@/components/ui/chips";
import { CopyLine } from "@/components/ui/copy-line";
import { bucketName, s3Uri } from "../../utils";
import { bucketPath } from "@/lib/routes";
import { textLink } from "../../styles";
import { Bucket } from "../../types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { hit44 } from "@/components/ui/button-styles";
import { cn } from "@/lib/utils";

/**
 * Who this bucket is: its S3 address, its ID and its global aliases, each with what you need to copy or fix. On phone
 * only the address shows, with a "Details" disclosure for the ID and the aliases, so the header does not take a
 * screen on every tab.
 */
const BucketIdentity = ({ bucket }: { bucket: Bucket }) => {
  const name = bucketName(bucket);
  const aliases = bucket.globalAliases ?? [];
  const phone = useMediaQuery("(max-width: 767px)");
  const [open, setOpen] = useState(false);
  const panel = useId();

  const idRow = (
    <div className="min-w-0 max-w-full">
      <dt className="lbl">Bucket ID</dt>
      <dd className="m-0 mt-1 min-h-[30px]">
        <CopyLine
          value={bucket.id}
          label={`Copy bucket ID of ${name}`}
          className="max-w-[44ch]"
        />
      </dd>
    </div>
  );
  const aliasRow = (
    <div className="min-w-0 max-w-full">
      <dt className="lbl">Global aliases</dt>
      <dd className="m-0 mt-1 flex min-h-[30px] flex-wrap items-center gap-1.5">
        {aliases.length > 0 ? (
          aliases.map((alias) => <Chips key={alias}>{alias}</Chips>)
        ) : (
          <span className="text-ink-3">
            None.{" "}
            <Link to={bucketPath(bucket.id, "settings")} className={textLink}>
              Add one in settings
            </Link>{" "}
            to browse objects.
          </span>
        )}
      </dd>
    </div>
  );

  if (phone) {
    return (
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <CopyLine
            value={s3Uri(bucket)}
            label={`Copy S3 address of ${name}`}
            className="flex-1"
          />
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panel}
            onClick={() => setOpen((o) => !o)}
            className={cn(
              hit44,
              "inline-flex min-h-9 shrink-0 items-center gap-1 rounded px-1.5 font-medium text-link hover:underline",
            )}
          >
            Details
            <ChevronDown
              size={16}
              aria-hidden
              className={cn("transition-transform", open && "rotate-180")}
            />
          </button>
        </div>
        {open ? (
          <dl
            id={panel}
            className="m-0 mt-2 grid gap-3 rounded-lg border border-line bg-surface px-3 py-3"
          >
            {idRow}
            {aliasRow}
          </dl>
        ) : null}
      </div>
    );
  }

  return (
    <dl className="mb-4 flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-line bg-surface px-4 py-3">
      <div className="min-w-0 max-w-full">
        <dt className="lbl">S3 URI</dt>
        <dd className="m-0 mt-1 min-h-[30px]">
          <CopyLine
            value={s3Uri(bucket)}
            label={`Copy S3 address of ${name}`}
          />
        </dd>
      </div>
      {idRow}
      {aliasRow}
    </dl>
  );
};

export default BucketIdentity;
