import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bucketName,
  bucketTotals,
  grantBucketName,
  localAliasesOf,
  quotaTone,
  quotaValue,
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
