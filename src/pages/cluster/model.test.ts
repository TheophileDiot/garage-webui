import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildRows,
  duration,
  groupByZone,
  matchesQuery,
  stagedLines,
  summarizeZones,
} from "./model.ts";

const fmt = (b: number) => `${b / 1e9} GB`;
const node = (id: string, extra: object = {}) =>
  ({
    id,
    hostname: `host-${id}`,
    addr: `10.0.0.${id}:3901`,
    isUp: true,
    lastSeenSecsAgo: 0,
    ...extra,
  }) as never;
const layout = {
  version: 3,
  roles: [
    { id: "1", zone: "par1", capacity: 1e12, tags: ["n1"] },
    { id: "2", zone: "ams1", capacity: null, tags: [] },
    { id: "4", zone: "lyon", capacity: 2e12, tags: [] },
  ],
  stagedRoleChanges: [
    { id: "1", zone: "par1", capacity: 2e12, tags: ["n1"] },
    { id: "4", remove: true },
    { id: "3", zone: "new", capacity: 5e11, tags: ["x"] },
  ],
} as never;
const nodes = [node("1"), node("2"), node("3"), node("4", { isUp: false })];

test("duration", () => {
  assert.equal(duration(12), "12 s");
  assert.equal(duration(312), "5 min 12 s");
  assert.equal(duration(7380), "2 h 3 min");
  assert.equal(duration(90000), "1 d 1 h");
});

test("buildRows lays staged changes over the applied role", () => {
  const rows = buildRows(nodes, layout);
  assert.equal(rows[0].capacity, 2e12);
  assert.equal(rows[0].current?.capacity, 1e12);
  assert.equal(rows[1].capacity, null);
  assert.equal(rows[2].zone, "new");
  assert.equal(rows[2].current, undefined);
  assert.equal(rows[3].removing, true);
  assert.equal(rows[3].zone, "lyon");
});

test("a node with no role and no staged change is unassigned", () => {
  const [row] = buildRows([node("9")], layout);
  assert.equal(row.zone, null);
  assert.equal(row.capacity, undefined);
  assert.deepEqual(
    groupByZone([row]).map((g) => g.zone),
    [null],
  );
});

test("matchesQuery copes with a missing address", () => {
  const [row] = buildRows([node("1", { addr: null })], layout);
  assert.equal(matchesQuery(row, "par1"), true);
  assert.equal(matchesQuery(row, "10.0"), false);
  assert.equal(matchesQuery(row, "N1"), true);
});

test("stagedLines covers change, removal and new assignment", () => {
  const rows = buildRows(nodes, layout);
  const text = stagedLines(layout, rows, fmt).map((l) => `${l.sign} ${l.text}`);
  assert.deepEqual(text, [
    "  host-1  1",
    "- 1000 GB",
    "+ 2000 GB",
    "  host-4  4",
    "- zone lyon · 2000 GB",
    "+ removed from the layout",
    "  host-3  3",
    "+ zone new",
    "+ 500 GB",
    "+ tags x",
  ]);
});

test("summarizeZones counts nodes, capacity and reporting disks", () => {
  const rows = buildRows(
    [
      node("1", { dataPartition: { available: 4, total: 10 } }),
      node("4", { isUp: false }),
    ],
    layout,
  );
  const par = summarizeZones(rows).find((z) => z.zone === "par1");
  assert.deepEqual(
    {
      n: par?.nodes,
      up: par?.up,
      cap: par?.capacity,
      free: par?.free,
      rep: par?.reporting,
    },
    { n: 1, up: 1, cap: 2e12, free: 4, rep: 1 },
  );
});
