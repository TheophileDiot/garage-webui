import assert from "node:assert/strict";
import { test } from "node:test";
import { keyLabel } from "./utils.ts";

test("keyLabel prefers the name and falls back to 8 characters of the id", () => {
  assert.equal(
    keyLabel({ name: "ci-deploy", id: "GK1234567890" }),
    "ci-deploy",
  );
  assert.equal(keyLabel({ name: "", id: "GK1234567890" }), "GK123456");
  assert.equal(keyLabel({ accessKeyId: "GK1234567890" }), "GK123456");
  assert.equal(keyLabel({ name: null, accessKeyId: "GK12" }), "GK12");
  assert.equal(keyLabel({}), "");
});
