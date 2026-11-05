import { DownloadIcon, Link2, Trash2 } from "lucide-react";
import Button from "@/components/ui/button";
import { readableBytes } from "@/lib/utils";
import { plural } from "./model";
import { Object, ObjectTarget } from "./types";
import { ObjectOps } from "./use-object-ops";

/** Shown while files are selected: how many and how big, then download, share (one file only), delete and clear. */
const SelectionBar = ({
  files,
  prefix,
  ops,
  onClear,
}: {
  files: Object[];
  /** The listing prefix the file keys are relative to. */
  prefix: string;
  ops: ObjectOps;
  onClear: () => void;
}) => {
  const targets: ObjectTarget[] = files.map((f) => ({
    objectKey: f.objectKey,
    prefix,
    url: f.url,
  }));
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
          {files.length === 1
            ? `${files[0].objectKey} · ${readableBytes(total)}`
            : `${plural(files.length, "object")} · ${readableBytes(total)} total`}
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

export default SelectionBar;
