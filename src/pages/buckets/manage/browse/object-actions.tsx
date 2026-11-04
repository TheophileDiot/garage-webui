import { Object } from "./types";
import Button from "@/components/ui/button";
import IconButton from "@/components/ui/icon-button";
import {
  ActionSheet,
  ActionSheetItem,
  ActionSheetSeparator,
} from "@/components/ui/action-sheet";
import { DownloadIcon, MoreHorizontal, Share2, Trash2 } from "lucide-react";
import { useDeleteObject } from "./hooks";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { shareDialog } from "./stores";
import { confirmAction } from "@/components/ui/confirm-store";

type Props = {
  prefix?: string;
  object: Pick<Object, "objectKey" | "url">;
};

const ObjectActions = ({ prefix = "", object }: Props) => {
  const deleteObject = useDeleteObject();
  const isDirectory = object.objectKey.endsWith("/");
  const name = object.objectKey.replace(/\/$/, "").split("/").pop();
  const downloadUrl = API_URL + object.url + "?dl=1";

  const onDownload = () => {
    window.open(downloadUrl, "_blank", "noopener");
  };

  const onShare = () => shareDialog.open({ key: object.objectKey, prefix });

  const onDelete = async () => {
    const ok = await confirmAction({
      title: isDirectory ? "Delete folder" : "Delete object",
      message: isDirectory
        ? `Delete ${name} and everything inside it? This cannot be undone.`
        : `Delete ${name}? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
      action: () =>
        deleteObject.mutateAsync({
          key: prefix + object.objectKey,
          recursive: isDirectory,
        }),
    });
    if (ok) toast.success(isDirectory ? "Folder deleted" : "Object deleted");
  };

  return (
    <>
      <span className="flex justify-end gap-0.5 max-md:hidden">
        {!isDirectory && (
          <IconButton
            label={`Download ${name}`}
            icon={DownloadIcon}
            onClick={onDownload}
          />
        )}
        <IconButton label={`Share ${name}`} icon={Share2} onClick={onShare} />
        <IconButton
          label={`Delete ${name}`}
          icon={Trash2}
          variant="ghost-danger"
          onClick={() => void onDelete()}
        />
      </span>
      <span className="md:hidden">
        <ActionSheet
          label={`Actions for ${name}`}
          trigger={
            <Button size="sm" icon={MoreHorizontal}>
              Actions<span className="sr-only"> for {name}</span>
            </Button>
          }
        >
          {!isDirectory && (
            <ActionSheetItem
              href={downloadUrl}
              icon={<DownloadIcon size={16} aria-hidden />}
            >
              Download
            </ActionSheetItem>
          )}
          <ActionSheetItem
            onSelect={onShare}
            icon={<Share2 size={16} aria-hidden />}
          >
            Share
          </ActionSheetItem>
          <ActionSheetSeparator />
          <ActionSheetItem
            danger
            onSelect={() => void onDelete()}
            icon={<Trash2 size={16} aria-hidden />}
          >
            Delete
          </ActionSheetItem>
        </ActionSheet>
      </span>
    </>
  );
};

export default ObjectActions;
