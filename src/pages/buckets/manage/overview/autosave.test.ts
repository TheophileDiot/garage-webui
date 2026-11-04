import assert from "node:assert/strict";
import { test } from "node:test";
import {
  markEdited,
  markSent,
  markSettled,
  newAutosave,
  shouldReset,
} from "./autosave.ts";

test("first snapshot resets the form", () => {
  assert.equal(shouldReset(newAutosave(), "b|-|-"), true);
});

test("a snapshot that echoes the last payload does not reset", () => {
  const s = newAutosave();
  markSent(s, "A");
  markSettled(s);
  assert.equal(shouldReset(s, "A"), false);
});

test("delayed refetch: save A, edit B, save B, refetch A then refetch B never reset", () => {
  const s = newAutosave();
  markSent(s, "A"); // save A sent
  markEdited(s); // user edits to B
  markSent(s, "B"); // save B sent while A is still in flight
  assert.equal(shouldReset(s, "A"), false, "refetch with A arrives mid-save");
  markSettled(s); // A settles
  assert.equal(shouldReset(s, "A"), false, "B still in flight");
  markSettled(s); // B settles
  assert.equal(
    shouldReset(s, "B"),
    false,
    "refetch with B echoes the last payload",
  );
});

test("a stale snapshot never overwrites edits not yet sent", () => {
  const s = newAutosave();
  markSent(s, "A");
  markSettled(s);
  markEdited(s); // typing, debounce not fired yet
  assert.equal(shouldReset(s, "Z"), false);
});

test("idle form settles on a server value that differs from what was sent", () => {
  const s = newAutosave();
  markSent(s, "A");
  markSettled(s);
  assert.equal(shouldReset(s, "A-normalised"), true);
  assert.equal(
    shouldReset(s, "A-normalised"),
    false,
    "reset adopts the snapshot",
  );
});

test("an external change back to an older payload still resets", () => {
  const s = newAutosave();
  markSent(s, "A");
  markSettled(s);
  assert.equal(shouldReset(s, "X"), true);
  assert.equal(shouldReset(s, "A"), true);
});

test("a failed save leaves the in-flight count at zero", () => {
  const s = newAutosave();
  markSent(s, "A");
  markSettled(s);
  markSettled(s);
  assert.equal(s.inFlight, 0);
});
