import Page from "@/context/page-context";
import { useBuckets } from "./hooks";
import BucketCard from "./components/bucket-card";
import CreateBucketDialog from "./components/create-bucket-dialog";
import { useMemo, useState } from "react";
import { Archive, Search } from "lucide-react";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/state";
import { bucketName } from "./utils";

const BucketsPage = () => {
  const { data, isPending, error, refetch } = useBuckets();
  const [search, setSearch] = useState("");

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data || [])
      .map((bucket) => ({
        ...bucket,
        aliases: [
          ...(bucket.globalAliases || []),
          ...(bucket.localAliases?.map((l) => l.alias) || []),
        ],
      }))
      .filter(
        (bucket) =>
          !q ||
          bucket.id.includes(q) ||
          bucket.aliases.some((alias) => alias.toLowerCase().includes(q)),
      )
      .sort((a, b) => bucketName(a).localeCompare(bucketName(b)));
  }, [data, search]);

  const largest = useMemo(
    () => Math.max(0, ...(data || []).map((bucket) => bucket.bytes)),
    [data],
  );

  return (
    <div className="container">
      <Page title="Buckets" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="input input-bordered flex w-full items-center gap-2 sm:max-w-sm">
          <Search
            size={16}
            aria-hidden
            className="shrink-0 text-base-content/70"
          />
          <span className="sr-only">Search buckets</span>
          <input
            type="search"
            className="grow bg-transparent outline-none"
            placeholder="Search by name or id"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <p className="num text-sm text-base-content/70" aria-live="polite">
          {data
            ? `${items.length} of ${data.length} ${data.length === 1 ? "bucket" : "buckets"}`
            : null}
        </p>
        <div className="flex-1" />
        <CreateBucketDialog />
      </div>

      <section className="panel mt-6 overflow-hidden" aria-label="Buckets">
        {isPending ? (
          <SkeletonRows label="Loading buckets" rows={5} />
        ) : error ? (
          <ErrorState
            title="Could not load buckets"
            error={error}
            onRetry={() => void refetch()}
          />
        ) : data.length === 0 ? (
          <EmptyState icon={Archive} title="No buckets yet">
            Create your first bucket to start storing objects.
          </EmptyState>
        ) : items.length === 0 ? (
          <EmptyState icon={Search} title="No bucket matches your search">
            Try a different name or part of a bucket id.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-base-300">
            {items.map((bucket) => (
              <BucketCard key={bucket.id} data={bucket} largest={largest} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default BucketsPage;
