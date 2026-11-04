import { useSearchParams } from "react-router-dom";
import ObjectList from "./object-list";
import { useState } from "react";
import ObjectListNavigator from "./object-list-navigator";
import Actions from "./actions";
import { useBucketContext } from "../context";
import ShareDialog from "./share-dialog";
import { EmptyState } from "@/components/ui/state";
import { LinkButton } from "@/components/ui/button";
import { Panel } from "@/components/ui/page-header";
import { readableBytes } from "@/lib/utils";
import { useBrowseObjects } from "./hooks";

const LIMIT = 1000;

const getInitialPrefixes = (searchParams: URLSearchParams) => {
  const prefix = searchParams.get("prefix");
  if (prefix) {
    const paths = prefix.split("/").filter((p) => p);
    return paths.map((_, i) => paths.slice(0, i + 1).join("/") + "/");
  }
  return [];
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const BrowseTab = () => {
  const { bucket, bucketName } = useBucketContext();

  if (!bucket.keys.find((k) => k.permissions.read && k.permissions.write)) {
    return (
      <Panel flush>
        <EmptyState
          title="Browsing needs a key"
          action={
            <LinkButton
              href={`/buckets/${bucket.id}?tab=permissions`}
              variant="primary"
            >
              Open permissions
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
  if (!bucketName) {
    return (
      <Panel flush>
        <EmptyState
          title="Browsing needs a global alias"
          action={
            <LinkButton
              href={`/buckets/${bucket.id}?tab=overview`}
              variant="primary"
            >
              Open overview
            </LinkButton>
          }
        >
          Objects are listed through the bucket&apos;s global alias, and this
          bucket has none. Add one on the overview tab.
        </EmptyState>
      </Panel>
    );
  }

  return <Browser />;
};

const Browser = () => {
  const { bucketName } = useBucketContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const prefix = searchParams.get("prefix") || "";
  const [savedHistory, setPrefixHistory] = useState<string[]>(
    getInitialPrefixes(searchParams),
  );
  // The URL owns the current folder; local history only supplies toolbar traversal.
  const prefixHistory =
    !prefix || savedHistory.includes(prefix)
      ? savedHistory
      : getInitialPrefixes(searchParams);
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

  const { data, error, isLoading, refetch } = useBrowseObjects(bucketName, {
    prefix,
    limit: LIMIT,
  });

  const files = data?.objects ?? [];
  const folders = data?.prefixes ?? [];
  const total = files.reduce((sum, o) => sum + o.size, 0);

  return (
    <section aria-label="Objects">
      <ObjectListNavigator
        curPrefix={curPrefix}
        setCurPrefix={setCurPrefix}
        prefixHistory={prefixHistory}
        prefix={prefix}
        actions={<Actions prefix={prefix} />}
      />

      <Panel flush id="objects">
        {data ? (
          <p
            className="border-b border-rule px-3 py-2 text-ink-3"
            aria-live="polite"
          >
            {`${plural(folders.length, "folder")} · ${plural(files.length, "object")} · ${readableBytes(total)}`}
            {data.nextToken ? ` · the first ${LIMIT} entries are shown` : null}
          </p>
        ) : null}

        <ObjectList
          data={data}
          error={error}
          isLoading={isLoading}
          onRetry={() => void refetch()}
          prefix={prefix}
          onPrefixChange={gotoPrefix}
        />
      </Panel>

      <ShareDialog />
    </section>
  );
};

export default BrowseTab;
