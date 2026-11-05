import { useSearchParams } from "react-router-dom";
import { useRef, useState } from "react";
import { FolderOpen, KeyRound } from "lucide-react";
import ObjectList from "./object-list";
import ObjectListNavigator from "./object-list-navigator";
import ObjectInspector from "./object-inspector";
import SelectionBar from "./selection-bar";
import Actions from "./actions";
import { useBucketContext } from "../context";
import ShareDialog from "./share-dialog";
import { EmptyState } from "@/components/ui/state";
import { LinkButton } from "@/components/ui/button";
import { Panel } from "@/components/ui/page-header";
import { readableBytes } from "@/lib/utils";
import { bucketPath } from "@/lib/routes";
import { useBrowseObjects } from "./hooks";
import {
  folderLabel,
  historyFor,
  matchesFilter,
  plural,
  prefixTrail,
  selectedIn,
  toggleKey,
} from "./model";
import { useObjectOps } from "./use-object-ops";

const LIMIT = 1000;

const BrowseTab = () => {
  const { bucket, globalAlias } = useBucketContext();

  if (!bucket.keys.find((k) => k.permissions.read && k.permissions.write)) {
    return (
      <Panel flush>
        <EmptyState
          icon={KeyRound}
          title="Browsing needs a key"
          action={
            <LinkButton
              href={bucketPath(bucket.id, "access")}
              variant="primary"
            >
              Open access
            </LinkButton>
          }
        >
          Allow a key with read and write access on this bucket to browse its
          objects.
        </EmptyState>
      </Panel>
    );
  }

  // The backend reaches a bucket by its global alias, so a bucket without one cannot be listed.
  if (!globalAlias) {
    return (
      <Panel flush>
        <EmptyState
          icon={FolderOpen}
          title="Browsing needs a global alias"
          action={
            <LinkButton
              href={bucketPath(bucket.id, "settings")}
              variant="primary"
            >
              Open settings
            </LinkButton>
          }
        >
          Objects are listed through the bucket&apos;s global alias, and this
          bucket has none. Add one in the bucket settings.
        </EmptyState>
      </Panel>
    );
  }

  return <Browser />;
};

/** A value that belongs to one folder: it reads as empty once the folder changes. */
const useScoped = <T,>(scope: string, empty: T) => {
  const [state, setState] = useState({ scope, value: empty });
  const value = state.scope === scope ? state.value : empty;
  return [value, (next: T) => setState({ scope, value: next })] as const;
};

const Browser = () => {
  const { globalAlias } = useBucketContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const prefix = searchParams.get("prefix") || "";
  const [savedHistory, setPrefixHistory] = useState<string[]>(
    prefixTrail(prefix),
  );
  // The URL owns the current folder; local history only supplies toolbar traversal.
  const prefixHistory = historyFor(prefix, savedHistory);
  const curPrefix = prefixHistory.indexOf(prefix);
  const updatePrefix = (next: string) => {
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      if (next) params.set("prefix", next);
      else params.delete("prefix");
      return params;
    });
  };
  const setCurPrefix = (index: number) =>
    updatePrefix(prefixHistory[index] || "");
  const gotoPrefix = (next: string) => {
    const history = prefixHistory.slice(0, curPrefix + 1);
    setPrefixHistory([...history, next]);
    updatePrefix(next);
  };

  const { data, error, isLoading, refetch } = useBrowseObjects(globalAlias, {
    prefix,
    limit: LIMIT,
  });
  const ops = useObjectOps();
  const section = useRef<HTMLElement>(null);

  const [filter, setFilter] = useScoped(prefix, "");
  const [picked, setPicked] = useScoped<string[]>(prefix, []);

  const allFolders = data?.prefixes ?? [];
  const allFiles = data?.objects ?? [];
  const folders = allFolders.filter((f) =>
    matchesFilter(folderLabel(f), filter),
  );
  const files = allFiles.filter((o) => matchesFilter(o.objectKey, filter));
  // Only what is listed and visible stays selected, so a refetch or a filter never leaves a hidden selection.
  const selected = selectedIn(
    picked,
    files.map((f) => f.objectKey),
  );
  const selectedFiles = files.filter((f) => selected.includes(f.objectKey));
  const total = files.reduce((sum, o) => sum + o.size, 0);
  const listingPrefix = data?.prefix ?? prefix;

  const clearSelection = () => {
    setPicked([]);
    // The control that held focus is gone: keep keyboard users in the browser.
    section.current?.focus();
  };

  return (
    <section
      ref={section}
      tabIndex={-1}
      aria-label="Objects"
      className="grid items-start gap-4 outline-none min-[1180px]:grid-cols-[minmax(0,1fr)_320px]"
    >
      <Panel flush id="objects">
        <ObjectListNavigator
          curPrefix={curPrefix}
          setCurPrefix={setCurPrefix}
          prefixHistory={prefixHistory}
          prefix={prefix}
          filter={filter}
          onFilter={setFilter}
          actions={<Actions prefix={prefix} />}
        />

        {selectedFiles.length > 0 ? (
          <SelectionBar
            files={selectedFiles}
            prefix={listingPrefix}
            ops={ops}
            onClear={clearSelection}
          />
        ) : null}

        <ObjectList
          prefix={prefix}
          listingPrefix={listingPrefix}
          folders={folders}
          files={files}
          filter={filter}
          error={error}
          isLoading={isLoading}
          onRetry={() => void refetch()}
          onPrefixChange={gotoPrefix}
          selected={selected}
          onToggle={(key) => setPicked(toggleKey(selected, key))}
          onToggleAll={(on) =>
            setPicked(on ? files.map((f) => f.objectKey) : [])
          }
          onInspect={(key) => setPicked([key])}
          ops={ops}
        />

        {data ? (
          <p
            className="m-0 border-t border-line px-4 py-2.5 text-caption text-ink-3"
            aria-live="polite"
          >
            {filter.trim()
              ? `${plural(folders.length, "folder")} · ${plural(files.length, "object")} match “${filter.trim()}”`
              : `${plural(folders.length, "folder")} · ${plural(files.length, "object")} · ${readableBytes(total)}`}
            {data.nextToken ? ` · the first ${LIMIT} entries are shown` : null}
          </p>
        ) : null}
      </Panel>

      {/* Beside the list on wide screens; under it, and only while something is selected, on narrow ones. */}
      <aside
        aria-label="Object details"
        className={
          selectedFiles.length
            ? "min-w-0 min-[1180px]:sticky min-[1180px]:top-4"
            : "hidden min-w-0 min-[1180px]:sticky min-[1180px]:top-4 min-[1180px]:block"
        }
      >
        <ObjectInspector files={selectedFiles} prefix={listingPrefix} />
      </aside>

      <ShareDialog />
    </section>
  );
};

export default BrowseTab;
