import IconButton from "@/components/ui/icon-button";
import { AddressText } from "@/components/ui/page-header";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useBucketContext } from "../context";

type Props = {
  curPrefix: number;
  setCurPrefix: (index: number) => void;
  prefixHistory: string[];
  /** The current folder, `""` at the bucket root. */
  prefix: string;
  actions?: React.ReactNode;
};

const folderName = (prefix: string) =>
  prefix.substring(0, prefix.lastIndexOf("/")).split("/").pop() ?? prefix;

/** The path as a large address (each part is a link), back/forward through visited folders, and the toolbar. */
const ObjectListNavigator = ({
  curPrefix,
  setCurPrefix,
  prefixHistory,
  prefix,
  actions,
}: Props) => {
  const { bucket, bucketName } = useBucketContext();
  const parts = prefix.split("/").filter(Boolean);
  const hrefFor = (path: string) =>
    `/buckets/${bucket.id}?tab=browse` +
    (path ? `&prefix=${encodeURIComponent(path)}` : "");

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 pb-3">
      <div className="flex min-w-0 items-start gap-2">
        <div className="flex shrink-0 items-center">
          <IconButton
            icon={ChevronLeft}
            label="Previous folder"
            disabled={curPrefix < 0}
            onClick={() => setCurPrefix(curPrefix - 1)}
          />
          <IconButton
            icon={ChevronRight}
            label="Next folder"
            disabled={curPrefix >= prefixHistory.length - 1}
            onClick={() => setCurPrefix(curPrefix + 1)}
          />
        </div>

        <nav aria-label="Folder path" className="min-w-0">
          <p className="min-w-0 pt-px text-[clamp(1rem,0.8rem+1.2vw,1.5rem)] font-medium leading-tight [overflow-wrap:anywhere]">
            <AddressText
              scheme="s3"
              segments={[
                {
                  label: bucketName,
                  to: parts.length ? hrefFor("") : undefined,
                },
                ...parts.map((_, i) => {
                  const path = parts.slice(0, i + 1).join("/") + "/";
                  return {
                    label: folderName(path),
                    to: i < parts.length - 1 ? hrefFor(path) : undefined,
                  };
                }),
              ]}
              trailing={parts.length > 0}
            />
          </p>
        </nav>
      </div>

      {actions}
    </div>
  );
};

export default ObjectListNavigator;
