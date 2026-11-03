import { useBrowseObjects } from "./hooks";
import { dayjs, readableBytes } from "@/lib/utils";
import mime from "mime/lite";
import { Object } from "./types";
import { API_URL } from "@/lib/api";
import {
  FileArchive,
  FileIcon,
  FileType,
  Folder,
  FolderOpen,
} from "lucide-react";
import { useBucketContext } from "../context";
import ObjectActions from "./object-actions";
import GotoTopButton from "@/components/ui/goto-top-btn";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/state";

type Props = {
  prefix?: string;
  onPrefixChange?: (prefix: string) => void;
};

const ObjectList = ({ prefix, onPrefixChange }: Props) => {
  const { bucketName } = useBucketContext();
  const { data, error, isLoading, refetch } = useBrowseObjects(bucketName, {
    prefix,
    limit: 1000,
  });

  const onObjectClick = (object: Object) => {
    window.open(API_URL + object.url + "?view=1", "_blank", "noopener");
  };

  if (isLoading) return <SkeletonRows label="Loading objects" rows={5} />;
  if (error)
    return (
      <ErrorState
        title="Could not list objects"
        error={error}
        onRetry={() => void refetch()}
      />
    );
  if (!data?.prefixes?.length && !data?.objects?.length) {
    return (
      <EmptyState
        icon={FolderOpen}
        title={prefix ? "This folder is empty" : "This bucket is empty"}
      >
        Use the toolbar to upload files or create a folder.
      </EmptyState>
    );
  }

  return (
    <div className="min-h-[16rem]">
      <table className="table table-stack">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col" className="md:text-right">
              Size
            </th>
            <th scope="col">Last modified</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {data?.prefixes.map((folder) => {
            const name = folder
              .substring(0, folder.lastIndexOf("/"))
              .split("/")
              .pop();
            return (
              <tr key={folder} className="row-hover group">
                <td data-primary>
                  <button
                    type="button"
                    className="flex min-h-6 items-center gap-2 font-bold"
                    onClick={() => onPrefixChange?.(folder)}
                  >
                    <Folder size={18} className="text-primary" aria-hidden />
                    {name}
                    <span className="sr-only"> (folder)</span>
                  </button>
                </td>
                <td
                  data-label="Size"
                  className="md:text-right text-base-content/70"
                >
                  Folder
                </td>
                <td data-label="Last modified" className="text-base-content/70">
                  None
                </td>
                <ObjectActions object={{ objectKey: folder, url: "" }} />
              </tr>
            );
          })}

          {data?.objects.map((object) => {
            const extIdx = object.objectKey.lastIndexOf(".");
            const filename =
              extIdx >= 0
                ? object.objectKey.substring(0, extIdx)
                : object.objectKey;
            const ext = extIdx >= 0 ? object.objectKey.substring(extIdx) : null;

            return (
              <tr key={object.objectKey} className="row-hover group">
                <td data-primary>
                  <button
                    type="button"
                    className="flex min-h-6 max-w-full items-center text-left font-bold"
                    onClick={() => onObjectClick(object)}
                  >
                    <FilePreview ext={ext?.substring(1)} object={object} />
                    <span className="truncate md:max-w-[28rem]">
                      {filename}
                    </span>
                    {ext && (
                      <span className="shrink-0 text-base-content/70">
                        {ext}
                      </span>
                    )}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </button>
                </td>
                <td
                  data-label="Size"
                  className="whitespace-nowrap md:text-right"
                >
                  {readableBytes(object.size)}
                </td>
                <td
                  data-label="Last modified"
                  className="whitespace-nowrap"
                  title={dayjs(object.lastModified).format(
                    "YYYY-MM-DD HH:mm:ss",
                  )}
                >
                  {dayjs(object.lastModified).fromNow()}
                </td>
                <ObjectActions prefix={data.prefix} object={object} />
              </tr>
            );
          })}
        </tbody>
      </table>

      <GotoTopButton />
    </div>
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
        className="mr-2 size-5 shrink-0 overflow-hidden rounded-sm object-cover"
      />
    );
  }

  if (type === "text") {
    Icon = FileType;
  }

  return (
    <Icon
      size={18}
      aria-hidden
      className="mr-2 shrink-0 text-base-content/70"
    />
  );
};

export default ObjectList;
