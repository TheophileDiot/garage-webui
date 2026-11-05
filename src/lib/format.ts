/** Pure byte formatting. No imports: node --test runs this file as it is. */

const UNITS = ["B", "KB", "MB", "GB", "TB", "PB"];

/** "1.5 KB"; "n/a" for a missing, negative or non-finite size. Sizes past the last unit stay in it. */
export const readableBytes = (bytes?: number | null, divider = 1024) => {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "n/a";

  const i = Math.min(
    UNITS.length - 1,
    Math.max(0, Math.floor(Math.log(bytes) / Math.log(divider))),
  );

  return `${(bytes / Math.pow(divider, i)).toFixed(1)} ${UNITS[i]}`;
};

/** Decimal units (1 GB = 1000 MB): what Garage reports node capacity in. */
export const dec = (bytes: number) => readableBytes(bytes, 1000);
