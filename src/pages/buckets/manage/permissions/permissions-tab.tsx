import { useDenyKey } from "../hooks";
import Button from "@/components/ui/button";
import { Check, KeySquare, Minus, Trash } from "lucide-react";
import AllowKeyDialog from "./allow-key-dialog";
import { toast } from "sonner";
import { handleError } from "@/lib/utils";
import { useBucketContext } from "../context";
import { EmptyState } from "@/components/ui/state";
import { confirmAction } from "@/components/ui/confirm-store";

const Flag = ({ on, label }: { on: boolean; label: string }) =>
  on ? (
    <span className="inline-flex items-center gap-1 font-bold text-success">
      <Check size={16} aria-hidden />
      <span className="sr-only">{label}: </span>Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-base-content/70">
      <Minus size={16} aria-hidden />
      <span className="sr-only">{label}: </span>No
    </span>
  );

const PermissionsTab = () => {
  const { bucket, refetch } = useBucketContext();

  const denyKey = useDenyKey(bucket.id, {
    onSuccess: () => {
      toast.success("Key access removed");
      refetch();
    },
    onError: handleError,
  });

  const keys = bucket.keys.filter(
    (key) =>
      key.permissions.read || key.permissions.write || key.permissions.owner,
  );

  const onRemove = async (id: string, label: string) => {
    const ok = await confirmAction({
      title: "Remove key access",
      message: `Remove ${label} from this bucket? The key itself stays available for other buckets.`,
      confirmLabel: "Remove access",
      danger: true,
    });
    if (ok) {
      denyKey.mutate({
        keyId: id,
        permissions: { read: true, write: true, owner: true },
      });
    }
  };

  return (
    <section className="panel overflow-hidden" aria-labelledby="keys-heading">
      <div className="flex flex-row items-center gap-3 p-5">
        <h2 id="keys-heading" className="title flex-1 truncate">
          Keys with access
        </h2>
        <AllowKeyDialog currentKeys={keys.map((key) => key.accessKeyId)} />
      </div>

      {keys.length === 0 ? (
        <EmptyState icon={KeySquare} title="No key can use this bucket">
          Allow a key with read and write access to browse and fill this bucket.
        </EmptyState>
      ) : (
        <table className="table table-stack">
          <thead>
            <tr>
              <th scope="col">Key</th>
              <th scope="col">Local aliases</th>
              <th scope="col">Read</th>
              <th scope="col">Write</th>
              <th scope="col">Owner</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => {
              const label = key.name || key.accessKeyId.substring(0, 8);
              return (
                <tr key={key.accessKeyId} className="row-hover">
                  <td data-primary className="font-bold">
                    {label}
                  </td>
                  <td data-label="Local aliases">
                    {key.bucketLocalAliases?.join(", ") || "None"}
                  </td>
                  <td data-label="Read">
                    <Flag on={key.permissions.read} label="Read" />
                  </td>
                  <td data-label="Write">
                    <Flag on={key.permissions.write} label="Write" />
                  </td>
                  <td data-label="Owner">
                    <Flag on={key.permissions.owner} label="Owner" />
                  </td>
                  <td data-label="" className="md:text-right">
                    <Button
                      size="sm"
                      color="ghost"
                      className="text-error hover:bg-error/10"
                      icon={Trash}
                      aria-label={`Remove access of ${label}`}
                      onClick={() => onRemove(key.accessKeyId, label)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
};

export default PermissionsTab;
