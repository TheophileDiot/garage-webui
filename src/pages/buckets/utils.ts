import { readableBytes } from "../../lib/format.ts";
import type { Bucket } from "./types";

/** Display name of a bucket: first global alias, else first local alias, else its id. */
export const bucketName = (
  bucket: Pick<Bucket, "id" | "globalAliases" | "localAliases"> &
    Partial<Pick<Bucket, "keys">>,
) => bucket.globalAliases?.[0] || localAliasesOf(bucket)[0]?.alias || bucket.id;

/**
 * Name of a bucket in a view scoped to one key: first global alias, else a local alias owned by that key, else the
 * id. A local alias is only valid for its own key, so another key's alias is never shown.
 */
export const grantBucketName = (
  bucket: Pick<Bucket, "id" | "globalAliases" | "localAliases"> &
    Partial<Pick<Bucket, "keys">>,
  accessKeyId: string,
) =>
  bucket.globalAliases?.[0] ||
  localAliasesOf(bucket).find((l) => l.accessKeyId === accessKeyId)?.alias ||
  bucket.id;

type LocalAliasView = {
  alias: string;
  accessKeyId: string;
  /** Name of the key the alias belongs to, when the bucket's key list carries it. */
  keyName?: string;
};

/**
 * Local aliases of a bucket. The `/api/buckets` list carries `localAliases`; `GetBucketInfo` only carries them per
 * key (`keys[].bucketLocalAliases`), so both sources are merged.
 */
export const localAliasesOf = (
  bucket: Pick<Bucket, "localAliases"> & Partial<Pick<Bucket, "keys">>,
): LocalAliasView[] => {
  const seen = new Set<string>();
  const out: LocalAliasView[] = [];
  const add = (alias: string, accessKeyId: string) => {
    const id = `${accessKeyId}\u0000${alias}`;
    if (seen.has(id)) return;
    seen.add(id);
    out.push({
      alias,
      accessKeyId,
      keyName: bucket.keys?.find((k) => k.accessKeyId === accessKeyId)?.name,
    });
  };
  for (const l of bucket.localAliases ?? []) add(l.alias, l.accessKeyId);
  for (const k of bucket.keys ?? [])
    for (const alias of k.bucketLocalAliases ?? []) add(alias, k.accessKeyId);
  return out;
};

/** A quota is "set" when positive: `null` and `0` both mean no quota (the list encodes none as 0). */
export const quotaValue = (n: number | null | undefined) =>
  n != null && n > 0 ? n : null;

/** Meter tone for a used share: calm, warning from 75 %, bad when full. */
export const quotaTone = (ratio: number): "ink" | "warn" | "bad" =>
  ratio >= 1 ? "bad" : ratio >= 0.75 ? "warn" : "ink";

/** The `s3://` address of a bucket: its first global alias, else its id. A local alias only works for one key. */
export const s3Uri = (
  bucket: Pick<Bucket, "id" | "globalAliases" | "localAliases">,
) => `s3://${bucket.globalAliases?.[0] || bucket.id}`;

/** Keys that hold at least one permission on the bucket (the Access tab and the list count the same keys). */
export const grantedKeys = (keys: Bucket["keys"] | undefined) =>
  (keys ?? []).filter(
    (k) => k.permissions.read || k.permissions.write || k.permissions.owner,
  );

export type QuotaUse = {
  kind: "size" | "objects";
  used: number;
  max: number;
  ratio: number;
};

/** Every quota that is set on a bucket, size first, with the share used. Empty when the bucket has no quota. */
export const quotaUses = (
  bucket: Pick<Bucket, "bytes" | "objects" | "quotas">,
): QuotaUse[] => {
  const size = quotaValue(bucket.quotas?.maxSize);
  const objects = quotaValue(bucket.quotas?.maxObjects);
  return [
    ...(size ? [{ kind: "size" as const, used: bucket.bytes, max: size }] : []),
    ...(objects
      ? [{ kind: "objects" as const, used: bucket.objects, max: objects }]
      : []),
  ].map((q) => ({ ...q, ratio: q.used / q.max }));
};

/** One quota figure: a size in bytes, or an object count with its unit. */
export const quotaAmount = (kind: QuotaUse["kind"], n: number) =>
  kind === "size" ? readableBytes(n) : `${n.toLocaleString()} objects`;

/** "used of max" for a quota; an object count carries its unit once, at the end. */
export const quotaFraction = (q: QuotaUse) =>
  q.kind === "size"
    ? `${readableBytes(q.used)} of ${readableBytes(q.max)}`
    : `${q.used.toLocaleString()} of ${quotaAmount(q.kind, q.max)}`;

/** The used share of a quota as a whole percent. Not capped: an over-quota bucket reads above 100. */
export const quotaPercent = (q: Pick<QuotaUse, "ratio">) =>
  Math.round(q.ratio * 100);

/** Bytes and objects across a bucket list. */
export const bucketTotals = (buckets: Pick<Bucket, "bytes" | "objects">[]) => ({
  bytes: buckets.reduce((s, b) => s + b.bytes, 0),
  objects: buckets.reduce((s, b) => s + b.objects, 0),
});
