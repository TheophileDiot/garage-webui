import Page from "@/context/page-context";
import { useBuckets } from "./hooks";
import BucketLedger, { BucketRow } from "./components/bucket-ledger";
import BucketSummary from "./components/bucket-summary";
import CreateBucketDialog from "./components/create-bucket-dialog";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import Button from "@/components/ui/button";
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

  const largest = useMemo(
    () => Math.max(0, ...(data || []).map((bucket) => bucket.bytes)),
    [data],
  );

  const { bytes: totalBytes, objects: totalObjects } = bucketTotals(data || []);

  return (
    <>
      <Page title="Buckets" />
      <PageHeader
        title="Buckets"
        meta={
          data
            ? `${data.length} ${data.length === 1 ? "bucket" : "buckets"} · ${readableBytes(totalBytes)} · ${totalObjects.toLocaleString()} objects`
            : undefined
        }
        actions={<CreateBucketDialog />}
      />

      <Panel id="buckets" flush>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule px-3 py-2">
          <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-sm border border-rule-strong bg-sunk px-2.5 focus-within:border-gold-text md:h-8 md:max-w-sm">
            <Search size={14} className="shrink-0 text-ink-3" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by alias or id"
              aria-label="Search buckets by alias or id"
              className="h-full min-w-0 flex-1 bg-transparent placeholder:text-ink-3 focus-visible:[outline-offset:-1px]"
            />
          </div>
          <p className="text-ink-3" aria-live="polite">
            {data ? `${items.length} of ${data.length}` : null}
          </p>
        </div>
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
            action={<Button onClick={() => setSearch("")}>Clear filter</Button>}
          >
            Try a different alias, or part of a bucket id.
          </EmptyState>
        ) : (
          <BucketLedger rows={items} largest={largest} />
        )}
      </Panel>

      {data && data.length > 0 ? <BucketSummary buckets={data} /> : null}
    </>
  );
};

export default BucketsPage;
