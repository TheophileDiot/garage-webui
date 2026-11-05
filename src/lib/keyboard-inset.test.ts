import assert from "node:assert/strict";
import { test } from "node:test";
import { keyboardInset } from "./keyboard-inset.ts";

const vp = (o: Partial<Parameters<typeof keyboardInset>[0]>) =>
  keyboardInset({
    innerHeight: 800,
    height: 800,
    offsetTop: 0,
    scale: 1,
    ...o,
  });

test("no keyboard: the visual viewport is the layout viewport", () => {
  assert.equal(vp({}), 0);
});

test("a keyboard overlays the layout viewport: only the visual one shrinks", () => {
  assert.equal(vp({ height: 500 }), 300);
});

test("the page is panned above the keyboard: the offset counts", () => {
  // iOS pans the visual viewport to keep the field in view; the keyboard top is offset + height from the top.
  assert.equal(vp({ height: 500, offsetTop: 120 }), 180);
});

test("the keyboard resizes the layout viewport too: nothing to correct", () => {
  assert.equal(vp({ innerHeight: 500, height: 500 }), 0);
});

test("a pinch zoom shrinks the visual viewport, and is not a keyboard", () => {
  assert.equal(vp({ height: 400, scale: 2 }), 0);
  assert.equal(vp({ height: 790, scale: 1.02 }), 0);
});

test("a small difference (a collapsing toolbar, a shortcut bar, rounding) is not a keyboard", () => {
  assert.equal(vp({ height: 790 }), 0);
  assert.equal(vp({ height: 730 }), 0);
  assert.equal(vp({ height: 720 }), 80);
});

test("an elastic overscroll (negative offset, beyond the end) never gives a negative inset", () => {
  assert.equal(vp({ height: 500, offsetTop: -40 }), 340);
  assert.equal(vp({ height: 500, offsetTop: 400 }), 0);
});

test("the inset rounds up to a whole CSS pixel, so no sliver of sheet stays under the keyboard", () => {
  assert.equal(vp({ height: 500.4, offsetTop: 0.3 }), 300);
});
