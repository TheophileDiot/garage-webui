import { dayjs, readableBytes } from "@/lib/utils";
import mime from "mime/lite";
import { GetObjectsResult, Object } from "./types";
import { API_URL } from "@/lib/api";
import { FileArchive, FileIcon, FileType, Folder } from "lucide-react";
import ObjectActions from "./object-actions";
import GotoTopButton from "@/components/ui/goto-top-btn";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/state";
import { Ledger, LedgerColumn } from "@/components/ui/ledger";

type Row =
  | { kind: "folder"; folder: string; name: string }
  | { kind: "file"; object: Object };

type Props = {
  data?: GetObjectsResult;
  error: Error | null;
  isLoading: boolean;
  onRetry: () => void;
  prefix?: string;
  onPrefixChange?: (prefix: string) => void;
};

const nameClass = "min-w-0 [overflow-wrap:anywhere] md:truncate";

const ObjectList = ({
  data,
  error,
  isLoading,
  onRetry,
  prefix = "",
  onPrefixChange,
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
  if (!data?.prefixes?.length && !data?.objects?.length) {
    return (
      <EmptyState
        title={prefix ? "This folder is empty" : "This bucket is empty"}
      >
        Use the toolbar to upload files or create a folder.
      </EmptyState>
    );
  }

  const rows: Row[] = [
    ...data.prefixes.map((folder): Row => {
      const name = folder
        .substring(0, folder.lastIndexOf("/"))
        .split("/")
        .pop();
      return { kind: "folder", folder, name: name ?? folder };
    }),
    ...data.objects.map((object): Row => ({ kind: "file", object })),
  ];

  const columns: LedgerColumn<Row>[] = [
    {
      key: "name",
      header: "Name",
      mobile: "title",
      cell: (row) => {
        if (row.kind === "folder") {
          return (
            <button
              type="button"
              className="xlink inline-flex max-w-full items-center gap-2 text-left font-medium"
              title={row.folder}
              onClick={() => onPrefixChange?.(row.folder)}
            >
              <Folder
                size={14}
                aria-hidden
                className="shrink-0 text-gold-text"
              />
              <span className={nameClass}>{row.name}/</span>
              <span className="sr-only"> (folder)</span>
            </button>
          );
        }
        const { object } = row;
        const extIdx = object.objectKey.lastIndexOf(".");
        const filename =
          extIdx > 0 ? object.objectKey.substring(0, extIdx) : object.objectKey;
        const ext = extIdx > 0 ? object.objectKey.substring(extIdx) : null;
        return (
          <a
            href={API_URL + object.url + "?view=1"}
            target="_blank"
            rel="noopener noreferrer"
            className="xlink inline-flex max-w-full items-center gap-2 text-left font-medium"
            title={data.prefix + object.objectKey}
          >
            <FilePreview ext={ext?.substring(1)} object={object} />
            <span className="inline-flex min-w-0">
              <span className={nameClass}>{filename}</span>
              {ext && <span className="shrink-0 text-ink-3">{ext}</span>}
            </span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        );
      },
    },
    {
      key: "size",
      header: "Size",
      align: "right",
      width: "7rem",
      cell: (row) =>
        row.kind === "file" ? (
          <span className="whitespace-nowrap">
            {readableBytes(row.object.size)}
          </span>
        ) : null,
    },
    {
      key: "modified",
      header: "Last modified",
      width: "10rem",
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
      width: "7.5rem",
      mobile: "actions",
      cell: (row) =>
        row.kind === "folder" ? (
          <ObjectActions object={{ objectKey: row.folder, url: "" }} />
        ) : (
          <ObjectActions prefix={data.prefix} object={row.object} />
        ),
    },
  ];

  return (
    <>
      <Ledger
        caption={`Objects under ${prefix || "the bucket root"}`}
        columns={columns}
        rows={rows}
        rowKey={(row) =>
          row.kind === "folder"
            ? `d:${row.folder}`
            : `f:${row.object.objectKey}`
        }
      />
      <GotoTopButton />
    </>
  );
};

type FilePreviewProps = {
  ext?: string | null;
  object: Object;
};

const FilePreview = ({ ext, object }: FilePreviewProps) => {
  const type = mime.getType(ext || "")?.split("/")[0];
  let Icon = FileIcon;

  if (
    ["zip", "rar", "7z", "iso", "tar", "gz", "bz2", "xz"].includes(ext || "")
  ) {
    Icon = FileArchive;
  }

  if (type === "image") {
    const thumbnailSupport = ["jpg", "jpeg", "png", "gif"].includes(ext || "");
    return (
      <img
        src={API_URL + object.url + (thumbnailSupport ? "?thumb=1" : "?view=1")}
        alt=""
        loading="lazy"
        className="size-5 shrink-0 overflow-hidden rounded-sm bg-sunk object-cover"
      />
    );
  }

  if (type === "text") {
    Icon = FileType;
  }

  return <Icon size={14} aria-hidden className="shrink-0 text-ink-3" />;
};

export default ObjectList;
