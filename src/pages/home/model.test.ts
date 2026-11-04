import assert from "node:assert/strict";
import { test } from "node:test";
import type { GetHealthResult } from "./types";
import { diskTone, headline, watchItems, type WatchBucket } from "./model.ts";

const health = (status: string, p = 256, q = 256): GetHealthResult =>
  ({
    status,
    knownNodes: 3,
    connectedNodes: 3,
    storageNodes: 3,
    storageNodesUp: 3,
    partitions: p,
    partitionsQuorum: q,
    partitionsAllOk: q,
  }) as GetHealthResult;

test("headline covers failure, loading and each health status", () => {
  assert.equal(headline(undefined, true).title, "Health unavailable");
  assert.deepEqual(headline(undefined, false), {
    title: "Overview",
    text: "Checking the cluster…",
  });
  assert.equal(headline(health("healthy"), false).title, "Healthy");
  assert.equal(
    headline(health("degraded"), false).title,
    "Degraded, quorum holds",
  );
  assert.equal(
    headline(health("degraded", 256, 250), false).title,
    "Degraded, some partitions lack quorum",
  );
  assert.equal(
    headline(health("unavailable", 256, 200), false).title,
    "Unavailable, quorum lost",
  );
  assert.equal(headline(health("mystery"), false).title, "Status unknown");
  // A stale reading beats a failed refetch: health is shown while `failed` is true.
  assert.equal(headline(health("healthy"), true).title, "Healthy");
});

test("headline never prints a count that is not a finite number", () => {
  const partial = { ...health("degraded"), partitions: Number.NaN };
  const h = headline(partial, false);
  assert.equal(h.title, "Degraded");
  assert.match(h.text, /did not report partition counts/);
  assert.doesNotMatch(h.text, /NaN|undefined/);
  const missing = {
    ...health("healthy"),
    partitionsQuorum: undefined,
  } as never;
  assert.match(
    headline(missing, false).text,
    /did not report partition counts/,
  );
});

const bucket = (id: string, extra: object = {}): WatchBucket => ({
  id,
  globalAliases: [`b-${id}`],
  localAliases: [],
  bytes: 0,
  unfinishedMultipartUploads: 0,
  unfinishedMultipartUploadBytes: 0,
  quotas: { maxSize: null },
  ...extra,
});
const rows = (up: boolean) =>
  [
    {
      node: { id: "n1", hostname: "host-1", isUp: up, lastSeenSecsAgo: 90 },
      removing: false,
      zone: "z",
      tags: [],
      capacity: 1,
    },
  ] as never;
const base = {
  quorumOnly: 0,
  name: (b: WatchBucket) => b.globalAliases[0],
  bytes: (n: number) => `${n} B`,
  dec: (n: number) => `${n} B`,
};

test("watchItems is empty when nothing needs a look", () => {
  assert.deepEqual(
    watchItems({ ...base, rows: rows(true), buckets: [bucket("1")] }),
    [],
  );
});

test("watchItems lists a down node with the quorum-only count", () => {
  const [item] = watchItems({
    ...base,
    rows: rows(false),
    quorumOnly: 12,
    buckets: [],
  });
  assert.equal(item.id, "down-n1");
  assert.equal(item.label, "host-1 unreachable");
  assert.equal(
    item.detail,
    "Last seen 1 min 30 s ago. 12 partitions have quorum only.",
  );
  assert.equal(item.to, "/cluster?q=host-1");
});

test("watchItems flags a staged layout, a quota from 75 %, and unfinished uploads", () => {
  const items = watchItems({
    ...base,
    rows: rows(true),
    layout: {
      version: 1,
      roles: [],
      stagedRoleChanges: [{ id: "n1", remove: true }],
    } as never,
    buckets: [
      bucket("1", { bytes: 74, quotas: { maxSize: 100 } }),
      bucket("2", { bytes: 75, quotas: { maxSize: 100 } }),
      bucket("3", { bytes: 5, quotas: { maxSize: 0 } }),
      bucket("4", {
        unfinishedMultipartUploads: 1,
        unfinishedMultipartUploadBytes: 9,
      }),
    ],
  });
  assert.deepEqual(
    items.map((i) => i.id),
    ["staged", "quota-2", "mp-4"],
  );
  assert.equal(items[1].label, "b-2 at 75% of its quota");
  assert.equal(items[1].detail, "75 B of 100 B.");
  assert.equal(items[2].label, "b-4 has 1 unfinished multipart upload");
});

test("diskTone calls a disk low under 25 % free and nearly full under 10 %", () => {
  assert.equal(diskTone(30, 100), "ink");
  assert.equal(diskTone(25, 100), "ink");
  assert.equal(diskTone(24, 100), "warn");
  assert.equal(diskTone(10, 100), "warn");
  assert.equal(diskTone(9, 100), "bad");
});
