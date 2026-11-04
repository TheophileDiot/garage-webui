import assert from "node:assert/strict";
import { test } from "node:test";
import { copyText } from "./clipboard.ts";

test("copyText succeeds when writeText succeeds, without touching execCopy", async () => {
  let called = false;
  assert.equal(
    await copyText("x", {
      writeText: async () => {},
      execCopy: () => {
        called = true;
        return false;
      },
    }),
    true,
  );
  assert.equal(called, false);
});

test("copyText falls back to execCopy when writeText rejects", async () => {
  assert.equal(
    await copyText("x", {
      writeText: async () => {
        throw new Error("denied");
      },
      execCopy: () => true,
    }),
    true,
  );
});

test("copyText reports failure when both paths fail", async () => {
  assert.equal(
    await copyText("x", {
      writeText: async () => {
        throw new Error("denied");
      },
      execCopy: () => false,
    }),
    false,
  );
  assert.equal(await copyText("x", { execCopy: () => false }), false);
});

test("copyText uses execCopy when writeText is absent", async () => {
  assert.equal(await copyText("x", { execCopy: () => true }), true);
});

test("copyText treats a throwing execCopy as a failure", async () => {
  assert.equal(
    await copyText("x", {
      execCopy: () => {
        throw new Error("no document");
      },
    }),
    false,
  );
});
