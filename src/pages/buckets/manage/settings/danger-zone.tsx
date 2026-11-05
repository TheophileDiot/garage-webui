import { Panel } from "@/components/ui/page-header";
import DeleteBucketButton from "../components/delete-bucket-button";
import { bucketName } from "../../utils";
import { useBucketContext } from "../context";

/** The one irreversible action on a bucket, kept apart from the settings that save by themselves. */
const DangerZone = () => {
  const { bucket } = useBucketContext();
  return (
    <Panel id="danger-zone" title="Danger zone">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-72">
          <h3 className="font-semibold">Delete this bucket</h3>
          <p className="mt-0.5 text-ink-2">
            Garage only deletes an empty bucket. Its aliases are released, and
            clients using them stop reaching it.
          </p>
        </div>
        <DeleteBucketButton id={bucket.id} name={bucketName(bucket)} />
      </div>
    </Panel>
  );
};

export default DangerZone;
