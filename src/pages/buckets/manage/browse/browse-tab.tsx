import { useSearchParams } from "react-router-dom";
import ObjectList from "./object-list";
import { useState } from "react";
import ObjectListNavigator from "./object-list-navigator";
import Actions from "./actions";
import { useBucketContext } from "../context";
import ShareDialog from "./share-dialog";
import { EmptyState } from "@/components/ui/state";
import { LockKeyhole } from "lucide-react";
import Button from "@/components/ui/button";

const getInitialPrefixes = (searchParams: URLSearchParams) => {
  const prefix = searchParams.get("prefix");
  if (prefix) {
    const paths = prefix.split("/").filter((p) => p);
    return paths.map((_, i) => paths.slice(0, i + 1).join("/") + "/");
  }
  return [];
};

const BrowseTab = () => {
  const { bucket } = useBucketContext();
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

  if (!bucket.keys.find((k) => k.permissions.read && k.permissions.write)) {
    return (
      <section className="panel">
        <EmptyState
          icon={LockKeyhole}
          title="Browsing needs a key"
          action={
            <Button
              href={`/buckets/${bucket.id}?tab=permissions`}
              color="primary"
            >
              Open permissions
            </Button>
          }
        >
          Allow a key with read and write access on this bucket to browse its
          objects.
        </EmptyState>
      </section>
    );
  }

  return (
    <section className="panel overflow-hidden" aria-label="Objects">
      <ObjectListNavigator
        curPrefix={curPrefix}
        setCurPrefix={setCurPrefix}
        prefixHistory={prefixHistory}
        actions={<Actions prefix={prefix} />}
      />

      <ObjectList prefix={prefix} onPrefixChange={gotoPrefix} />

      <ShareDialog />
    </section>
  );
};

export default BrowseTab;
