import assert from "node:assert/strict";
import { test } from "node:test";
import { createSheetHistory } from "./sheet-history.ts";

/**
 * A fake browser history: `go` and `push` only record, `land()` plays the popstate a traversal fires later, so a
 * test can run things in the gap between asking for a traversal and its arrival, exactly where the real defects are.
 */
const setup = () => {
  const log: string[] = [];
  const pops: number[] = [];
  let depth = 0;
  const h = createSheetHistory({
    push: (d) => {
      depth = d;
      log.push(`push ${d}`);
    },
    go: (n) => {
      pops.push(n);
      log.push(`go ${n}`);
    },
  });
  /** The traversal arrives: the page is now `n` entries down, and the controller hears the popstate. */
  const land = () => {
    const n = pops.shift() ?? 0;
    depth += n;
    h.popped(depth);
  };
  /** The user presses Back: one entry down, nothing of ours asked for it. */
  const back = () => {
    depth -= 1;
    h.popped(depth);
  };
  return { h, log, back, land, pops, depth: () => depth };
};

test("opening a sheet adds one entry", () => {
  const t = setup();
  t.h.open(1, () => true);
  assert.deepEqual(t.log, ["push 1"]);
});

test("Back closes the sheet and adds nothing", () => {
  const t = setup();
  let closed = 0;
  t.h.open(1, () => {
    closed++;
    return true;
  });
  t.back();
  assert.equal(closed, 1);
  assert.deepEqual(t.log, ["push 1"]);
  // closing it afterwards (its owner reacts to the close) must not ask for another traversal
  t.h.close(1);
  assert.deepEqual(t.log, ["push 1"]);
});

test("closing by X, Cancel, Escape or submit takes its own entry back, once", () => {
  const t = setup();
  let closed = 0;
  t.h.open(1, () => {
    closed++;
    return true;
  });
  t.h.close(1);
  assert.deepEqual(t.log, ["push 1", "go -1"]);
  t.land();
  assert.equal(closed, 0, "our own traversal is not a Back press");
  assert.equal(t.depth(), 0);
});

test("a sheet opened in the gap waits for the traversal, then adds its entry", () => {
  // The row menu closes, and the share dialog opens in the same tick: the pop is still on its way.
  const t = setup();
  let shareClosed = 0;
  t.h.open(1, () => true);
  t.h.close(1);
  t.h.open(2, () => {
    shareClosed++;
    return true;
  });
  assert.deepEqual(t.log, ["push 1", "go -1"], "no push before the pop lands");
  t.land();
  assert.deepEqual(t.log, ["push 1", "go -1", "push 1"]);
  assert.equal(shareClosed, 0, "the first pop did not close the second sheet");
  t.back();
  assert.equal(shareClosed, 1);
});

test("a sheet closed before its entry was added adds nothing", () => {
  // Open then close inside one pending traversal (strict-mode double effect, a quick double tap).
  const t = setup();
  t.h.open(1, () => true);
  t.h.close(1);
  t.h.open(2, () => true);
  t.h.close(2);
  t.land();
  assert.deepEqual(t.log, ["push 1", "go -1"]);
  assert.equal(t.depth(), 0);
});

test("nested sheets: each Back closes the top one only", () => {
  const t = setup();
  const closed: number[] = [];
  t.h.open(1, () => (closed.push(1), true));
  t.h.open(2, () => (closed.push(2), true));
  t.back();
  assert.deepEqual(closed, [2]);
  t.back();
  assert.deepEqual(closed, [2, 1]);
});

test("a lower sheet closed under an open one keeps its entry until the top one goes", () => {
  const t = setup();
  t.h.open(1, () => true);
  t.h.open(2, () => true);
  t.h.close(1);
  assert.deepEqual(
    t.log,
    ["push 1", "push 2"],
    "cannot pop from under sheet 2",
  );
  t.h.close(2);
  assert.deepEqual(
    t.log,
    ["push 1", "push 2", "go -2"],
    "both entries leave together",
  );
  t.land();
  assert.equal(t.depth(), 0);
});

test("Back on the top sheet also takes the already-closed one under it", () => {
  const t = setup();
  t.h.open(1, () => true);
  t.h.open(2, () => true);
  t.h.close(1);
  t.back();
  assert.deepEqual(t.log, ["push 1", "push 2", "go -1"]);
  t.land();
  assert.equal(t.depth(), 0);
});

test("a sheet that cannot close (an action runs) gets its entry back", () => {
  const t = setup();
  t.h.open(1, () => false);
  t.back();
  assert.deepEqual(t.log, ["push 1", "push 1"]);
});

test("leaving for another page: entries go first, then the navigation runs", () => {
  const t = setup();
  const order: string[] = [];
  t.h.open(1, () => true);
  t.h.release(() => order.push("navigate"));
  assert.deepEqual(order, [], "not before the traversal lands");
  assert.deepEqual(t.log, ["push 1", "go -1"]);
  t.land();
  assert.deepEqual(order, ["navigate"]);
  t.h.close(1);
  assert.deepEqual(
    t.log,
    ["push 1", "go -1"],
    "the owner closing later adds nothing",
  );
});

test("leaving with no sheet open runs the navigation at once", () => {
  const t = setup();
  let ran = 0;
  t.h.release(() => ran++);
  assert.equal(ran, 1);
  assert.deepEqual(t.log, []);
});

test("leaving while a close is still landing waits for it, then runs", () => {
  const t = setup();
  const order: string[] = [];
  t.h.open(1, () => true);
  t.h.close(1);
  t.h.release(() => order.push("navigate"));
  assert.deepEqual(order, []);
  t.land();
  assert.deepEqual(order, ["navigate"]);
  assert.deepEqual(t.log, ["push 1", "go -1"]);
});

test("a jump of several entries closes every sheet it passed", () => {
  const t = setup();
  const closed: number[] = [];
  t.h.open(1, () => (closed.push(1), true));
  t.h.open(2, () => (closed.push(2), true));
  // long-press Back menu: straight to depth 0 without two popstates
  t.h.popped(0);
  assert.deepEqual(closed, [2, 1]);
});

test("a popstate to a deeper entry than ours (Forward) is ignored", () => {
  const t = setup();
  t.h.open(1, () => true);
  t.h.popped(3);
  assert.deepEqual(t.log, ["push 1"]);
});
