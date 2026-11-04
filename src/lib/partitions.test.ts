import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allocateCells,
  hasPartitionCounts,
  hasUsableHealth,
  ofCounts,
  partitionStates,
  runsFromCounts,
  safeRatio,
} from "./partitions.ts";

test("partitionStates splits the counts from health", () => {
  assert.deepEqual(
    partitionStates({
      partitions: 256,
      partitionsQuorum: 256,
      partitionsAllOk: 102,
    }),
    { full: 102, quorumOnly: 154, none: 0 },
  );
  assert.deepEqual(
    partitionStates({
      partitions: 256,
      partitionsQuorum: 250,
      partitionsAllOk: 100,
    }),
    { full: 100, quorumOnly: 150, none: 6 },
  );
});

test("partitionStates handles an empty or inconsistent health", () => {
  assert.deepEqual(
    partitionStates({ partitions: 0, partitionsQuorum: 0, partitionsAllOk: 0 }),
    { full: 0, quorumOnly: 0, none: 0 },
  );
  assert.deepEqual(
    partitionStates({
      partitions: 10,
      partitionsQuorum: 8,
      partitionsAllOk: 9,
    }),
    { full: 9, quorumOnly: 0, none: 2 },
  );
});

test("safeRatio guards the denominator", () => {
  assert.equal(safeRatio(5, 0), 0);
  assert.equal(safeRatio(3, 4), 0.75);
  assert.equal(safeRatio(9, 4), 1);
  assert.equal(safeRatio(-1, 4), 0);
  assert.equal(safeRatio(1, Number.NaN), 0);
  assert.equal(safeRatio(Number.POSITIVE_INFINITY, 4), 0);
});

test("allocateCells keeps the total and never hides a state that exists", () => {
  assert.deepEqual(
    allocateCells({ full: 102, quorumOnly: 154, none: 0 }, 256),
    { full: 102, quorumOnly: 154, none: 0 },
  );
  assert.deepEqual(allocateCells({ full: 255, quorumOnly: 0, none: 1 }, 100), {
    full: 99,
    quorumOnly: 0,
    none: 1,
  });
  assert.deepEqual(allocateCells({ full: 0, quorumOnly: 0, none: 0 }, 256), {
    full: 0,
    quorumOnly: 0,
    none: 0,
  });
  const a = allocateCells({ full: 1, quorumOnly: 1, none: 1 }, 256);
  assert.equal(a.full + a.quorumOnly + a.none, 256);
  // Three fractional remainders of 2/3 each: the loop bound must not shrink as cells are handed out.
  const b = allocateCells({ full: 1, quorumOnly: 1, none: 1 }, 2);
  assert.equal(b.full + b.quorumOnly + b.none, 2);
  const c = allocateCells({ full: 7, quorumOnly: 5, none: 3 }, 10);
  assert.equal(c.full + c.quorumOnly + c.none, 10);
});

test("ofCounts prints two finite counts and nothing for a partial health body", () => {
  assert.equal(ofCounts(3, 5), "3 of 5");
  assert.equal(ofCounts(0, 0), "0 of 0");
  assert.equal(ofCounts(undefined, 5), null);
  assert.equal(ofCounts(3, Number.NaN), null);
  assert.equal(ofCounts(Infinity, 5), null);
});

test("hasPartitionCounts is false when any partition count is missing", () => {
  assert.equal(
    hasPartitionCounts({
      partitions: 256,
      partitionsQuorum: 256,
      partitionsAllOk: 1,
    }),
    true,
  );
  assert.equal(hasPartitionCounts({} as never), false);
  assert.equal(
    hasPartitionCounts({ partitions: 256, partitionsQuorum: 256 } as never),
    false,
  );
});

test("runsFromCounts draws one rectangle per row segment", () => {
  assert.deepEqual(runsFromCounts({ full: 16, quorumOnly: 0, none: 0 }), {
    full: "M0 0h16v1h-16z",
    degraded: "",
    lost: "",
  });
  assert.deepEqual(runsFromCounts({ full: 20, quorumOnly: 4, none: 3 }), {
    full: "M0 0h16v1h-16zM0 1h4v1h-4z",
    degraded: "M4 1h4v1h-4z",
    lost: "M8 1h3v1h-3z",
  });
});

test("runsFromCounts splits a run that crosses a row and leaves the rest empty", () => {
  const r = runsFromCounts({ full: 0, quorumOnly: 18, none: 0 });
  assert.equal(r.degraded, "M0 0h16v1h-16zM0 1h2v1h-2z");
  assert.equal(r.full + r.lost, "");
  assert.deepEqual(runsFromCounts({ full: 0, quorumOnly: 0, none: 0 }), {
    full: "",
    degraded: "",
    lost: "",
  });
});

test("hasUsableHealth wants a known status and a partition", () => {
  const ok = {
    status: "healthy",
    partitions: 256,
    partitionsQuorum: 256,
    partitionsAllOk: 256,
  };
  assert.equal(hasUsableHealth(ok), true);
  assert.equal(hasUsableHealth(undefined), false);
  assert.equal(hasUsableHealth({ ...ok, status: "unknown" }), false);
  assert.equal(hasUsableHealth({ ...ok, partitions: 0 }), false);
  assert.equal(hasUsableHealth({ status: "healthy", partitions: 256 }), false);
});
