import assert from "node:assert/strict";
import { test } from "node:test";
import {
  resolveAddress,
  toAddressBucket,
  type AddressBucket,
} from "./address.ts";
import { targetLabel } from "./crumbs.ts";

const buckets: AddressBucket[] = [
  { id: "b1", name: "media-assets", aliases: ["media-assets"] },
  { id: "b2", name: "b2", aliases: [] },
  // Reserved-name collision: a bucket whose alias is `keys`.
  { id: "b3", name: "keys", aliases: ["keys"] },
];
const idx = {
  buckets,
  keys: [{ id: "GK1", name: "ci-deploy" }],
  nodes: [{ id: "n1", hostname: "ams1-b" }],
};

test("resolveAddress opens buckets, with or without a prefix", () => {
  assert.equal(
    resolveAddress("media-assets/photos/", idx),
    "/buckets/b1?tab=objects&prefix=photos%2F",
  );
  assert.equal(resolveAddress("s3://media-assets", idx), "/buckets/b1");
  assert.equal(resolveAddress("b2", idx), "/buckets/b2");
});

test("resolveAddress finds keys and nodes", () => {
  assert.equal(resolveAddress("keys/ci-deploy", idx), "/keys?q=ci-deploy");
  assert.equal(resolveAddress("cluster/ams1-b", idx), "/cluster?q=ams1-b");
  assert.equal(resolveAddress("garage://keys/ci", idx), "/keys?q=ci");
  assert.equal(resolveAddress("garage://cluster/ams", idx), "/cluster?q=ams");
  assert.equal(resolveAddress("ci-deploy", idx), "/keys?q=GK1");
  assert.equal(resolveAddress("GK1", idx), "/keys?q=GK1");
  assert.equal(resolveAddress("ams1-b", idx), "/cluster?q=n1");
  assert.equal(resolveAddress("nope/x/", idx), null);
  assert.equal(resolveAddress("   ", idx), null);
});

test("the scheme decides the namespace", () => {
  assert.equal(resolveAddress("s3://keys", idx), "/buckets/b3");
  assert.equal(resolveAddress("garage://keys", idx), "/keys");
  assert.equal(resolveAddress("keys", idx), "/keys");
  assert.equal(resolveAddress("garage://overview", idx), "/");
  assert.equal(resolveAddress("garage://buckets", idx), "/buckets");
  assert.equal(resolveAddress("overview", idx), "/");
  assert.equal(resolveAddress("s3://ci-deploy", idx), null);
  assert.equal(resolveAddress("garage://media-assets", idx), null);
});

test("every resolved bucket route names the bucket it opens", () => {
  for (const [typed, name] of [
    ["s3://media-assets", "s3://media-assets/"],
    ["media-assets/photos/2026/", "s3://media-assets/photos/2026/"],
    ["b2", "s3://b2/"],
    ["s3://keys", "s3://keys/"],
  ]) {
    const route = resolveAddress(typed, idx);
    assert.ok(route, typed);
    assert.equal(targetLabel(route, buckets), name, typed);
  }
});

test("a local-only bucket is addressed by its ID", () => {
  assert.deepEqual(
    toAddressBucket({
      id: "b4",
      globalAliases: [],
      localAliases: [{ accessKeyId: "GK1", alias: "mine" }],
    } as never),
    { id: "b4", name: "b4", aliases: [] },
  );
  const withB4 = [...buckets, toAddressBucket({ id: "b4", globalAliases: [] })];
  assert.equal(targetLabel("/buckets/b4", withB4), "s3://b4/");
  assert.equal(
    resolveAddress("s3://b4", { ...idx, buckets: withB4 }),
    "/buckets/b4",
  );
});

test("toAddressBucket tolerates a missing alias list", () => {
  assert.deepEqual(toAddressBucket({ id: "b5" } as never), {
    id: "b5",
    name: "b5",
    aliases: [],
  });
});
