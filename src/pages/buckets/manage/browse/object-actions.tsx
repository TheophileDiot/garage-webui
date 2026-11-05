import { DownloadIcon, ExternalLink, Share2, Trash2 } from "lucide-react";
import IconButton from "@/components/ui/icon-button";
import { buttonClass } from "@/components/ui/button-styles";
import { isFolder, targetName } from "./model";
import { ObjectTarget } from "./types";
import { ObjectOps, viewUrl } from "./use-object-ops";

/** A link to the object in a new tab, drawn like an icon button or a text button. */
export const OpenLink = ({
  object,
  iconOnly = false,
}: {
  object: ObjectTarget;
  iconOnly?: boolean;
}) => {
  const name = targetName(object);
  return (
    <a
      href={viewUrl(object)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${name} in a new tab`}
      title={iconOnly ? `Open ${name}` : undefined}
      className={buttonClass({
        variant: iconOnly ? "ghost" : "secondary",
        size: "md",
        iconOnly,
      })}
    >
      <ExternalLink size={16} aria-hidden />
      {iconOnly ? null : "Open"}
    </a>
  );
};

/** Row actions: open, download, share and delete for a file; share and delete for a folder. Hidden until hover, focus or selection on a pointer device. */
const ObjectActions = ({
  object,
  ops,
}: {
  object: ObjectTarget;
  ops: ObjectOps;
}) => {
  const folder = isFolder(object);
  const name = targetName(object);
  return (
    <div className="row-actions">
      {!folder && <OpenLink object={object} iconOnly />}
      {!folder && (
        <IconButton
          label={`Download ${name}`}
          icon={DownloadIcon}
          onClick={() => ops.download([object])}
        />
      )}
      <IconButton
        label={`Share ${name}`}
        icon={Share2}
        onClick={() => ops.share(object)}
      />
      <IconButton
        label={`Delete ${name}`}
        icon={Trash2}
        variant="ghost-danger"
        onClick={() => void ops.remove([object])}
      />
    </div>
  );
};

export default ObjectActions;
