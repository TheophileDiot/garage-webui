import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildRows,
  diskReading,
  diskTone,
  duration,
  groupByZone,
  matchesQuery,
  stagedLines,
  sumDisks,
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

test("diskReading is null without a usable report and derives used and free share otherwise", () => {
  assert.equal(diskReading({}), null);
  assert.equal(
    diskReading({ dataPartition: { available: 1, total: 0 } }),
    null,
  );
  assert.equal(
    diskReading({ dataPartition: { available: 1, total: -5 } }),
    null,
  );
  assert.deepEqual(
    diskReading({ dataPartition: { available: 4, total: 10 } }),
    {
      total: 10,
      used: 6,
      free: 4,
      share: 0.4,
    },
  );
  // The share is clamped to 0..1, so a bad report cannot draw past a full meter.
  assert.equal(
    diskReading({ dataPartition: { available: 20, total: 10 } })?.share,
    1,
  );
});

test("diskTone calls a disk low under 25 % free and nearly full under 10 %", () => {
  assert.equal(diskTone(30, 100), "ink");
  assert.equal(diskTone(25, 100), "ink");
  assert.equal(diskTone(24, 100), "warn");
  assert.equal(diskTone(10, 100), "warn");
  assert.equal(diskTone(9, 100), "bad");
});

test("sumDisks adds only the rows that report a data disk", () => {
  const rows = buildRows(
    [
      node("1", { dataPartition: { available: 4, total: 10 } }),
      node("2", { dataPartition: { available: 30, total: 50 } }),
      node("3"),
      node("4", { isUp: false, dataPartition: { available: 0, total: 0 } }),
    ],
    layout,
  );
  assert.deepEqual(sumDisks(rows), { total: 60, free: 34, reporting: 2 });
  assert.deepEqual(sumDisks([]), { total: 0, free: 0, reporting: 0 });
});

test("a gateway's disk counts in a zone summary but not in the storage-only Overview total", () => {
  const rows = buildRows(
    [
      node("1", { dataPartition: { available: 4, total: 10 } }),
      node("2", { dataPartition: { available: 5, total: 20 } }),
    ],
    layout,
  );
  // Node 2 is a gateway (capacity null) in zone ams1.
  const ams = summarizeZones(rows).find((z) => z.zone === "ams1");
  assert.deepEqual(
    { total: ams?.total, free: ams?.free, rep: ams?.reporting },
    { total: 20, free: 5, rep: 1 },
  );
  const storage = rows.filter((r) => r.capacity !== null);
  assert.deepEqual(sumDisks(storage), { total: 10, free: 4, reporting: 1 });
});
