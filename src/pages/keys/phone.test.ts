import assert from "node:assert/strict";
import { test } from "node:test";
import { grantSummary } from "./phone.ts";

test("grant summary names the count", () => {
  assert.equal(grantSummary(0), "No bucket yet");
  assert.equal(grantSummary(1), "1 bucket");
  assert.equal(grantSummary(4), "4 buckets");
});

test("an unknown bucket list is not 'No bucket yet'", () => {
  assert.equal(grantSummary(null), null);
});
