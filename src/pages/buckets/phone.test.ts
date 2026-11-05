import assert from "node:assert/strict";
import { test } from "node:test";
import { metaLine, selectionBarPlace, selectionLine } from "./phone.ts";

test("metaLine joins what is there and drops empty parts", () => {
  assert.equal(metaLine(["14.7 KB", "a day ago"]), "14.7 KB · a day ago");
  assert.equal(
    metaLine(["12 objects", "", null, undefined, false, "1.8 MB"]),
    "12 objects · 1.8 MB",
  );
  assert.equal(metaLine([null, ""]), "");
});

test("selectionBarPlace: the phone bar only while files are selected and a bottom slot exists", () => {
  assert.equal(selectionBarPlace(0, true), "none");
  assert.equal(selectionBarPlace(0, false), "none");
  assert.equal(selectionBarPlace(2, true), "bottom");
  assert.equal(selectionBarPlace(2, false), "inline");
});

test("selectionLine names one file and counts several", () => {
  assert.equal(selectionLine(["a.txt"], "1.2 KB"), "a.txt · 1.2 KB");
  assert.equal(
    selectionLine(["a.txt", "b.txt"], "3.0 KB"),
    "2 objects · 3.0 KB total",
  );
});
