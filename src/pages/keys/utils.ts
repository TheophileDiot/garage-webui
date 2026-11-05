import { bucketName, grantBucketName } from "../buckets/utils.ts";
import type { Bucket } from "../buckets/types";

export type Grant = {
  bucketId: string;
  name: string;
  read: boolean;
  write: boolean;
  owner: boolean;
};

type GrantBucket = Pick<Bucket, "id" | "globalAliases" | "localAliases"> &
  Partial<Pick<Bucket, "keys">>;

/** A key as people see it: its name, else the first 8 characters of its access key id. */
export const keyLabel = (key: {
  name?: string | null;
  id?: string;
  accessKeyId?: string;
}) => key.name || (key.id ?? key.accessKeyId ?? "").substring(0, 8);

/**
 * Grants in a fixed order: by the bucket name shown, ties by bucket id. `/api/buckets` comes back in a different order
 * on every call, so the "first three" chips would otherwise change on every load.
 */
export const sortGrants = <T extends { name: string; bucketId: string }>(
  grants: readonly T[],
): T[] =>
  [...grants].sort(
    (a, b) =>
      a.name.localeCompare(b.name) ||
      (a.bucketId < b.bucketId ? -1 : a.bucketId > b.bucketId ? 1 : 0),
  );

/** Grants per key, joined from the bucket list by access key id (names are not unique), in `sortGrants` order. */
export const grantsByKey = (buckets: readonly GrantBucket[]) => {
  const map = new Map<string, Grant[]>();
  for (const bucket of buckets) {
    for (const k of bucket.keys ?? []) {
      const list = map.get(k.accessKeyId) ?? [];
      list.push({
        bucketId: bucket.id,
        name: grantBucketName(bucket, k.accessKeyId),
        ...k.permissions,
      });
      map.set(k.accessKeyId, list);
    }
  }
  for (const [id, list] of map) map.set(id, sortGrants(list));
  return map;
};

/** Buckets by how many keys reach them, most first, ties by name. */
export const keysPerBucket = (buckets: readonly GrantBucket[]) =>
  buckets
    .map((b) => ({ id: b.id, name: bucketName(b), count: b.keys?.length ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
