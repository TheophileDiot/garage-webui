import assert from "node:assert/strict";
import { test } from "node:test";
import { bucketPath, PLACES, searchPath } from "./routes.ts";

test("PLACES names the four top-level pages", () => {
  assert.deepEqual(PLACES, {
    overview: "/",
    buckets: "/buckets",
    keys: "/keys",
    cluster: "/cluster",
  });
});

test("bucketPath is the bucket page, with an optional tab and prefix", () => {
  assert.equal(bucketPath("b1"), "/buckets/b1");
  assert.equal(bucketPath("b1", "access"), "/buckets/b1?tab=access");
  assert.equal(bucketPath("b1", "settings"), "/buckets/b1?tab=settings");
  assert.equal(bucketPath("b1", "objects"), "/buckets/b1?tab=objects");
});

test("bucketPath writes tab before prefix and encodes the prefix", () => {
  assert.equal(
    bucketPath("b1", "objects", "photos/2026/"),
    "/buckets/b1?tab=objects&prefix=photos%2F2026%2F",
  );
  assert.equal(
    bucketPath("b1", "objects", "a b&c=d/"),
    "/buckets/b1?tab=objects&prefix=a+b%26c%3Dd%2F",
  );
});

test("bucketPath leaves out an empty prefix", () => {
  assert.equal(bucketPath("b1", "objects", ""), "/buckets/b1?tab=objects");
  assert.equal(bucketPath("b1", undefined, undefined), "/buckets/b1");
});

test("bucketPath encodes an ID that is not path-safe", () => {
  assert.equal(bucketPath("a/b?c#d"), "/buckets/a%2Fb%3Fc%23d");
  assert.equal(bucketPath("a b", "access"), "/buckets/a%20b?tab=access");
});

test("searchPath fills the search box of a page", () => {
  assert.equal(searchPath("keys", "ci-deploy"), "/keys?q=ci-deploy");
  assert.equal(searchPath("cluster", "ams1-b"), "/cluster?q=ams1-b");
  assert.equal(searchPath("keys", "GK1 x&y"), "/keys?q=GK1+x%26y");
});

test("the query round-trips through URLSearchParams", () => {
  const q = "weird &=?/ name";
  const query = searchPath("keys", q).split("?")[1];
  assert.equal(new URLSearchParams(query).get("q"), q);
  const prefix = "a b/c&d=e/";
  const bucketQuery = bucketPath("b1", "objects", prefix).split("?")[1];
  assert.equal(new URLSearchParams(bucketQuery).get("prefix"), prefix);
});
