/** Pure rules of the phone shell (below 961 px): the health chip word, the staged badge, which bottom bar shows. */

/** The word beside the top bar's health glyph, from the `word` of `summarizeHealth`. */
export const chipWord = (word: string): string =>
  word === "status unavailable"
    ? "Unavailable"
    : word === "checking…"
      ? "Checking"
      : word.charAt(0).toUpperCase() + word.slice(1);

/** The count on the Cluster item: capped at 9+, with the full count in its accessible text. */
export const stagedBadge = (
  staged: number,
): { text: string; label: string } | null =>
  staged > 0
    ? {
        text: staged > 9 ? "9+" : String(staged),
        label: `${staged} staged layout ${staged === 1 ? "change" : "changes"}`,
      }
    : null;

/** One bottom bar at a time: a page that claims the slot replaces the navigation; a wide screen has neither. */
export const barKind = (i: {
  wide: boolean;
  claims: number;
}): "none" | "nav" | "page" =>
  i.wide ? "none" : i.claims > 0 ? "page" : "nav";
