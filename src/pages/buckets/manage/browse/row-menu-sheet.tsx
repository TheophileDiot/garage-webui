import { flushSync } from "react-dom";
import { DownloadIcon, ExternalLink, Share2, Trash2 } from "lucide-react";
import Button from "@/components/ui/button";
import { buttonClass } from "@/components/ui/button-styles";
import Dialog from "@/components/ui/dialog";
import { isFolder, targetName } from "./model";
import { ObjectTarget } from "./types";
import { ObjectOps, viewUrl } from "./use-object-ops";

const item = "h-11 w-full justify-start";

/**
 * The phone's one row menu: a sheet with every action of a file (Open, Download, Share link, Delete) or a folder (Share
 * link, Delete). Delete sits apart, last, so it is never next to a harmless action. The sheet owns focus and returns it
 * to the row's menu button, and a sheet's targets are 44 px, which a popover of small items would not give.
 */
const RowMenuSheet = ({
  target,
  ops,
  onClose,
  returnFocus,
}: {
  /** The row whose menu is open; `null` closes the sheet. */
  target: ObjectTarget | null;
  ops: ObjectOps;
  onClose: () => void;
  /** Puts focus back on the row's menu button. */
  returnFocus: () => void;
}) => {
  const open = target !== null;
  // Another dialog (share, delete) opens from here: close the sheet first and refocus the row's button, so that dialog
  // takes the button as its opener and gives focus back to it on close.
  const then = (next: () => void) => {
    flushSync(onClose);
    returnFocus();
    next();
  };
  const folder = target ? isFolder(target) : false;
  const name = target ? targetName(target) : "";
  return (
    <Dialog open={open} onClose={onClose} title={name || "Actions"}>
      {target ? (
        <div className="grid gap-2">
          {!folder && (
            <a
              href={viewUrl(target)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${name} in a new tab`}
              onClick={onClose}
              className={buttonClass({ className: item })}
            >
              <ExternalLink size={16} aria-hidden />
              Open
            </a>
          )}
          {!folder && (
            <Button
              icon={DownloadIcon}
              className={item}
              onClick={() => then(() => ops.download([target]))}
            >
              Download
            </Button>
          )}
          <Button
            icon={Share2}
            className={item}
            onClick={() => then(() => ops.share(target))}
          >
            Share link
          </Button>
          <div className="mt-2 border-t border-line pt-4">
            <Button
              variant="danger"
              icon={Trash2}
              className={item}
              onClick={() => then(() => void ops.remove([target]))}
            >
              {folder ? "Delete folder" : "Delete"}
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
};

export default RowMenuSheet;
