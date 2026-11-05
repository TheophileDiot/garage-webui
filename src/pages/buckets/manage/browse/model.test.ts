import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extOf,
  folderLabel,
  historyFor,
  isFolder,
  matchesFilter,
  objectUri,
  pathParts,
  plural,
  prefixTrail,
  selectedIn,
  splitName,
  targetName,
  toggleKey,
  typeLabel,
} from "./model.ts";

test("folderLabel keeps the last path part of a full prefix", () => {
  assert.equal(folderLabel("photos/2026/"), "2026");
  assert.equal(folderLabel("photos/"), "photos");
  assert.equal(folderLabel("odd"), "odd");
});

test("splitName separates the last extension, and leaves dotfiles whole", () => {
  assert.deepEqual(splitName("report.final.pdf"), {
    stem: "report.final",
    ext: ".pdf",
  });
  assert.deepEqual(splitName("Makefile"), { stem: "Makefile", ext: "" });
  assert.deepEqual(splitName(".env"), { stem: ".env", ext: "" });
});

test("pathParts builds a link target per folder level", () => {
  assert.deepEqual(pathParts(""), []);
  assert.deepEqual(pathParts("photos/2026/"), [
    { label: "photos", path: "photos/" },
    { label: "2026", path: "photos/2026/" },
  ]);
  assert.deepEqual(pathParts("a//b/"), [
    { label: "a", path: "a/" },
    { label: "b", path: "a/b/" },
  ]);
});

test("matchesFilter is a case-insensitive prefix match on the name", () => {
  assert.equal(matchesFilter("Photos/", ""), true);
  assert.equal(matchesFilter("Photos/", "  "), true);
  assert.equal(matchesFilter("Photos/", "pho"), true);
  assert.equal(matchesFilter("Photos/", "hot"), false);
  assert.equal(matchesFilter("a.txt", " A.T "), true);
});

test("toggleKey adds and removes without mutating", () => {
  const start = ["a"];
  assert.deepEqual(toggleKey(start, "b"), ["a", "b"]);
  assert.deepEqual(toggleKey(start, "a"), []);
  assert.deepEqual(start, ["a"]);
});

test("selectedIn keeps only keys that are still listed, in list order", () => {
  assert.deepEqual(selectedIn(["c", "a", "gone"], ["a", "b", "c"]), ["a", "c"]);
  assert.deepEqual(selectedIn([], ["a"]), []);
});

test("objectUri uses the bucket name and the full key", () => {
  assert.equal(
    objectUri("media", "photos/", "a b.png"),
    "s3://media/photos/a b.png",
  );
  assert.equal(objectUri("media", "", "a.png"), "s3://media/a.png");
});

test("typeLabel names a file by its extension and kind", () => {
  assert.equal(typeLabel("cover.png", "image/png"), "PNG image");
  assert.equal(typeLabel("a.mp3", "audio/mpeg"), "MP3 audio");
  assert.equal(typeLabel("README.md", "text/markdown"), "MD text");
  assert.equal(typeLabel("data.json", "application/json"), "JSON file");
  assert.equal(typeLabel("Makefile", ""), "File");
  assert.equal(typeLabel("x.weird", ""), "WEIRD file");
});

test("plural handles one and many", () => {
  assert.equal(plural(1, "object"), "1 object");
  assert.equal(plural(0, "folder"), "0 folders");
  assert.equal(plural(3, "object"), "3 objects");
});

test("extOf is the extension without its dot, empty for none or a leading dot", () => {
  assert.equal(extOf("a/b.png"), "png");
  assert.equal(extOf("archive.tar.gz"), "gz");
  assert.equal(extOf("README"), "");
  assert.equal(extOf(".env"), "");
});

test("prefixTrail lists every folder level of a prefix, each with its trailing slash", () => {
  assert.deepEqual(prefixTrail(""), []);
  assert.deepEqual(prefixTrail("a/"), ["a/"]);
  assert.deepEqual(prefixTrail("a/b/c/"), ["a/", "a/b/", "a/b/c/"]);
  assert.deepEqual(prefixTrail("a//b"), ["a/", "a/b/"]);
});

test("historyFor keeps the saved history while the URL prefix is in it, else rebuilds it", () => {
  const saved = ["a/", "a/b/"];
  assert.equal(historyFor("a/", saved), saved);
  assert.equal(historyFor("", saved), saved);
  assert.deepEqual(historyFor("x/y/", saved), ["x/", "x/y/"]);
});

test("isFolder and targetName read the object key of a row target", () => {
  const folder = { objectKey: "photos/2026/", prefix: "", url: "u" };
  const file = { objectKey: "a b.png", prefix: "photos/", url: "u" };
  assert.equal(isFolder(folder), true);
  assert.equal(isFolder(file), false);
  assert.equal(targetName(folder), "2026");
  assert.equal(targetName(file), "a b.png");
  assert.equal(targetName({ objectKey: "/", prefix: "", url: "u" }), "/");
});
