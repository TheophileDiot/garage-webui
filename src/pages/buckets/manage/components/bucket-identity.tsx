import { Link } from "react-router-dom";
import Chips from "@/components/ui/chips";
import { CopyLine } from "@/components/ui/copy-line";
import { bucketName, s3Uri } from "../../utils";
import { bucketPath } from "@/lib/routes";
import { textLink } from "../../styles";
import { Bucket } from "../../types";

/** Who this bucket is: its S3 address, its ID and its global aliases, each with what you need to copy or fix. */
const BucketIdentity = ({ bucket }: { bucket: Bucket }) => {
  const name = bucketName(bucket);
  const aliases = bucket.globalAliases ?? [];
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
    </dl>
  );
};

export default BucketIdentity;
