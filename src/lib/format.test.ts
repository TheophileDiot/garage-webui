import assert from "node:assert/strict";
import { test } from "node:test";
import { dec, readableBytes } from "./format.ts";

test("readableBytes keeps today's output below the petabyte", () => {
  assert.equal(readableBytes(0), "0.0 B");
  assert.equal(readableBytes(512), "512.0 B");
  assert.equal(readableBytes(1536), "1.5 KB");
  assert.equal(readableBytes(1024 ** 2), "1.0 MB");
  assert.equal(readableBytes(3 * 1024 ** 3), "3.0 GB");
  assert.equal(readableBytes(1024 ** 4), "1.0 TB");
  assert.equal(readableBytes(1e9, 1000), "1.0 GB");
  assert.equal(readableBytes(0.5), "0.5 B");
});

test("readableBytes has a petabyte unit and never runs off the end of the list", () => {
  assert.equal(readableBytes(1024 ** 5), "1.0 PB");
  assert.equal(readableBytes(1e15, 1000), "1.0 PB");
  assert.equal(readableBytes(2.5 * 1024 ** 5), "2.5 PB");
  assert.equal(readableBytes(1024 ** 6), "1024.0 PB");
  assert.ok(!readableBytes(1e30).includes("undefined"));
});

test("readableBytes says n/a for what is not a size", () => {
  for (const v of [
    null,
    undefined,
    Number.NaN,
    -5,
    -(1024 ** 3),
    Infinity,
    -Infinity,
  ])
    assert.equal(readableBytes(v), "n/a", String(v));
});

test("dec counts in thousands", () => {
  assert.equal(dec(1e12), "1.0 TB");
  assert.equal(dec(1500), "1.5 KB");
  assert.equal(dec(1e15), "1.0 PB");
  assert.equal(dec(-1), "n/a");
});
