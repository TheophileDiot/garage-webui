import assert from "node:assert/strict";
import test from "node:test";
import { PHONE_ORDER, phoneOrderClass, stagedLine } from "./phone.ts";

test("phone order: verdict, alerts, staged notice, then nodes and the rest", () => {
  assert.deepEqual(
    [...PHONE_ORDER],
    ["health", "watch", "staged", "nodes", "stored", "disk", "partitions"],
  );
  assert.ok(PHONE_ORDER.indexOf("watch") < PHONE_ORDER.indexOf("nodes"));
  assert.ok(PHONE_ORDER.indexOf("staged") < PHONE_ORDER.indexOf("nodes"));
});

test("every section's class is its 1-based place in the order", () => {
  PHONE_ORDER.forEach((s, i) =>
    assert.equal(phoneOrderClass(s), `max-nav:order-${i + 1}`),
  );
});

test("staged line counts and pluralises", () => {
  assert.equal(stagedLine(1), "1 layout change staged");
  assert.equal(stagedLine(3), "3 layout changes staged");
});
