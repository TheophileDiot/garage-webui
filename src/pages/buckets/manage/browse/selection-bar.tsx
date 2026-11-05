import { DownloadIcon, Link2, Trash2, X } from "lucide-react";
import Button from "@/components/ui/button";
import IconButton from "@/components/ui/icon-button";
import { readableBytes } from "@/lib/utils";
import { selectionLine } from "../../phone";
import { Object, ObjectTarget } from "./types";
import { ObjectOps } from "./use-object-ops";

type Props = {
  files: Object[];
  /** The listing prefix the file keys are relative to. */
  prefix: string;
  ops: ObjectOps;
  onClear: () => void;
};

const targetsOf = (files: Object[], prefix: string): ObjectTarget[] =>
  files.map((f) => ({ objectKey: f.objectKey, prefix, url: f.url }));

/** Shown while files are selected: how many and how big, then download, share (one file only), delete and clear. */
const SelectionBar = ({ files, prefix, ops, onClear }: Props) => {
  const targets = targetsOf(files, prefix);
  const total = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div
      role="region"
      aria-label="Selection actions"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-primary-soft px-4 py-2"
    >
      <p className="m-0 min-w-0 [overflow-wrap:anywhere]" aria-live="polite">
        <span className="font-semibold">{files.length} selected</span>
        <span className="text-ink-2">
          {" · "}
          {selectionLine(
            files.map((f) => f.objectKey),
            readableBytes(total),
          )}
        </span>
      </p>
      <div className="flex w-full flex-wrap gap-1.5 md:ml-auto md:w-auto">
        <Button
          size="sm"
          icon={DownloadIcon}
          onClick={() => ops.download(targets)}
        >
          Download
        </Button>
        {targets.length === 1 && (
          <Button size="sm" icon={Link2} onClick={() => ops.share(targets[0])}>
            Share link
          </Button>
        )}
        <Button
          size="sm"
          variant="danger"
          icon={Trash2}
          onClick={() => {
            void ops.remove(targets).then((ok) => {
              if (ok) onClear();
            });
          }}
        >
          Delete
        </Button>
        <Button size="sm" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
};

/**
 * The phone's version, drawn in the shell's bottom slot in place of the navigation: the summary with Details and
 * Clear on top, then Download and Share link, and Delete set apart at the end so a thumb does not reach it by
 * accident. Every control is 44 px tall.
 */
export const PhoneSelectionBar = ({
  files,
  prefix,
  ops,
  onClear,
  onDetails,
}: Props & { onDetails: () => void }) => {
  const targets = targetsOf(files, prefix);
  const total = readableBytes(files.reduce((sum, f) => sum + f.size, 0));

  return (
    <div
      role="region"
      aria-label="Selection actions"
      className="grid grid-cols-[minmax(0,1fr)] gap-1 p-2 pt-1"
    >
      <div className="flex items-center gap-1">
        <p className="m-0 min-w-0 flex-1 truncate pl-1" aria-live="polite">
          <span className="font-semibold">{files.length} selected</span>
          <span className="text-ink-2">
            {" · "}
            {files.length === 1
              ? selectionLine([files[0].objectKey], total)
              : `${total} total`}
          </span>
        </p>
        <Button variant="ghost" className="h-11 text-link" onClick={onDetails}>
          Details
        </Button>
        <IconButton
          label="Clear selection"
          icon={X}
          className="h-11 w-11"
          onClick={onClear}
        />
      </div>
      <div className="flex gap-2">
        <Button
          icon={DownloadIcon}
          className="h-11 min-w-0 flex-1 gap-1.5 px-2"
          onClick={() => ops.download(targets)}
        >
          Download
        </Button>
        {targets.length === 1 && (
          <Button
            icon={Link2}
            className="h-11 min-w-0 flex-1 gap-1.5 px-2"
            onClick={() => ops.share(targets[0])}
          >
            Share link
          </Button>
        )}
        <Button
          variant="danger"
          icon={Trash2}
          className="ml-4 h-11 min-w-0 flex-1 gap-1.5 px-2"
          onClick={() => {
            void ops.remove(targets).then((ok) => {
              if (ok) onClear();
            });
          }}
        >
          Delete
        </Button>
      </div>
    </div>
  );
};

export default SelectionBar;
