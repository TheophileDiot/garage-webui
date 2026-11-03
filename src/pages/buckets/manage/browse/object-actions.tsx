import { Object } from "./types";
import Button from "@/components/ui/button";
import { DownloadIcon, Share2, Trash } from "lucide-react";
import { useDeleteObject } from "./hooks";
import { useBucketContext } from "../context";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { handleError } from "@/lib/utils";
import { API_URL } from "@/lib/api";
import { shareDialog } from "./stores";
import { confirmAction } from "@/components/ui/confirm-store";

type Props = {
  prefix?: string;
  object: Pick<Object, "objectKey" | "url">;
};

const ObjectActions = ({ prefix = "", object }: Props) => {
  const { bucketName } = useBucketContext();
  const queryClient = useQueryClient();
  const isDirectory = object.objectKey.endsWith("/");
  const name = object.objectKey.replace(/\/$/, "").split("/").pop();

  const deleteObject = useDeleteObject(bucketName, {
    onSuccess: () => {
      toast.success(isDirectory ? "Folder deleted" : "Object deleted");
      queryClient.invalidateQueries({ queryKey: ["browse", bucketName] });
    },
    onError: handleError,
  });

  const onDownload = () => {
    window.open(API_URL + object.url + "?dl=1", "_blank", "noopener");
  };

  const onDelete = async () => {
    const ok = await confirmAction({
      title: isDirectory ? "Delete folder" : "Delete object",
      message: isDirectory
        ? `Delete ${name} and everything inside it? This cannot be undone.`
        : `Delete ${name}? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) {
      deleteObject.mutate({
        key: prefix + object.objectKey,
        recursive: isDirectory,
      });
    }
  };

  return (
    <td data-label="" className="md:text-right">
      <span className="inline-flex">
        {!isDirectory && (
          <Button
            size="sm"
            icon={DownloadIcon}
            color="ghost"
            aria-label={`Download ${name}`}
            onClick={onDownload}
          />
        )}
        <Button
          size="sm"
          icon={Share2}
          color="ghost"
          aria-label={`Share ${name}`}
          onClick={() => shareDialog.open({ key: object.objectKey, prefix })}
        />
        <Button
          size="sm"
          icon={Trash}
          color="ghost"
          className="text-error hover:bg-error/10"
          aria-label={`Delete ${name}`}
          onClick={onDelete}
        />
      </span>
    </td>
  );
};

export default ObjectActions;
