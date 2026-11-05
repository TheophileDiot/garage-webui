import assert from "node:assert/strict";
import { test } from "node:test";
import { crumbsForRoute, targetLabel } from "./crumbs.ts";
import type { AddressBucket } from "./address.ts";

const buckets: AddressBucket[] = [
  { id: "b1", name: "media-assets", aliases: ["media-assets"] },
  { id: "b2", name: "b2", aliases: [] },
];

test("crumbsForRoute names the places", () => {
  assert.deepEqual(crumbsForRoute("/", buckets), [{ label: "Overview" }]);
  assert.deepEqual(crumbsForRoute("/buckets", buckets), [{ label: "Buckets" }]);
  assert.deepEqual(crumbsForRoute("/keys", buckets), [
    { label: "Access keys" },
  ]);
  assert.deepEqual(crumbsForRoute("/cluster", buckets), [{ label: "Cluster" }]);
});

test("a bucket route links back to the list and shows the bucket name", () => {
  assert.deepEqual(crumbsForRoute("/buckets/b1", buckets), [
    { label: "Buckets", to: "/buckets" },
    { label: "media-assets" },
  ]);
  // A bucket with no supplied name shows its ID.
  assert.deepEqual(crumbsForRoute("/buckets/b2", buckets), [
    { label: "Buckets", to: "/buckets" },
    { label: "b2" },
  ]);
});

test("an unknown bucket ID is its own label", () => {
  assert.deepEqual(crumbsForRoute("/buckets/zz9", buckets), [
    { label: "Buckets", to: "/buckets" },
    { label: "zz9" },
  ]);
  assert.deepEqual(crumbsForRoute("/buckets/zz9", []), [
    { label: "Buckets", to: "/buckets" },
    { label: "zz9" },
  ]);
});

test("a trailing slash does not change the route", () => {
  assert.deepEqual(crumbsForRoute("/buckets/", buckets), [
    { label: "Buckets" },
  ]);
  assert.deepEqual(crumbsForRoute("/keys/", buckets), [
    { label: "Access keys" },
  ]);
});

test("anything else is not found", () => {
  assert.deepEqual(crumbsForRoute("/nope", buckets), [{ label: "Not found" }]);
  assert.deepEqual(crumbsForRoute("/keys/x", buckets), [
    { label: "Not found" },
  ]);
  assert.deepEqual(crumbsForRoute("/buckets/b1/extra", buckets), [
    { label: "Not found" },
  ]);
  // Object keys are not places: a prototype property name must not match.
  assert.deepEqual(crumbsForRoute("/constructor", buckets), [
    { label: "Not found" },
  ]);
  assert.deepEqual(crumbsForRoute("/toString", buckets), [
    { label: "Not found" },
  ]);
});

test("a 63-character name comes back whole; truncation is CSS", () => {
  const long =
    "long-bucket-name-segment-long-bucket-name-segment-long-bucket-z";
  assert.equal(long.length, 63);
  const crumbs = crumbsForRoute("/buckets/b9", [{ id: "b9", name: long }]);
  assert.equal(crumbs[1].label, long);
  assert.equal(crumbs[1].label.length, 63);
});

test("a malformed escape in the path stays as it is", () => {
  assert.deepEqual(crumbsForRoute("/buckets/%E0%A4%A", []), [
    { label: "Buckets", to: "/buckets" },
    { label: "%E0%A4%A" },
  ]);
});

test("targetLabel describes where a palette address leads", () => {
  assert.equal(targetLabel("/buckets/b1", buckets), "s3://media-assets/");
  assert.equal(
    targetLabel("/buckets/b1?tab=objects&prefix=photos%2F2026%2F", buckets),
    "s3://media-assets/photos/2026/",
  );
  assert.equal(targetLabel("/buckets/b2", buckets), "s3://b2/");
  assert.equal(targetLabel("/", buckets), "Overview");
  assert.equal(targetLabel("/buckets", buckets), "Buckets");
  assert.equal(targetLabel("/keys", buckets), "Access keys");
  assert.equal(
    targetLabel("/keys?q=ci-deploy", buckets),
    "Access keys: ci-deploy",
  );
  assert.equal(targetLabel("/cluster?q=ams1-b", buckets), "Cluster: ams1-b");
});

test("a prefix only shows on the objects tab", () => {
  assert.equal(
    targetLabel("/buckets/b1?tab=access&prefix=x%2F", buckets),
    "s3://media-assets/",
  );
  // The legacy value still names the objects tab.
  assert.equal(
    targetLabel("/buckets/b1?tab=browse&prefix=x%2F", buckets),
    "s3://media-assets/x/",
  );
});
