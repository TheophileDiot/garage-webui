/**
 * Palette address logic: what someone types becomes a router path. Pure (its only import, `routes.ts`, is pure too):
 * node --test runs this file as it is. Routes stay ID-based (`/buckets/:id`); a name only helps to find them.
 */
import { bucketPath, PLACES, searchPath } from "./routes.ts";

/** `aliases` = global aliases only. `name` = the first one, else the ID. Local aliases are per-key, never an address. */
export type AddressBucket = { id: string; name: string; aliases: string[] };

export const toAddressBucket = (b: {
  id: string;
  globalAliases?: string[] | null;
}): AddressBucket => {
  const aliases = b.globalAliases ?? [];
  return { id: b.id, name: aliases[0] || b.id, aliases: [...aliases] };
};

type Place = keyof typeof PLACES;
const isPlace = (s: string): s is Place =>
  Object.prototype.hasOwnProperty.call(PLACES, s);

type Index = {
  buckets: AddressBucket[];
  keys: { id: string; name: string }[];
  nodes: { id: string; hostname: string }[];
};

const findBucket = (head: string, buckets: AddressBucket[]) =>
  buckets.find((b) => b.id === head || b.aliases.includes(head));

const bucketRoute = (bucket: AddressBucket, tail: string) =>
  tail
    ? bucketPath(bucket.id, "objects", tail.endsWith("/") ? tail : `${tail}/`)
    : bucketPath(bucket.id);

const split = (raw: string) => {
  const at = raw.indexOf("/");
  return at < 0
    ? { head: raw, tail: "" }
    : { head: raw.slice(0, at), tail: raw.slice(at + 1) };
};

/**
 * Turn what someone typed into a router path, or null. The scheme decides the namespace and is never stripped
 * before dispatch: `s3://keys` is the bucket aliased `keys`, `garage://keys` is the keys page.
 */
export const resolveAddress = (input: string, idx: Index): string | null => {
  const text = input.trim();
  const scheme = /^(s3|garage):\/\//i.exec(text)?.[1].toLowerCase();
  const raw = text.replace(/^(s3|garage):\/\//i, "").replace(/^\/+/, "");
  if (!raw) return null;
  const { head, tail } = split(raw);
  const rest = tail.replace(/\/+$/, "");

  if (scheme === "s3") {
    const bucket = findBucket(head, idx.buckets);
    return bucket ? bucketRoute(bucket, tail) : null;
  }

  const place = (): string | null => {
    if (!isPlace(head)) return null;
    if (!rest) return PLACES[head];
    return head === "keys" || head === "cluster"
      ? searchPath(head, rest)
      : null;
  };
  if (scheme === "garage") return place();

  const asPlace = place();
  if (asPlace) return asPlace;
  const bucket = findBucket(head, idx.buckets);
  if (bucket) return bucketRoute(bucket, tail);
  if (tail) return null;
  const key = idx.keys.find((k) => k.id === head || k.name === head);
  if (key) return searchPath("keys", key.id);
  const node = idx.nodes.find((n) => n.id === head || n.hostname === head);
  if (node) return searchPath("cluster", node.id);
  return null;
};
