import assert from "node:assert/strict";
import { test } from "node:test";
import { barKind, chipWord, stagedBadge } from "./phone-shell.ts";

test("chipWord says the status in one word", () => {
  assert.equal(chipWord("healthy"), "Healthy");
  assert.equal(chipWord("degraded"), "Degraded");
  assert.equal(chipWord("unavailable"), "Unavailable");
  assert.equal(chipWord("unknown"), "Unknown");
});

test("chipWord: a failed refresh and a pending read are not a status", () => {
  assert.equal(chipWord("status unavailable"), "Unavailable");
  assert.equal(chipWord("checking…"), "Checking");
});

test("stagedBadge counts staged layout changes, capped at 9+", () => {
  assert.equal(stagedBadge(0), null);
  assert.deepEqual(stagedBadge(1), {
    text: "1",
    label: "1 staged layout change",
  });
  assert.deepEqual(stagedBadge(4), {
    text: "4",
    label: "4 staged layout changes",
  });
  assert.equal(stagedBadge(12)?.text, "9+");
  assert.equal(stagedBadge(12)?.label, "12 staged layout changes");
});

test("barKind: one bottom bar at a time, none on a wide screen", () => {
  assert.equal(barKind({ wide: true, claims: 0 }), "none");
  assert.equal(barKind({ wide: true, claims: 2 }), "none");
  assert.equal(barKind({ wide: false, claims: 0 }), "nav");
  assert.equal(barKind({ wide: false, claims: 1 }), "page");
  assert.equal(barKind({ wide: false, claims: 3 }), "page");
});
