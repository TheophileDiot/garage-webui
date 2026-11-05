import Button from "@/components/ui/button";
import CopyButton from "@/components/ui/copy-button";
import Chips from "@/components/ui/chips";
import IconButton from "@/components/ui/icon-button";
import { SearchField } from "@/components/ui/input";
import { Ledger, LedgerColumn } from "@/components/ui/ledger";
import { Notice } from "@/components/ui/notice";
import { PageHeader, Panel } from "@/components/ui/page-header";
import Perm from "@/components/ui/perm";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/state";
import { Meter } from "@/components/ui/status";
import { confirmAction } from "@/components/ui/confirm-store";
import Page from "@/context/page-context";
import { dayjs, handleError } from "@/lib/utils";
import { useBuckets } from "@/pages/buckets/hooks";
import { bucketPath, searchPath } from "@/lib/routes";
import { Eye, EyeOff, KeyRound, Trash } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import CreateKeyDialog from "./components/create-key-dialog";
import { fetchSecretKey, useKeys, useRemoveKey } from "./hooks";
import { Key } from "./types";
import { grantsByKey, keyLabel, keysPerBucket, type Grant } from "./utils";
import { toast } from "sonner";

const BucketAccess = ({
  grants,
  keyName,
}: {
  grants: Grant[];
  keyName: string;
}) => {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const visible = expanded ? grants : grants.slice(0, 3);
  if (!grants.length) return <span className="text-ink-3">No bucket yet</span>;
  return (
    <div className="w-full min-w-0 py-1">
      <ul
        id={id}
        aria-label={`Bucket access for ${keyName}`}
        className="grid gap-1"
      >
        {visible.map((g) => (
          <li key={g.bucketId} className="min-w-0">
            <Chips className="w-full p-0 [&>span]:w-full">
              <Link
                to={bucketPath(g.bucketId, "access")}
                className="flex h-9 min-w-0 items-center gap-2 px-2 text-link hover:underline md:h-7"
              >
                <span className="min-w-0 flex-1 truncate" title={g.name}>
                  {g.name}
                </span>
                <Perm
                  read={g.read}
                  write={g.write}
                  owner={g.owner}
                  className="shrink-0 [&>span]:h-5 [&>span]:w-5"
                />
              </Link>
            </Chips>
          </li>
        ))}
      </ul>
      {grants.length > 3 ? (
        <Button
          size="sm"
          variant="ghost"
          className="mt-1 text-link"
          aria-expanded={expanded}
          aria-controls={id}
          aria-label={`${expanded ? "Show less" : `+${grants.length - 3} more`} bucket access for ${keyName}`}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : `+${grants.length - 3} more`}
        </Button>
      ) : null}
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        Showing {visible.length} of {grants.length} bucket grants for {keyName}.
      </span>
    </div>
  );
};

const KeysPage = () => {
  const { data, refetch, isPending, error } = useKeys();
  const buckets = useBuckets();
  // Typing owns the input; `?q=` mirrors it, and an outside change (the palette) flows back in.
  const [params, setParams] = useSearchParams();
  const urlQuery = params.get("q") ?? "";
  const [search, setSearchState] = useState(urlQuery);
  const written = useRef(urlQuery);
  useEffect(() => {
    if (urlQuery !== written.current) {
      written.current = urlQuery;
      setSearchState(urlQuery);
    }
  }, [urlQuery]);
  const [secretKeys, setSecretKeys] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState<Record<string, boolean>>({});

  const removeKey = useRemoveKey();

  const setSearch = (value: string) => {
    written.current = value;
    setSearchState(value);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set("q", value);
        else next.delete("q");
        return next;
      },
      { replace: true },
    );
  };

  const reveal = async (id: string) => {
    setRevealing((prev) => ({ ...prev, [id]: true }));
    try {
      const secret = await fetchSecretKey(id);
      setSecretKeys((prev) => ({ ...prev, [id]: secret }));
    } catch (err) {
      handleError(err);
    } finally {
      setRevealing((prev) => ({ ...prev, [id]: false }));
    }
  };

  const hideSecret = (id: string) =>
    setSecretKeys((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const onRemove = async (key: Key) => {
    const ok = await confirmAction({
      title: "Remove access key",
      message: `Remove ${keyLabel(key)}? Clients using this key lose access to every bucket immediately.`,
      confirmLabel: "Remove key",
      danger: true,
      action: () => removeKey.mutateAsync(key.id),
    });
    if (ok) {
      hideSecret(key.id);
      toast.success("Key removed");
    }
  };

  // Grants per key, joined by access key id (names are not unique) from the bucket list.
  const grants = useMemo(() => grantsByKey(buckets.data ?? []), [buckets.data]);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter(
      (item) =>
        item.id.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q),
    );
  }, [data, search]);

  const hasCreated = !!data?.some((k) => k.created);
  const selected = data?.find((k) => k.id === search.trim())?.id ?? null;

  const columns: LedgerColumn<Key>[] = [
    {
      key: "name",
      header: "Name",
      mobile: "title",
      width: "17%",
      cell: (k) =>
        k.name ? (
          <span className="font-medium [overflow-wrap:anywhere]" title={k.name}>
            {k.name}
          </span>
        ) : (
          <span className="text-ink-3">Unnamed</span>
        ),
    },
    {
      key: "id",
      header: "Access key ID",
      width: "25%",
      cell: (k) => (
        <span className="inline-flex min-w-0 max-w-full items-center gap-x-1">
          <span
            className="min-w-0 truncate font-mono text-caption text-ink-2"
            title={k.id}
          >
            {k.id}
          </span>
          <CopyButton
            value={k.id}
            label={`Copy access key id of ${keyLabel(k)}`}
            iconOnly
          />
        </span>
      ),
    },
    ...(hasCreated
      ? [
          {
            key: "created",
            header: "Created",
            width: "7.5rem",
            cell: (k: Key) =>
              k.created ? (
                <time
                  dateTime={k.created}
                  title={dayjs(k.created).format("YYYY-MM-DD HH:mm:ss")}
                  className="whitespace-nowrap text-ink-2"
                >
                  {dayjs(k.created).format("YYYY-MM-DD")}
                </time>
              ) : (
                <span className="text-ink-3">n/a</span>
              ),
          } satisfies LedgerColumn<Key>,
        ]
      : []),
    {
      key: "buckets",
      header: "Bucket access",
      cell: (k) => {
        if (buckets.isPending) return <span className="text-ink-3">…</span>;
        if (buckets.error)
          return <span className="text-ink-3">Unavailable</span>;
        return (
          <BucketAccess grants={grants.get(k.id) ?? []} keyName={keyLabel(k)} />
        );
      },
    },
    {
      key: "secret",
      header: "Secret key",
      width: "20%",
      cell: (k) =>
        secretKeys[k.id] ? (
          <span className="inline-flex min-w-0 max-w-full items-center gap-x-1">
            <span
              className="min-w-0 truncate font-mono text-caption text-ink-2"
              title={secretKeys[k.id]}
            >
              {secretKeys[k.id]}
            </span>
            <CopyButton
              value={secretKeys[k.id]}
              label={`Copy secret key of ${keyLabel(k)}`}
              iconOnly
            />
            <IconButton
              label={`Hide secret key of ${keyLabel(k)}`}
              icon={EyeOff}
              size="sm"
              onClick={() => hideSecret(k.id)}
            />
          </span>
        ) : (
          <Button
            size="sm"
            icon={Eye}
            loading={revealing[k.id]}
            onClick={() => void reveal(k.id)}
            aria-label={`Reveal secret key of ${keyLabel(k)}`}
          >
            Reveal
          </Button>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      mobile: "actions",
      align: "right",
      width: "4.5rem",
      cell: (k) => (
        <div className="row-actions">
          <IconButton
            label={`Remove key ${keyLabel(k)}`}
            icon={Trash}
            variant="ghost-danger"
            size="sm"
            onClick={() => void onRemove(k)}
          />
        </div>
      ),
    },
  ];

  // Lower half: real data only. Needs both lists; a failed bucket list shows the retry above instead.
  const unused = (data ?? []).filter((k) => !(grants.get(k.id)?.length ?? 0));
  const perBucket = useMemo(
    () => keysPerBucket(buckets.data ?? []),
    [buckets.data],
  );
  const maxCount = perBucket[0]?.count ?? 0;
  const shown = perBucket.slice(0, 6);

  return (
    <>
      <Page title="Access keys" />
      <PageHeader
        title="Access keys"
        meta={
          data
            ? `${data.length} access ${data.length === 1 ? "key" : "keys"} · each grants read, write or owner per bucket`
            : "Access keys · each grants read, write or owner per bucket"
        }
        actions={<CreateKeyDialog />}
      />

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <SearchField
          id="keys-search"
          label="Search access keys"
          placeholder="Search by name or key ID"
          spellCheck={false}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <p className="text-ink-3" aria-live="polite">
          {data
            ? `${items.length} of ${data.length} ${data.length === 1 ? "key" : "keys"}`
            : null}
        </p>
      </div>

      {buckets.error ? (
        <div className="mb-3">
          <Notice
            tone="bad"
            alert
            action={
              <Button size="sm" onClick={() => void buckets.refetch()}>
                Try again
              </Button>
            }
          >
            <strong className="font-semibold">
              Bucket access unavailable.
            </strong>{" "}
            {buckets.error.message}
          </Notice>
        </div>
      ) : null}

      <Panel id="keys" flush className="mb-8">
        {isPending ? (
          <SkeletonRows label="Loading keys" rows={4} />
        ) : error ? (
          <ErrorState
            title="Could not load access keys"
            error={error}
            onRetry={() => void refetch()}
          />
        ) : data.length === 0 ? (
          <EmptyState title="No access keys yet" icon={KeyRound}>
            Create a key, then allow it on a bucket so applications can read and
            write.
          </EmptyState>
        ) : items.length === 0 ? (
          <EmptyState
            title="No key matches your search"
            action={<Button onClick={() => setSearch("")}>Clear search</Button>}
          >
            Try a different name or part of a key id.
          </EmptyState>
        ) : (
          <Ledger
            caption="Access keys"
            columns={columns}
            rows={items}
            rowKey={(k) => k.id}
            selectedKey={selected}
          />
        )}
      </Panel>

      {data && data.length > 0 && buckets.data ? (
        <div className="mb-8 grid items-start gap-4 md:grid-cols-2">
          <Panel
            id="keys-unused"
            title="Keys without a bucket"
            meta={`${unused.length} of ${data.length}`}
          >
            {unused.length ? (
              <ul className="grid gap-1">
                {unused.map((k) => (
                  <li key={k.id} className="min-w-0">
                    <Link
                      to={searchPath("keys", k.id)}
                      title={k.id}
                      className="inline-flex min-h-9 items-center rounded px-1 text-link [overflow-wrap:anywhere] hover:bg-surface-2 hover:underline md:min-h-6"
                    >
                      {keyLabel(k)}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-2">
                Every key reaches at least one bucket.
              </p>
            )}
          </Panel>
          <Panel
            id="keys-per-bucket"
            title="Keys per bucket"
            meta={
              perBucket.length > shown.length
                ? `top ${shown.length} of ${perBucket.length}`
                : `${perBucket.length} ${perBucket.length === 1 ? "bucket" : "buckets"}`
            }
          >
            {shown.length ? (
              <ul className="grid gap-2">
                {shown.map((b) => (
                  <li
                    key={b.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1"
                  >
                    <Link
                      to={bucketPath(b.id, "access")}
                      title={b.name}
                      className="inline-flex min-h-9 min-w-0 items-center rounded px-1 text-link [overflow-wrap:anywhere] hover:bg-surface-2 hover:underline md:min-h-6"
                    >
                      {b.name}
                    </Link>
                    <span className="text-ink-2">
                      {b.count} {b.count === 1 ? "key" : "keys"}
                    </span>
                    <Meter
                      className="col-span-2"
                      value={b.count}
                      max={maxCount}
                      label={`Keys allowed on ${b.name}`}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-2">No buckets yet.</p>
            )}
          </Panel>
        </div>
      ) : null}
    </>
  );
};

export default KeysPage;
