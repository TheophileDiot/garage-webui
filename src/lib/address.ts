/**
 * Address bar and palette logic. Pure and import-free: node --test runs this file as it is.
 * Routes stay ID-based (`/buckets/:id`); the address only shows a name for them.
 */

/** `aliases` = global aliases only. `name` = the first one, else the ID. Local aliases are per-key, never an address. */
export type AddressBucket = { id: string; name: string; aliases: string[] };

export const toAddressBucket = (b: {
  id: string;
  globalAliases?: string[] | null;
}): AddressBucket => {
  const aliases = b.globalAliases ?? [];
  return { id: b.id, name: aliases[0] || b.id, aliases: [...aliases] };
};

const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

const PLACES = {
  overview: "/",
  buckets: "/buckets",
  keys: "/keys",
  cluster: "/cluster",
} as const;
type Place = keyof typeof PLACES;
const isPlace = (s: string): s is Place =>
  Object.prototype.hasOwnProperty.call(PLACES, s);

/** Router path for the first `count` segments of a `garage://` address: `overview` is the home page, `/`. */
export const garageSegmentRoute = (parts: string[], count: number): string =>
  count === 1 && isPlace(parts[0])
    ? PLACES[parts[0]]
    : `/${parts.slice(0, count).join("/")}`;

/** The address bar text for a location. */
export const addressForRoute = (
  pathname: string,
  search: string,
  buckets: AddressBucket[],
): string => {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return "garage://overview";
  if (parts[0] === "buckets" && parts.length === 2) {
    const id = safeDecode(parts[1]);
    const name = buckets.find((b) => b.id === id)?.name ?? id;
    const params = new URLSearchParams(search);
    const prefix =
      params.get("tab") === "browse" ? (params.get("prefix") ?? "") : "";
    return `s3://${name}/${prefix}`;
  }
  return `garage://${parts.map(safeDecode).join("/")}`;
};

type AddressSegment = { label: string; to: string };

/** Splits the address text into linked segments. Bucket segments link by ID, never by the name shown. */
export const toSegments = (
  text: string,
  pathname: string,
): {
  scheme: "s3" | "garage";
  segments: AddressSegment[];
  trailing: boolean;
} => {
  const m = /^(s3|garage):\/\/(.*)$/.exec(text);
  const scheme = (m?.[1] ?? "garage") as "s3" | "garage";
  const rest = m?.[2] ?? text;
  if (scheme === "s3") {
    const id = safeDecode(pathname.split("/").filter(Boolean)[1] ?? "");
    const at = rest.indexOf("/");
    const name = at < 0 ? rest : rest.slice(0, at);
    const prefix = at < 0 ? "" : rest.slice(at + 1);
    const base = `/buckets/${encodeURIComponent(id)}`;
    const segments: AddressSegment[] = [{ label: name, to: base }];
    let acc = "";
    for (const part of prefix.split("/").filter(Boolean)) {
      acc += `${part}/`;
      segments.push({
        label: part,
        to: `${base}?${new URLSearchParams({ tab: "browse", prefix: acc })}`,
      });
    }
    return { scheme, segments, trailing: prefix.endsWith("/") || !prefix };
  }
  const parts = rest.split("/").filter(Boolean);
  return {
    scheme,
    segments: parts.map((label, i) => ({
      label,
      to: garageSegmentRoute(parts, i + 1),
    })),
    trailing: false,
  };
};

type Index = {
  buckets: AddressBucket[];
  keys: { id: string; name: string }[];
  nodes: { id: string; hostname: string }[];
};

const findBucket = (head: string, buckets: AddressBucket[]) =>
  buckets.find((b) => b.id === head || b.aliases.includes(head));

const bucketRoute = (bucket: AddressBucket, tail: string) => {
  const base = `/buckets/${encodeURIComponent(bucket.id)}`;
  if (!tail) return base;
  const prefix = tail.endsWith("/") ? tail : `${tail}/`;
  return `${base}?${new URLSearchParams({ tab: "browse", prefix })}`;
};

const searchRoute = (place: "keys" | "cluster", text: string) =>
  `${PLACES[place]}?${new URLSearchParams({ q: text })}`;

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
      ? searchRoute(head, rest)
      : null;
  };
  if (scheme === "garage") return place();

  const asPlace = place();
  if (asPlace) return asPlace;
  const bucket = findBucket(head, idx.buckets);
  if (bucket) return bucketRoute(bucket, tail);
  if (tail) return null;
  const key = idx.keys.find((k) => k.id === head || k.name === head);
  if (key) return searchRoute("keys", key.id);
  const node = idx.nodes.find((n) => n.id === head || n.hostname === head);
  if (node) return searchRoute("cluster", node.id);
  return null;
};
