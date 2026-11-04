import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addressForRoute,
  garageSegmentRoute,
  resolveAddress,
  toSegments,
  toAddressBucket,
  type AddressBucket,
} from "./address.ts";

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

test("addressForRoute names places and buckets", () => {
  assert.equal(addressForRoute("/", "", buckets), "garage://overview");
  assert.equal(addressForRoute("/cluster", "", buckets), "garage://cluster");
  assert.equal(addressForRoute("/buckets", "", buckets), "garage://buckets");
  assert.equal(addressForRoute("/keys", "", buckets), "garage://keys");
  assert.equal(
    addressForRoute("/buckets/b1", "", buckets),
    "s3://media-assets/",
  );
  assert.equal(
    addressForRoute("/buckets/b1", "?tab=browse&prefix=photos/2026/", buckets),
    "s3://media-assets/photos/2026/",
  );
  assert.equal(addressForRoute("/buckets/b2", "", buckets), "s3://b2/");
  assert.equal(addressForRoute("/buckets/zz", "", buckets), "s3://zz/");
  assert.equal(addressForRoute("/nope", "", buckets), "garage://nope");
});

test("a prefix only shows on the browse tab", () => {
  assert.equal(
    addressForRoute("/buckets/b1", "?tab=permissions&prefix=x/", buckets),
    "s3://media-assets/",
  );
});

test("resolveAddress opens buckets, with or without a prefix", () => {
  assert.equal(
    resolveAddress("media-assets/photos/", idx),
    "/buckets/b1?tab=browse&prefix=photos%2F",
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

test("every bucket route round-trips", () => {
  for (const r of [
    "/buckets/b1",
    "/buckets/b2",
    "/buckets/b3",
    "/buckets/b1?tab=browse&prefix=photos%2F2026%2F",
  ]) {
    const [path, query] = r.split("?");
    assert.equal(
      resolveAddress(
        addressForRoute(path, query ? `?${query}` : "", buckets),
        idx,
      ),
      r,
    );
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
  assert.equal(
    addressForRoute("/buckets/b4", "", [
      ...buckets,
      toAddressBucket({ id: "b4", globalAliases: [] }),
    ]),
    "s3://b4/",
  );
  assert.equal(
    resolveAddress("s3://b4", {
      ...idx,
      buckets: [...buckets, toAddressBucket({ id: "b4", globalAliases: [] })],
    }),
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

test("garageSegmentRoute sends the overview segment home and keeps other places", () => {
  assert.equal(garageSegmentRoute(["overview"], 1), "/");
  assert.equal(garageSegmentRoute(["cluster"], 1), "/cluster");
  assert.equal(garageSegmentRoute(["keys"], 1), "/keys");
  assert.equal(garageSegmentRoute(["buckets"], 1), "/buckets");
  assert.equal(garageSegmentRoute(["buckets", "b1", "x"], 2), "/buckets/b1");
  assert.equal(garageSegmentRoute(["nope"], 1), "/nope");
});

test("toSegments links a bucket address by ID and each prefix part", () => {
  const text = "s3://media-assets/photos/2026/";
  assert.deepEqual(toSegments(text, "/buckets/b1"), {
    scheme: "s3",
    segments: [
      { label: "media-assets", to: "/buckets/b1" },
      { label: "photos", to: "/buckets/b1?tab=browse&prefix=photos%2F" },
      { label: "2026", to: "/buckets/b1?tab=browse&prefix=photos%2F2026%2F" },
    ],
    trailing: true,
  });
  const bare = toSegments("s3://media-assets/", "/buckets/b1");
  assert.deepEqual(bare.segments, [
    { label: "media-assets", to: "/buckets/b1" },
  ]);
  assert.equal(bare.trailing, true);
});

test("toSegments survives a malformed escape in the path", () => {
  const bad = "/buckets/%E0%A4%A";
  const text = addressForRoute(bad, "", []);
  const { scheme, segments } = toSegments(text, bad);
  assert.equal(scheme, "s3");
  assert.equal(segments[0].label, "%E0%A4%A");
  assert.equal(
    toSegments("garage://keys%E0%A4%A", "/keys%E0%A4%A").segments[0].label,
    "keys%E0%A4%A",
  );
});

test("toSegments keeps the ID link when the bucket name holds / or :", () => {
  const colon = toSegments("s3://a:b/x/", "/buckets/b9");
  assert.deepEqual(colon.segments[0], { label: "a:b", to: "/buckets/b9" });
  assert.equal(colon.segments[1].label, "x");
  // `/` cannot be told apart from a prefix once only text is left; the first link still goes by ID.
  const slash = toSegments("s3://a/b/x/", "/buckets/b9");
  assert.equal(slash.segments[0].to, "/buckets/b9");
  assert.equal(slash.segments[0].label, "a");
});

test("toSegments splits a garage address and routes overview home", () => {
  assert.deepEqual(toSegments("garage://overview", "/"), {
    scheme: "garage",
    segments: [{ label: "overview", to: "/" }],
    trailing: false,
  });
  assert.deepEqual(toSegments("garage://buckets/b1", "/buckets/b1").segments, [
    { label: "buckets", to: "/buckets" },
    { label: "b1", to: "/buckets/b1" },
  ]);
  assert.equal(toSegments("garage://cluster", "/cluster").scheme, "garage");
});
