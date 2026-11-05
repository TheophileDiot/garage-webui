import { useEffect, useRef } from "react";
import { Folder } from "lucide-react";
import { dayjs, readableBytes } from "@/lib/utils";
import GotoTopButton from "@/components/ui/goto-top-btn";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/state";
import { Ledger, LedgerColumn } from "@/components/ui/ledger";
import { Object } from "./types";
import ObjectActions from "./object-actions";
import FilePreview from "./file-icon";
import { mimeOf } from "./file-types";
import { extOf, folderLabel, splitName, typeLabel } from "./model";
import { ObjectOps } from "./use-object-ops";

type Row =
  | { kind: "folder"; folder: string; name: string }
  | { kind: "file"; object: Object };

type Props = {
  /** The listing prefix, `""` at the bucket root. */
  prefix: string;
  /** The listing's `prefix` as the server reports it, which file keys are relative to. */
  listingPrefix: string;
  folders: string[];
  files: Object[];
  /** Nothing matched the filter box, as opposed to nothing existing. */
  filter: string;
  error: Error | null;
  isLoading: boolean;
  onRetry: () => void;
  onPrefixChange: (prefix: string) => void;
  /** Keys (relative) of the selected files. */
  selected: string[];
  onToggle: (key: string) => void;
  onToggleAll: (on: boolean) => void;
  onInspect: (key: string) => void;
  ops: ObjectOps;
};

const checkLabel =
  "inline-grid size-9 shrink-0 cursor-pointer place-items-center md:size-6";
/** `relative` keeps the screen-reader span inside the clip box, so a clipped long name never widens the page. */
const nameButton =
  "relative flex min-h-9 min-w-0 items-center text-left hover:text-link hover:underline md:min-h-6";
const nameText =
  "min-w-0 [overflow-wrap:anywhere] md:truncate md:[overflow-wrap:normal]";

/** The box in the header: all, some (indeterminate) or none of the listed files. */
const SelectAll = ({
  count,
  total,
  onChange,
  text,
}: {
  count: number;
  total: number;
  onChange: (on: boolean) => void;
  /** Visible words beside the box, for the phone row that replaces the hidden header. */
  text?: string;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = count > 0 && count < total;
  }, [count, total]);
  return (
    <label
      className={
        text
          ? "inline-flex min-h-9 cursor-pointer items-center gap-2 text-ink-2"
          : checkLabel
      }
    >
      <input
        ref={ref}
        type="checkbox"
        className="cbx"
        aria-label="Select all objects"
        disabled={total === 0}
        checked={total > 0 && count === total}
        onChange={(e) => onChange(e.target.checked)}
      />
      {text}
    </label>
  );
};

const ObjectList = ({
  prefix,
  listingPrefix,
  folders,
  files,
  filter,
  error,
  isLoading,
  onRetry,
  onPrefixChange,
  selected,
  onToggle,
  onToggleAll,
  onInspect,
  ops,
}: Props) => {
  if (isLoading) return <SkeletonRows label="Loading objects" rows={6} />;
  if (error)
    return (
      <ErrorState
        title="Could not list objects"
        error={error}
        onRetry={onRetry}
      />
    );
  if (!folders.length && !files.length) {
    return filter ? (
      <EmptyState title="No match">
        Nothing in this folder starts with “{filter.trim()}”.
      </EmptyState>
    ) : (
      <EmptyState
        title={prefix ? "This folder is empty" : "This bucket is empty"}
      >
        Use the toolbar to upload files or create a folder.
      </EmptyState>
    );
  }

  const rows: Row[] = [
    ...folders.map((folder): Row => ({
      kind: "folder",
      folder,
      name: folderLabel(folder),
    })),
    ...files.map((object): Row => ({ kind: "file", object })),
  ];

  const columns: LedgerColumn<Row>[] = [
    {
      key: "select",
      header: (
        <SelectAll
          count={selected.length}
          total={files.length}
          onChange={onToggleAll}
        />
      ),
      width: "2.75rem",
      mobile: "hide",
      className: "md:!pr-0",
      cell: (row) =>
        row.kind === "file" ? (
          <label className={checkLabel}>
            <input
              type="checkbox"
              className="cbx"
              aria-label={`Select ${row.object.objectKey}`}
              checked={selected.includes(row.object.objectKey)}
              onChange={() => onToggle(row.object.objectKey)}
            />
          </label>
        ) : null,
    },
    {
      key: "name",
      header: "Name",
      mobile: "title",
      cell: (row) => {
        if (row.kind === "folder") {
          return (
            <div className="flex min-w-0 items-center gap-2.5">
              <Folder size={16} aria-hidden className="shrink-0 text-folder" />
              <button
                type="button"
                className={`${nameButton} font-semibold`}
                title={row.folder}
                onClick={() => onPrefixChange(row.folder)}
              >
                <span className={nameText}>{row.name}/</span>
                <span className="sr-only"> (folder)</span>
              </button>
            </div>
          );
        }
        const { object } = row;
        const { stem, ext } = splitName(object.objectKey);
        return (
          <div className="flex min-w-0 items-center gap-2.5">
            <label className={`${checkLabel} md:hidden`}>
              <input
                type="checkbox"
                className="cbx"
                aria-label={`Select ${object.objectKey}`}
                checked={selected.includes(object.objectKey)}
                onChange={() => onToggle(object.objectKey)}
              />
            </label>
            <FilePreview ext={ext.substring(1)} object={object} />
            <button
              type="button"
              className={`${nameButton} font-medium`}
              title={listingPrefix + object.objectKey}
              aria-label={`${object.objectKey} (show details)`}
              onClick={() => onInspect(object.objectKey)}
            >
              <span className={nameText}>{stem}</span>
              {ext && <span className="shrink-0 text-ink-3">{ext}</span>}
            </button>
          </div>
        );
      },
    },
    {
      key: "size",
      header: "Size",
      align: "right",
      width: "5.5rem",
      className: "tabular-nums",
      cell: (row) =>
        row.kind === "file" ? (
          <span className="whitespace-nowrap">
            {readableBytes(row.object.size)}
          </span>
        ) : null,
    },
    {
      key: "type",
      header: "Type",
      width: "7.5rem",
      mobile: "hide",
      className: "max-[1359px]:hidden",
      cell: (row) =>
        row.kind === "folder" ? (
          <span className="text-ink-2">Folder</span>
        ) : (
          <span
            className="whitespace-nowrap text-ink-2"
            title={mimeOf(extOf(row.object.objectKey)) || undefined}
          >
            {typeLabel(
              row.object.objectKey,
              mimeOf(extOf(row.object.objectKey)),
            )}
          </span>
        ),
    },
    {
      key: "modified",
      header: "Last modified",
      mobileLabel: "Modified",
      width: "8.5rem",
      cell: (row) =>
        row.kind === "file" ? (
          <time
            className="whitespace-nowrap text-ink-2"
            dateTime={dayjs(row.object.lastModified).toISOString()}
            title={dayjs(row.object.lastModified).format("YYYY-MM-DD HH:mm:ss")}
          >
            {dayjs(row.object.lastModified).fromNow()}
          </time>
        ) : null,
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      width: "9.5rem",
      mobile: "actions",
      cell: (row) =>
        row.kind === "folder" ? (
          <ObjectActions
            ops={ops}
            object={{ objectKey: row.folder, prefix: "", url: "" }}
          />
        ) : (
          <ObjectActions
            ops={ops}
            object={{
              objectKey: row.object.objectKey,
              prefix: listingPrefix,
              url: row.object.url,
            }}
          />
        ),
    },
  ];

  return (
    <>
      {files.length > 0 && (
        <div className="border-b border-line px-4 py-0.5 md:hidden">
          <SelectAll
            text="Select all"
            count={selected.length}
            total={files.length}
            onChange={onToggleAll}
          />
        </div>
      )}
      <Ledger
        caption={`Objects under ${prefix || "the bucket root"}`}
        columns={columns}
        rows={rows}
        rowKey={(row) =>
          row.kind === "folder"
            ? `d:${row.folder}`
            : `f:${row.object.objectKey}`
        }
        selectedKeys={selected.map((key) => `f:${key}`)}
      />
      <GotoTopButton />
    </>
  );
};

export default ObjectList;
