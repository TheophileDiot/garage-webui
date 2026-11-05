import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import IconButton from "@/components/ui/icon-button";
import { SearchField } from "@/components/ui/input";
import { bucketPath } from "@/lib/routes";
import { useBucketContext } from "../context";
import { pathParts } from "./model";

type Props = {
  curPrefix: number;
  setCurPrefix: (index: number) => void;
  prefixHistory: string[];
  /** The current folder, `""` at the bucket root. */
  prefix: string;
  filter: string;
  onFilter: (value: string) => void;
  actions?: React.ReactNode;
};

const part =
  "inline-flex min-h-9 min-w-0 items-center desk:min-h-6 rounded-sm px-1 [overflow-wrap:anywhere]";

/** The toolbar: back and forward through visited folders, the path inside the bucket (each folder a link), the filter box and the actions. */
const ObjectListNavigator = ({
  curPrefix,
  setCurPrefix,
  prefixHistory,
  prefix,
  filter,
  onFilter,
  actions,
}: Props) => {
  const { bucket, globalAlias } = useBucketContext();
  const parts = pathParts(prefix);
  const hrefFor = (path: string) =>
    bucketPath(bucket.id, "objects", path || undefined);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-3 py-2.5 md:pl-4">
      <div className="flex min-w-0 flex-[1_1_240px] items-center gap-1">
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
          <ol className="m-0 flex min-w-0 list-none flex-wrap items-center p-0 font-mono text-[13px] leading-[1.3]">
            <li className="flex min-w-0 items-center">
              {parts.length ? (
                <Link
                  to={hrefFor("")}
                  title={globalAlias}
                  className={`${part} text-link hover:bg-surface-2 hover:underline`}
                >
                  {globalAlias}
                </Link>
              ) : (
                <span
                  aria-current="location"
                  title={globalAlias}
                  className={`${part} font-medium text-ink`}
                >
                  {globalAlias}
                </span>
              )}
            </li>
            {parts.map((p, i) => {
              const last = i === parts.length - 1;
              return (
                <li key={p.path} className="flex min-w-0 items-center">
                  <span aria-hidden className="text-ink-3">
                    /
                  </span>
                  {last ? (
                    <span
                      aria-current="location"
                      title={p.path}
                      className={`${part} font-medium text-ink`}
                    >
                      {p.label}
                    </span>
                  ) : (
                    <Link
                      to={hrefFor(p.path)}
                      title={p.path}
                      className={`${part} text-link hover:bg-surface-2 hover:underline`}
                    >
                      {p.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      <SearchField
        label="Filter by name"
        placeholder="Filter by name"
        value={filter}
        onChange={(e) => onFilter(e.target.value)}
        className="min-w-[160px] flex-[0_1_220px] sm:max-w-[220px]"
      />
      {actions}
    </div>
  );
};

export default ObjectListNavigator;
