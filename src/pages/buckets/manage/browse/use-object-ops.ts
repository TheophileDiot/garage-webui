import { toast } from "sonner";
import { confirmAction } from "@/components/ui/confirm-store";
import { API_URL } from "@/lib/api";
import { useDeleteObject } from "./hooks";
import { shareDialog } from "./stores";
import { ObjectTarget } from "./types";
import { isFolder, plural, targetName } from "./model";

export const viewUrl = (t: ObjectTarget) => API_URL + t.url + "?view=1";
const downloadUrl = (t: ObjectTarget) => API_URL + t.url + "?dl=1";

export type ObjectOps = ReturnType<typeof useObjectOps>;

/** Download, share and delete for one or several objects: one set of rules for rows, the selection bar and the inspector. */
export const useObjectOps = () => {
  const deleteObject = useDeleteObject();

  const download = (targets: ObjectTarget[]) => {
    if (targets.length === 1) {
      window.open(downloadUrl(targets[0]), "_blank", "noopener");
      return;
    }
    // One click may start several downloads; spaced out so the browser does not drop them.
    targets.forEach((t, i) =>
      window.setTimeout(() => {
        const a = document.createElement("a");
        a.href = downloadUrl(t);
        a.download = "";
        a.rel = "noopener";
        document.body.append(a);
        a.click();
        a.remove();
      }, i * 250),
    );
  };

  const share = (t: ObjectTarget) =>
    shareDialog.open({ key: t.objectKey, prefix: t.prefix });

  /** Resolves true when everything was deleted. A partial failure keeps the dialog open with the reason. */
  const remove = async (targets: ObjectTarget[]) => {
    const many = targets.length > 1;
    const folder = !many && isFolder(targets[0]);
    const name = targetName(targets[0]);
    const ok = await confirmAction({
      title: many
        ? `Delete ${plural(targets.length, "object")}`
        : folder
          ? "Delete folder"
          : "Delete object",
      message: many
        ? `Delete ${plural(targets.length, "object")}? This cannot be undone.`
        : folder
          ? `Delete ${name} and everything inside it? This cannot be undone.`
          : `Delete ${name}? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
      action: async () => {
        const results = await Promise.allSettled(
          targets.map((t) =>
            deleteObject.mutateAsync({
              key: t.prefix + t.objectKey,
              recursive: isFolder(t),
            }),
          ),
        );
        const failed = results.filter(
          (r): r is PromiseRejectedResult => r.status === "rejected",
        );
        if (!failed.length) return;
        const reason = (failed[0].reason as Error)?.message || "Delete failed";
        throw new Error(
          many
            ? `${failed.length} of ${targets.length} could not be deleted: ${reason}`
            : reason,
        );
      },
    });
    if (ok)
      toast.success(
        many
          ? `${plural(targets.length, "object")} deleted`
          : folder
            ? "Folder deleted"
            : "Object deleted",
      );
    return ok;
  };

  return { download, share, remove };
};
