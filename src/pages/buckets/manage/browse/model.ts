/** Pure helpers of the object browser. Import-free (type imports only) so `node --test` runs them. */
import type { ObjectTarget } from "./types";

export const plural = (n: number, word: string) =>
  `${n} ${word}${n === 1 ? "" : "s"}`;

/** The last part of a full folder prefix: `photos/2026/` gives `2026`. */
export const folderLabel = (prefix: string) =>
  prefix.substring(0, prefix.lastIndexOf("/")).split("/").pop() || prefix;

/** A file name split at its last dot; a leading dot is part of the name. */
export const splitName = (key: string) => {
  const dot = key.lastIndexOf(".");
  return dot > 0
    ? { stem: key.substring(0, dot), ext: key.substring(dot) }
    : { stem: key, ext: "" };
};

/** The extension of a key without its dot; empty for none (a leading dot is part of the name). */
export const extOf = (key: string) => splitName(key).ext.substring(1);

/** One link target per folder level of a prefix, for the path breadcrumb. */
export const pathParts = (prefix: string) => {
  const parts = prefix.split("/").filter(Boolean);
  return parts.map((label, i) => ({
    label,
    path: parts.slice(0, i + 1).join("/") + "/",
  }));
};

/** Every folder level of a prefix as a full prefix: `a/b/` gives `a/`, `a/b/`. */
export const prefixTrail = (prefix: string) =>
  pathParts(prefix).map((part) => part.path);

/** The toolbar's back/forward history: the saved one while the URL prefix is in it, else the trail to the URL prefix. */
export const historyFor = (prefix: string, saved: string[]) =>
  !prefix || saved.includes(prefix) ? saved : prefixTrail(prefix);

/** A short type for the list: the extension and the kind (`PNG image`), from the MIME type the extension maps to. */
export const typeLabel = (key: string, mime: string) => {
  const ext = extOf(key).toUpperCase();
  if (!ext) return "File";
  const kind = mime.split("/")[0];
  return `${ext} ${["image", "audio", "video", "text"].includes(kind) ? kind : "file"}`;
};

/** The filter box matches the start of a name, ignoring case and outer spaces. */
export const matchesFilter = (name: string, filter: string) =>
  name.toLowerCase().startsWith(filter.trim().toLowerCase());

export const toggleKey = (keys: string[], key: string) =>
  keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key];

/** The selected keys that are still listed, in list order: a refetch or a filter never leaves a hidden selection. */
export const selectedIn = (keys: string[], listed: string[]) =>
  listed.filter((k) => keys.includes(k));

/** `s3://` addresses use the bucket's global alias and the full key. */
export const objectUri = (bucketName: string, prefix: string, key: string) =>
  `s3://${bucketName}/${prefix}${key}`;

export const isFolder = (t: ObjectTarget) => t.objectKey.endsWith("/");

/** The last part of the key, for labels and messages. */
export const targetName = (t: ObjectTarget) =>
  t.objectKey.replace(/\/$/, "").split("/").pop() || t.objectKey;

/** Objects can be listed with a key that reads and writes, through the bucket's global alias. */
export const canBrowse = (
  keys: { permissions: { read: boolean; write: boolean } }[],
  globalAlias: string,
) =>
  Boolean(globalAlias) &&
  keys.some((k) => k.permissions.read && k.permissions.write);
