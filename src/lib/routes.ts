/** Router paths, built in one place. Pure and import-free: node --test runs this file as it is. */

export const PLACES = {
  overview: "/",
  buckets: "/buckets",
  keys: "/keys",
  cluster: "/cluster",
} as const;

export type BucketTab = "objects" | "access" | "settings";

/** `/buckets/:id`, with `?tab=` and `&prefix=` (in that order) when given. An empty prefix is the bucket root. */
export const bucketPath = (id: string, tab?: BucketTab, prefix?: string) => {
  const query = new URLSearchParams();
  if (tab) query.set("tab", tab);
  if (prefix) query.set("prefix", prefix);
  const search = query.toString();
  const base = `/buckets/${encodeURIComponent(id)}`;
  return search ? `${base}?${search}` : base;
};

/** A page whose search box the link fills: `/keys?q=…` or `/cluster?q=…`. */
export const searchPath = (place: "keys" | "cluster", q: string) =>
  `${PLACES[place]}?${new URLSearchParams({ q })}`;
