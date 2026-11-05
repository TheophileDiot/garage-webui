/** The three tabs of a bucket page. Pure and import-free: node --test runs this file as it is. */
type BucketTab = "objects" | "access" | "settings";

/**
 * Which tab a `?tab=` value names. The values before the redesign (`browse`, `permissions`, `overview`) keep
 * working, and anything else opens Objects, the tab a bucket opens on.
 */
export const bucketTab = (raw: string | null): BucketTab =>
  raw === "access" || raw === "permissions"
    ? "access"
    : raw === "settings" || raw === "overview"
      ? "settings"
      : "objects";
