/**
 * Breadcrumbs and palette labels. Pure and import-free (types only): node --test runs this file as it is.
 * Routes stay ID-based (`/buckets/:id`); a crumb only shows a name for them. Truncation of long names is CSS.
 */
import type { AddressBucket } from "./address.ts";
import { bucketTab } from "./bucket-tabs.ts";

type Crumb = { label: string; to?: string };

const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

const PLACES: Record<string, string> = {
  buckets: "Buckets",
  keys: "Access keys",
  cluster: "Cluster",
};
const isPlace = (s: string) => Object.prototype.hasOwnProperty.call(PLACES, s);

/** The trail the top bar shows for a location. The last crumb is the page you are on and has no link. */
export const crumbsForRoute = (
  pathname: string,
  buckets: Pick<AddressBucket, "id" | "name">[],
): Crumb[] => {
  const parts = pathname.split("/").filter(Boolean).map(safeDecode);
  if (parts.length === 0) return [{ label: "Overview" }];
  const [head, id] = parts;
  if (parts.length === 1 && isPlace(head)) return [{ label: PLACES[head] }];
  if (head === "buckets" && parts.length === 2) {
    const name = buckets.find((b) => b.id === id)?.name ?? id;
    return [{ label: PLACES.buckets, to: "/buckets" }, { label: name }];
  }
  return [{ label: "Not found" }];
};

/**
 * Where a router path from the palette leads, in words: `s3://name/prefix/` for a bucket (a prefix counts only on the
 * objects tab), the page name for a place, with the search text after a colon.
 */
export const targetLabel = (
  target: string,
  buckets: AddressBucket[],
): string => {
  const [path, query = ""] = target.split("?");
  const params = new URLSearchParams(query);
  const crumbs = crumbsForRoute(path, buckets);
  if (crumbs.length === 2) {
    const prefix =
      bucketTab(params.get("tab")) === "objects"
        ? (params.get("prefix") ?? "")
        : "";
    return `s3://${crumbs[1].label}/${prefix}`;
  }
  const q = params.get("q");
  return q ? `${crumbs[0].label}: ${q}` : crumbs[0].label;
};
