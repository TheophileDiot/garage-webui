/** Pure helpers for the phone layouts of the bucket pages. Import-free so `node --test` runs them. */

/** Parts of a one-line summary ("14.7 KB · a day ago"): empty parts are dropped, so nothing prints "—" or "No quota". */
export const metaLine = (parts: (string | null | undefined | false)[]) =>
  parts.filter(Boolean).join(" · ");

/**
 * Where the selection actions live: nowhere without a selection; in the shell's bottom slot on a phone (it replaces the
 * bottom navigation); inline above the list when there is no slot.
 */
export const selectionBarPlace = (selected: number, bottomSlot: boolean) =>
  selected === 0 ? "none" : bottomSlot ? "bottom" : "inline";

/** The selection's summary: the file name and size for one, a count and total for several. */
export const selectionLine = (names: string[], total: string) =>
  names.length === 1
    ? `${names[0]} · ${total}`
    : `${names.length} objects · ${total} total`;
