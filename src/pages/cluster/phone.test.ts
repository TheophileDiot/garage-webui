import assert from "node:assert/strict";
import { test } from "node:test";
import { nodeMeta, nodeSeen, nodeStatus } from "./phone.ts";

const fmt = (b: number) => `${b / 1e9} GB`;
const row = (extra: object = {}) =>
  ({
    node: { id: "1", isUp: true, ...(extra as { node?: object }).node },
    removing: false,
    capacity: 2e12,
    ...extra,
  }) as never;

test("status: draining beats active, a down node is offline", () => {
  assert.deepEqual(nodeStatus({ isUp: true, draining: false }), {
    word: "active",
    tone: "ok",
  });
  assert.deepEqual(nodeStatus({ isUp: true, draining: true }), {
    word: "draining",
    tone: "warn",
  });
  assert.deepEqual(nodeStatus({ isUp: false, draining: false }), {
    word: "offline",
    tone: "bad",
  });
});

test("seen: only for a node that is down", () => {
  assert.equal(nodeSeen({ isUp: true, lastSeenSecsAgo: 0 }), null);
  assert.equal(
    nodeSeen({ isUp: false, lastSeenSecsAgo: 312 }),
    "seen 5 min 12 s ago",
  );
  assert.equal(
    nodeSeen({ isUp: false, lastSeenSecsAgo: null }),
    "no last-seen time",
  );
});

test("meta: capacity and free disk", () => {
  const dataPartition = { total: 1e12, available: 4e11 };
  assert.deepEqual(nodeMeta(row({ node: { dataPartition } }), fmt), {
    role: "2000 GB",
    disk: "400 GB free (40%)",
  });
});

test("meta: a missing disk report is said, not hidden", () => {
  assert.deepEqual(nodeMeta(row(), fmt), {
    role: "2000 GB",
    disk: "no disk report",
  });
});

test("meta: a gateway has no disk line", () => {
  assert.deepEqual(nodeMeta(row({ capacity: null }), fmt), {
    role: "gateway",
    disk: null,
  });
});

test("meta: staged changes are named", () => {
  assert.equal(nodeMeta(row({ removing: true }), fmt).role, "removal staged");
  assert.equal(
    nodeMeta(row({ staged: { id: "1" } }), fmt).role,
    "2000 GB, change staged",
  );
});

test("meta: the free space can use its own formatter", () => {
  const dataPartition = { total: 1e12, available: 4e11 };
  assert.equal(
    nodeMeta(row({ node: { dataPartition } }), fmt, (b) => `${b} B`).disk,
    "400000000000 B free (40%)",
  );
});
