import assert from "node:assert/strict";
import { test } from "node:test";
import { bucketTab } from "./bucket-tabs.ts";

test("no value, an unknown value and the objects names open Objects", () => {
  for (const raw of [
    null,
    "",
    "browse",
    "objects",
    "junk",
    "ACCESS",
    "Objects",
  ])
    assert.equal(bucketTab(raw), "objects", String(raw));
});

test("access and the legacy permissions open Access", () => {
  assert.equal(bucketTab("access"), "access");
  assert.equal(bucketTab("permissions"), "access");
});

test("settings and the legacy overview open Settings", () => {
  assert.equal(bucketTab("settings"), "settings");
  assert.equal(bucketTab("overview"), "settings");
});
