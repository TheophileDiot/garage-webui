/**
 * How far a soft keyboard covers the bottom of the layout viewport, in CSS px, from the `VisualViewport` and
 * `innerHeight`. Gecko and iOS Safari overlay the keyboard (only the visual viewport shrinks, so a `fixed bottom-0`
 * box ends under it); Chrome does the same by default. Where the keyboard resizes the layout viewport too, both
 * numbers shrink together and the inset is 0: nothing to correct.
 */
// Under 80 px is a collapsing toolbar, a shortcut bar or rounding, not a keyboard (the smallest ones are about 200 px).
const MIN_KEYBOARD = 80;

export const keyboardInset = (v: {
  innerHeight: number;
  /** `visualViewport.height` */
  height: number;
  /** `visualViewport.offsetTop`: the visual viewport is panned this far down the layout viewport. */
  offsetTop: number;
  /** `visualViewport.scale`: above 1 the user has pinched in, which also shrinks the visual viewport. */
  scale: number;
}): number => {
  // A pinch zoom is not a keyboard, and nothing here may fight it.
  if (v.scale > 1.01) return 0;
  const covered = Math.ceil(v.innerHeight - v.height - v.offsetTop);
  return covered >= MIN_KEYBOARD ? covered : 0;
};
