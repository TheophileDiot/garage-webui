import Button from "@/components/ui/button";
import Page from "@/context/page-context";
import { Copy, Eye, EyeOff, KeySquare, Search, Trash } from "lucide-react";
import { useKeys, useRemoveKey } from "./hooks";
import CreateKeyDialog from "./components/create-key-dialog";
import { toast } from "sonner";
import { copyToClipboard, handleError } from "@/lib/utils";
import { useCallback, useMemo, useState } from "react";
import api from "@/lib/api";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/state";
import { confirmAction } from "@/components/ui/confirm-store";

type KeyInfo = { secretAccessKey?: string };

const KeysPage = () => {
  const { data, refetch, isPending, error } = useKeys();
  const [search, setSearch] = useState("");
  const [secretKeys, setSecretKeys] = useState<Record<string, string>>({});

  const removeKey = useRemoveKey({
    onSuccess: () => {
      void refetch();
      toast.success("Key removed");
    },
    onError: handleError,
  });

  const fetchSecretKey = useCallback(async (id: string) => {
    try {
      const result = await api.get<KeyInfo>("/v2/GetKeyInfo", {
        params: { id, showSecretKey: "true" },
      });
      if (!result?.secretAccessKey) {
        throw new Error("Failed to fetch secret key");
      }
      setSecretKeys((prev) => ({
        ...prev,
        [id]: result.secretAccessKey as string,
      }));
    } catch (err) {
      handleError(err);
    }
  }, []);

  const hideSecret = (id: string) =>
    setSecretKeys((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const onRemove = async (id: string, name: string) => {
    const ok = await confirmAction({
      title: "Remove access key",
      message: `Remove ${name || id}? Clients using this key lose access to every bucket immediately.`,
      confirmLabel: "Remove key",
      danger: true,
    });
    if (ok) removeKey.mutate(id);
  };

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data?.filter(
      (item) =>
        item.id.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <div className="container">
      <Page title="Access keys" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="input input-bordered flex w-full items-center gap-2 sm:max-w-sm">
          <Search
            size={16}
            aria-hidden
            className="shrink-0 text-base-content/70"
          />
          <span className="sr-only">Search keys</span>
          <input
            type="search"
            className="grow bg-transparent outline-none"
            placeholder="Search by name or key id"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <p className="num text-sm text-base-content/70" aria-live="polite">
          {data
            ? `${items?.length ?? 0} of ${data.length} ${data.length === 1 ? "key" : "keys"}`
            : null}
        </p>
        <div className="flex-1" />
        <CreateKeyDialog />
      </div>

      <section className="panel mt-6 overflow-hidden" aria-label="Access keys">
        {isPending ? (
          <SkeletonRows label="Loading keys" rows={4} />
        ) : error ? (
          <ErrorState
            title="Could not load access keys"
            error={error}
            onRetry={() => void refetch()}
          />
        ) : data.length === 0 ? (
          <EmptyState icon={KeySquare} title="No access keys yet">
            Create a key, then allow it on a bucket so applications can read and
            write.
          </EmptyState>
        ) : !items?.length ? (
          <EmptyState icon={Search} title="No key matches your search">
            Try a different name or part of a key id.
          </EmptyState>
        ) : (
          <table className="table table-stack">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Key ID</th>
                <th scope="col">Secret key</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((key) => (
                <tr key={key.id} className="row-hover">
                  <td data-primary className="font-bold">
                    {key.name || (
                      <span className="text-base-content/70">Unnamed</span>
                    )}
                  </td>
                  <td data-label="Key ID">
                    <span className="flex items-center gap-1">
                      <span
                        className="mono max-w-[14rem] truncate"
                        title={key.id}
                      >
                        {key.id}
                      </span>
                      <Button
                        size="sm"
                        color="ghost"
                        icon={Copy}
                        aria-label={`Copy key id of ${key.name || key.id}`}
                        onClick={() => copyToClipboard(key.id)}
                      />
                    </span>
                  </td>
                  <td data-label="Secret key">
                    {!secretKeys[key.id] ? (
                      <Button
                        size="sm"
                        icon={Eye}
                        onClick={() => fetchSecretKey(key.id)}
                        aria-label={`Reveal secret key of ${key.name || key.id}`}
                      >
                        Reveal
                      </Button>
                    ) : (
                      <span className="flex items-center gap-1">
                        <span
                          className="mono max-w-[12rem] truncate"
                          title={secretKeys[key.id]}
                        >
                          {secretKeys[key.id]}
                        </span>
                        <Button
                          size="sm"
                          color="ghost"
                          icon={Copy}
                          aria-label={`Copy secret key of ${key.name || key.id}`}
                          onClick={() => copyToClipboard(secretKeys[key.id])}
                        />
                        <Button
                          size="sm"
                          color="ghost"
                          icon={EyeOff}
                          aria-label={`Hide secret key of ${key.name || key.id}`}
                          onClick={() => hideSecret(key.id)}
                        />
                      </span>
                    )}
                  </td>
                  <td data-label="" className="md:text-right">
                    <Button
                      size="sm"
                      color="ghost"
                      className="text-error hover:bg-error/10"
                      icon={Trash}
                      aria-label={`Remove key ${key.name || key.id}`}
                      onClick={() => onRemove(key.id, key.name)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default KeysPage;
