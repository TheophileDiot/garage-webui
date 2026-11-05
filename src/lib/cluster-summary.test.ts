import assert from "node:assert/strict";
import { test } from "node:test";
import { healthTone, summarizeHealth } from "./cluster-summary.ts";

const healthy = {
  status: "healthy",
  knownNodes: 3,
  connectedNodes: 3,
  storageNodes: 3,
  storageNodesUp: 3,
  partitions: 256,
  partitionsQuorum: 256,
  partitionsAllOk: 256,
};
const base = { failed: false, layoutVersion: 7, statusFailed: false };

test("healthTone maps the status Garage reports", () => {
  assert.equal(healthTone("healthy", false), "ok");
  assert.equal(healthTone("degraded", false), "warn");
  assert.equal(healthTone("unavailable", false), "bad");
});

test("healthTone: no reading and a status it does not know are idle, a failed refresh is bad", () => {
  assert.equal(healthTone(undefined, false), "idle");
  assert.equal(healthTone("unknown", false), "idle");
  assert.equal(healthTone("something-new", false), "idle");
  assert.equal(healthTone("healthy", true), "bad");
  assert.equal(healthTone(undefined, true), "bad");
});

test("a failed refresh is unavailable, never the cached healthy counts", () => {
  const s = summarizeHealth({ ...base, health: healthy, failed: true });
  assert.equal(s.word, "status unavailable");
  assert.equal(s.tone, "bad");
  assert.equal(s.nodes, "health request failed");
  assert.equal(s.counted, false);
  assert.equal(s.quorumOnly, 0);
  assert.equal(s.reading.usable, false);
  assert.ok(!s.label.includes("partitions"));
  assert.ok(!s.sidebarLabel.includes("partitions"));
});

test("a usable body gives the words, the counts and the labels", () => {
  const s = summarizeHealth({
    ...base,
    health: { ...healthy, partitionsQuorum: 256, partitionsAllOk: 254 },
  });
  assert.equal(s.word, "healthy");
  assert.equal(s.tone, "ok");
  assert.equal(s.nodes, "3 of 3 nodes");
  assert.equal(s.layout, "layout v7");
  assert.equal(s.counted, true);
  assert.equal(s.quorumOnly, 2);
  assert.equal(s.reading.usable, true);
  assert.equal(s.label, "Cluster healthy: 2 partitions on quorum only");
  assert.equal(
    s.sidebarLabel,
    "healthy 3 of 3 nodes layout v7. Cluster: 2 partitions on quorum only",
  );
});

test("while loading, the shell says so instead of inventing a reading", () => {
  const s = summarizeHealth({
    ...base,
    health: undefined,
    layoutVersion: undefined,
  });
  assert.equal(s.word, "checking…");
  assert.equal(s.tone, "idle");
  assert.equal(s.nodes, "loading nodes…");
  assert.equal(s.layout, "layout …");
  assert.equal(s.counted, false);
  assert.equal(s.label, "Cluster checking…");
  assert.equal(s.sidebarLabel, "checking… loading nodes… layout …");
});

test("degraded, unavailable and unknown statuses", () => {
  const at = (status: string) =>
    summarizeHealth({ ...base, health: { ...healthy, status } });
  assert.deepEqual(
    [at("degraded").word, at("degraded").tone],
    ["degraded", "warn"],
  );
  assert.deepEqual(
    [at("unavailable").word, at("unavailable").tone],
    ["unavailable", "bad"],
  );
  const unknown = at("unknown");
  assert.deepEqual([unknown.word, unknown.tone], ["unknown", "idle"]);
  assert.equal(unknown.counted, false);
  assert.equal(unknown.reading.usable, false);
  // A status the shell has no word for reads "unknown" and is idle (the Overview used to call it bad).
  const odd = at("something-new");
  assert.deepEqual([odd.word, odd.tone], ["unknown", "idle"]);
});

test("node counts prefer storage nodes, then connected of known, else say so", () => {
  const nodes = (h: object) =>
    summarizeHealth({ ...base, health: { ...healthy, ...h } }).nodes;
  assert.equal(nodes({ storageNodes: 4, storageNodesUp: 3 }), "3 of 4 nodes");
  assert.equal(
    nodes({
      storageNodes: undefined,
      storageNodesUp: undefined,
      knownNodes: 5,
      connectedNodes: 4,
    }),
    "4 of 5 nodes",
  );
  assert.equal(
    nodes({
      storageNodes: undefined,
      storageNodesUp: undefined,
      knownNodes: undefined,
      connectedNodes: undefined,
    }),
    "node counts unavailable",
  );
});

test("the layout text follows the layout version and the status query", () => {
  const layout = (o: object) =>
    summarizeHealth({ ...base, health: healthy, ...o }).layout;
  assert.equal(layout({ layoutVersion: 0 }), "layout v0");
  assert.equal(
    layout({ layoutVersion: undefined, statusFailed: true }),
    "layout unavailable",
  );
  assert.equal(layout({ layoutVersion: undefined }), "layout …");
});

test("a body without partition counts has no glyph counts", () => {
  const s = summarizeHealth({
    ...base,
    health: { status: "healthy", storageNodes: 3, storageNodesUp: 3 },
  });
  assert.equal(s.word, "healthy");
  assert.equal(s.counted, false);
  assert.equal(s.reading.usable, false);
  assert.equal(s.label, "Cluster healthy");
});
