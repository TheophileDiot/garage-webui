// Pure helpers for an access key's compact phone row. No imports, so `node --test` runs them.

/**
 * The one-line summary of the buckets a key reaches, for the row's meta line and its accessible name: "No bucket
 * yet", "1 bucket", "4 buckets". `null` while the bucket list is not known: a failed or pending list never reads as
 * "No bucket yet".
 */
export const grantSummary = (count: number | null): string | null =>
  count === null
    ? null
    : count === 0
      ? "No bucket yet"
      : `${count} ${count === 1 ? "bucket" : "buckets"}`;
