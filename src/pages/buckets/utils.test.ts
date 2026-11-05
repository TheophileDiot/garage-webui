import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bucketName,
  bucketTotals,
  grantBucketName,
  grantedKeys,
  localAliasesOf,
  quotaAmount,
  quotaFraction,
  quotaPercent,
  quotaTone,
  quotaUses,
  quotaValue,
  s3Uri,
} from "./utils.ts";

test("bucketTotals adds bytes and objects", () => {
  assert.deepEqual(bucketTotals([]), { bytes: 0, objects: 0 });
  assert.deepEqual(
    bucketTotals([
      { bytes: 10, objects: 1 },
      { bytes: 5, objects: 4 },
    ]),
    { bytes: 15, objects: 5 },
  );
});

test("quotaValue treats null, undefined and 0 as no quota", () => {
  assert.equal(quotaValue(null), null);
  assert.equal(quotaValue(undefined), null);
  assert.equal(quotaValue(0), null);
  assert.equal(quotaValue(-1), null);
  assert.equal(quotaValue(10), 10);
});

test("quotaTone warns from 75 % and goes bad when full", () => {
  assert.equal(quotaTone(0), "ink");
  assert.equal(quotaTone(0.749), "ink");
  assert.equal(quotaTone(0.75), "warn");
  assert.equal(quotaTone(0.999), "warn");
  assert.equal(quotaTone(1), "bad");
  assert.equal(quotaTone(1.4), "bad");
});

test("bucketName prefers the global alias, then a local alias, then the id", () => {
  const local = [{ accessKeyId: "K", alias: "mine" }];
  assert.equal(
    bucketName({ id: "i", globalAliases: ["g"], localAliases: local }),
    "g",
  );
  assert.equal(
    bucketName({ id: "i", globalAliases: [], localAliases: local }),
    "mine",
  );
  assert.equal(
    bucketName({ id: "i", globalAliases: [], localAliases: [] }),
    "i",
  );
});

test("localAliasesOf merges the list and the per-key sources without repeats", () => {
  const out = localAliasesOf({
    localAliases: [{ accessKeyId: "K1", alias: "a" }],
    keys: [
      { accessKeyId: "K1", name: "one", bucketLocalAliases: ["a", "b"] },
      { accessKeyId: "K2", name: "two", bucketLocalAliases: ["a"] },
    ] as never,
  });
  assert.deepEqual(
    out.map((o) => `${o.accessKeyId}:${o.alias}`),
    ["K1:a", "K1:b", "K2:a"],
  );
  assert.equal(out[0].keyName, "one");
});

test("grantBucketName never shows a local alias that belongs to another key", () => {
  const b = {
    id: "bid",
    globalAliases: [] as string[],
    localAliases: [{ accessKeyId: "J", alias: "j-alias" }],
  };
  assert.equal(grantBucketName(b, "K"), "bid");
  assert.equal(grantBucketName(b, "J"), "j-alias");
  assert.equal(grantBucketName({ ...b, globalAliases: ["pub"] }, "K"), "pub");
  const viaKeys = {
    ...b,
    localAliases: [],
    keys: [
      { accessKeyId: "J", name: "j", bucketLocalAliases: ["kj"] },
    ] as never,
  };
  assert.equal(grantBucketName(viaKeys, "K"), "bid");
  assert.equal(grantBucketName(viaKeys, "J"), "kj");
});

test("s3Uri uses the first global alias, else the bucket id, never a local alias", () => {
  assert.equal(
    s3Uri({ id: "i", globalAliases: ["g", "h"], localAliases: [] }),
    "s3://g",
  );
  assert.equal(
    s3Uri({
      id: "i",
      globalAliases: [],
      localAliases: [{ accessKeyId: "K", alias: "mine" }],
    }),
    "s3://i",
  );
});

test("grantedKeys keeps keys with at least one permission", () => {
  const key = (read: boolean, write: boolean, owner: boolean) =>
    ({ accessKeyId: "K", permissions: { read, write, owner } }) as never;
  assert.equal(
    grantedKeys([key(false, false, false), key(true, false, false)]).length,
    1,
  );
  assert.equal(grantedKeys([key(false, false, true)]).length, 1);
  assert.equal(grantedKeys([]).length, 0);
});

test("quotaUses lists each quota that is set, with its used share", () => {
  assert.deepEqual(
    quotaUses({ bytes: 5, objects: 1, quotas: { maxSize: 0, maxObjects: 0 } }),
    [],
  );
  assert.deepEqual(
    quotaUses({
      bytes: 50,
      objects: 3,
      quotas: { maxSize: 200, maxObjects: null },
    }),
    [{ kind: "size", used: 50, max: 200, ratio: 0.25 }],
  );
  const both = quotaUses({
    bytes: 10,
    objects: 90,
    quotas: { maxSize: 100, maxObjects: 100 },
  });
  assert.deepEqual(
    both.map((q) => [q.kind, q.ratio]),
    [
      ["size", 0.1],
      ["objects", 0.9],
    ],
  );
  assert.equal(
    quotaUses({ bytes: 1, objects: 1, quotas: undefined as never }).length,
    0,
  );
});

test("quotaAmount spells a size in bytes and an object count with its unit", () => {
  assert.equal(quotaAmount("size", 1536), "1.5 KB");
  assert.equal(
    quotaAmount("objects", 1234567),
    `${(1234567).toLocaleString()} objects`,
  );
  assert.equal(quotaAmount("objects", 1), "1 objects");
});

test("quotaFraction writes used of max, the unit once for objects", () => {
  assert.equal(
    quotaFraction({ kind: "size", used: 512, max: 2048, ratio: 0.25 }),
    "512.0 B of 2.0 KB",
  );
  assert.equal(
    quotaFraction({ kind: "objects", used: 5, max: 1000, ratio: 0.005 }),
    `5 of ${(1000).toLocaleString()} objects`,
  );
});

test("quotaPercent rounds the used share and does not cap it", () => {
  assert.equal(quotaPercent({ ratio: 0 }), 0);
  assert.equal(quotaPercent({ ratio: 0.754 }), 75);
  assert.equal(quotaPercent({ ratio: 0.755 }), 76);
  assert.equal(quotaPercent({ ratio: 1.4 }), 140);
});
