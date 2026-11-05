import assert from "node:assert/strict";
import { test } from "node:test";
import { grantsByKey, keyLabel, keysPerBucket, sortGrants } from "./utils.ts";

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

test("sortGrants orders by name then bucket id, whatever the input order", () => {
  const grants = [
    { bucketId: "b4", name: "media-assets" },
    { bucketId: "b2", name: "backups" },
    { bucketId: "b9", name: "logs" },
    { bucketId: "b1", name: "backups" },
    { bucketId: "b3", name: "archive" },
  ];
  const want = ["b3", "b1", "b2", "b9", "b4"];
  const ids = (list: { bucketId: string }[]) => list.map((g) => g.bucketId);
  assert.deepEqual(ids(sortGrants(grants)), want);
  assert.deepEqual(ids(sortGrants([...grants].reverse())), want);
  assert.deepEqual(
    ids(sortGrants([grants[2], grants[4], grants[0], grants[3], grants[1]])),
    want,
  );
  // The first three, which the page shows, are the same for every order.
  assert.deepEqual(ids(sortGrants([...grants].reverse()).slice(0, 3)), [
    "b3",
    "b1",
    "b2",
  ]);
});

test("sortGrants does not change its input", () => {
  const grants = [
    { bucketId: "b2", name: "b" },
    { bucketId: "b1", name: "a" },
  ];
  sortGrants(grants);
  assert.equal(grants[0].bucketId, "b2");
});

const perm = (read = true, write = false, owner = false) => ({
  read,
  write,
  owner,
});
const bucket = (id: string, extra: object = {}) => ({
  id,
  globalAliases: [] as string[],
  localAliases: [] as { accessKeyId: string; alias: string }[],
  keys: [] as { accessKeyId: string; permissions: ReturnType<typeof perm> }[],
  ...extra,
});

test("grantsByKey joins buckets to keys by access key id, sorted, with the key's own alias", () => {
  const map = grantsByKey([
    bucket("b2", {
      globalAliases: ["zeta"],
      keys: [
        { accessKeyId: "K1", permissions: perm(true, true) },
        { accessKeyId: "K2", permissions: perm() },
      ],
    }),
    bucket("b1", {
      localAliases: [
        { accessKeyId: "K2", alias: "mine" },
        { accessKeyId: "K1", alias: "other" },
      ],
      keys: [{ accessKeyId: "K1", permissions: perm(true, true, true) }],
    }),
    bucket("b3", { globalAliases: ["alpha"] }),
  ] as never);
  assert.deepEqual(map.get("K1"), [
    // "other" is K1's own local alias on b1; it sorts before "zeta".
    { bucketId: "b1", name: "other", read: true, write: true, owner: true },
    { bucketId: "b2", name: "zeta", read: true, write: true, owner: false },
  ]);
  assert.deepEqual(map.get("K2"), [
    { bucketId: "b2", name: "zeta", read: true, write: false, owner: false },
  ]);
  assert.equal(map.has("K3"), false);
});

test("grantsByKey never shows another key's local alias", () => {
  const map = grantsByKey([
    bucket("b1", {
      localAliases: [{ accessKeyId: "K2", alias: "theirs" }],
      keys: [{ accessKeyId: "K1", permissions: perm() }],
    }),
  ] as never);
  assert.equal(map.get("K1")?.[0].name, "b1");
});

test("grantsByKey keeps the same first three whatever order the list arrives in", () => {
  const list = ["d", "a", "c", "b"].map((n, i) =>
    bucket(`id${i}`, {
      globalAliases: [n],
      keys: [{ accessKeyId: "K", permissions: perm() }],
    }),
  );
  const names = (l: unknown[]) =>
    (grantsByKey(l as never).get("K") ?? []).map((g) => g.name);
  assert.deepEqual(names(list), ["a", "b", "c", "d"]);
  assert.deepEqual(names([...list].reverse()), ["a", "b", "c", "d"]);
});

test("keysPerBucket ranks by key count, then name, and counts a bucket with no keys", () => {
  const rows = keysPerBucket([
    bucket("b1", { globalAliases: ["beta"], keys: [{}, {}] }),
    bucket("b2", { globalAliases: ["alpha"], keys: [{}, {}] }),
    bucket("b3", { globalAliases: ["gamma"], keys: [{}, {}, {}] }),
    bucket("b4", { globalAliases: ["delta"] }),
    bucket("b5", { globalAliases: ["omega"], keys: undefined }),
  ] as never);
  assert.deepEqual(rows, [
    { id: "b3", name: "gamma", count: 3 },
    { id: "b2", name: "alpha", count: 2 },
    { id: "b1", name: "beta", count: 2 },
    { id: "b4", name: "delta", count: 0 },
    { id: "b5", name: "omega", count: 0 },
  ]);
});
