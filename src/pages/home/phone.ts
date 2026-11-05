// Pure helpers for the phone Overview (below the shell breakpoint): the order of the sections and the one-line
// staged notice. No imports, so `node --test` runs them.

export type OverviewSection =
  "health" | "watch" | "staged" | "nodes" | "stored" | "disk" | "partitions";

/**
 * The phone order: the verdict, then what needs a look, then the one-line staged notice, then the nodes, then the
 * rest. On desktop the DOM order and the two-column grid stay as they are; this order only applies through the
 * `max-nav:order-*` classes below.
 */
export const PHONE_ORDER: readonly OverviewSection[] = [
  "health",
  "watch",
  "staged",
  "nodes",
  "stored",
  "disk",
  "partitions",
];

// Literal class names, so Tailwind sees them. Each is the section's index in `PHONE_ORDER`.
const ORDER_CLASS: Record<OverviewSection, string> = {
  health: "max-nav:order-1",
  watch: "max-nav:order-2",
  staged: "max-nav:order-3",
  nodes: "max-nav:order-4",
  stored: "max-nav:order-5",
  disk: "max-nav:order-6",
  partitions: "max-nav:order-7",
};

/** The class that puts a section at its place in the phone order. */
export const phoneOrderClass = (section: OverviewSection) =>
  ORDER_CLASS[section];

/** "1 layout change staged", "3 layout changes staged": the whole phone notice, the diff lives on Cluster. */
export const stagedLine = (count: number) =>
  `${count} layout ${count === 1 ? "change" : "changes"} staged`;
