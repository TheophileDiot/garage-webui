import Page from "@/context/page-context";
import { useBuckets } from "./hooks";
import BucketLedger, { BucketRow } from "./components/bucket-ledger";
import BucketSummary from "./components/bucket-summary";
import CreateBucketDialog from "./components/create-bucket-dialog";
import { useMemo, useState } from "react";
import Button from "@/components/ui/button";
import { SearchField } from "@/components/ui/input";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/state";
import { readableBytes } from "@/lib/utils";
import { bucketName, bucketTotals, localAliasesOf } from "./utils";

const BucketsPage = () => {
  const { data, isPending, error, refetch } = useBuckets();
  const [search, setSearch] = useState("");

  const items = useMemo<BucketRow[]>(() => {
    const q = search.trim().toLowerCase();
    return (data || [])
      .map((bucket) => ({
        ...bucket,
        name: bucketName(bucket),
        aliases: [
          ...(bucket.globalAliases || []),
          ...localAliasesOf(bucket).map((l) => l.alias),
        ],
      }))
      .filter(
        (bucket) =>
          !q ||
          bucket.id.toLowerCase().includes(q) ||
          bucket.aliases.some((alias) => alias.toLowerCase().includes(q)),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, search]);

  const { bytes: totalBytes, objects: totalObjects } = bucketTotals(data || []);
  const websites = (data || []).filter((b) => b.websiteAccess).length;

  return (
    <>
      <Page title="Buckets" />
      <PageHeader
        title="Buckets"
        meta={
          data
            ? `${data.length} ${data.length === 1 ? "bucket" : "buckets"} · ${readableBytes(totalBytes)} · ${totalObjects.toLocaleString()} objects · ${websites} ${websites === 1 ? "website" : "websites"}`
            : undefined
        }
      />

      <div className="mb-3.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <SearchField
          label="Search buckets by alias or ID"
          placeholder="Search by alias or ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <p className="text-ink-3" aria-live="polite">
          {data ? `${items.length} of ${data.length}` : null}
        </p>
        <div className="ml-auto">
          <CreateBucketDialog />
        </div>
      </div>

      <Panel id="buckets" flush>
        {isPending ? (
          <SkeletonRows label="Loading buckets" rows={5} />
        ) : error ? (
          <ErrorState
            title="Could not load buckets"
            error={error}
            onRetry={() => void refetch()}
          />
        ) : data.length === 0 ? (
          <EmptyState title="No buckets yet">
            Create your first bucket to start storing objects.
          </EmptyState>
        ) : items.length === 0 ? (
          <EmptyState
            title="No bucket matches your search"
            action={<Button onClick={() => setSearch("")}>Clear search</Button>}
          >
            Try a different alias, or part of a bucket ID.
          </EmptyState>
        ) : (
          <BucketLedger rows={items} total={data.length} />
        )}
      </Panel>

      {data && data.length > 0 ? <BucketSummary buckets={data} /> : null}
    </>
  );
};

export default BucketsPage;
