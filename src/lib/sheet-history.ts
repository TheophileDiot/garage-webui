/**
 * Android Back (and a swipe back on iOS) closes the open sheet instead of leaving the page. A sheet that opens adds
 * one history entry carrying its depth; Back takes that entry away and the owner closes. Pure decision logic, no
 * DOM: the caller passes how to push an entry and how to traverse, and reports every popstate with the depth the
 * page is now at (`history.state.sheetDepth`, 0 when it carries none).
 *
 * What it has to get right, because a traversal arrives later than it is asked for:
 * - Closing by X, Cancel, Escape or submit takes the sheet's own entry back (`go(-1)`), so no stray entry stays and
 *   a later Back does not go a page too far. That popstate is ours, not a Back press.
 * - A sheet that opens while such a traversal is on its way (the row menu closing as the share dialog opens) waits,
 *   or its entry would be the one the traversal removes and the sheet would be closed at once.
 * - Leaving for another page (`release`) first takes the entries away, then runs the navigation, so the new page
 *   does not stack on a dead entry and Back from it lands on the page the user left.
 * - A sheet closed while another one sits above it keeps its entry until the top one goes (an entry cannot be
 *   removed from under another), then they leave together.
 */
export type SheetHistoryEnv = {
  /** Add an entry with the same URL; `depth` is the number of sheet entries now stacked, to be kept in its state. */
  push: (depth: number) => void;
  /** Traverse `delta` entries (negative: back). One `popped` follows when it lands. */
  go: (delta: number) => void;
};

type Slot = {
  id: number;
  /** Back was pressed on this sheet: close it and return true, or return false when it cannot close now. */
  onBack: () => boolean;
  /** False once its owner closed it while it still had an entry under another sheet. */
  live: boolean;
};

export const createSheetHistory = (env: SheetHistoryEnv) => {
  let slots: Slot[] = [];
  // Traversals we asked for and that have not landed. While there is one, nothing may add an entry.
  let busy = 0;
  let queue: Array<{ id?: number; run: () => void }> = [];

  const flush = () => {
    while (busy === 0 && queue.length > 0) queue.shift()!.run();
  };
  const run = (fn: () => void, id?: number) => {
    if (busy > 0) queue.push({ id, run: fn });
    else fn();
  };
  const goBack = (n: number) => {
    busy++;
    env.go(-n);
  };
  /** How many closed sheets sit at the top of the stack. */
  const deadOnTop = () => {
    let n = 0;
    while (n < slots.length && !slots[slots.length - 1 - n].live) n++;
    return n;
  };

  return {
    /** A sheet opened. `onBack` closes it when the user presses Back. */
    open(id: number, onBack: () => boolean) {
      run(() => {
        slots.push({ id, onBack, live: true });
        env.push(slots.length);
      }, id);
    },

    /** A sheet closed by anything but Back. */
    close(id: number) {
      const at = slots.findIndex((s) => s.id === id);
      if (at < 0) {
        queue = queue.filter((q) => q.id !== id);
        return;
      }
      slots[at].live = false;
      const n = deadOnTop();
      if (n === 0) return;
      slots.splice(slots.length - n, n);
      goBack(n);
    },

    /** Run `then` (a navigation) once no sheet entry is left. Sheets stay as they are; they close on their own. */
    release(then: () => void) {
      run(() => {
        if (slots.length === 0) return then();
        const n = slots.length;
        slots = [];
        queue.unshift({ run: then });
        goBack(n);
      });
    },

    /** A popstate, with the depth the page is now at. */
    popped(depth: number) {
      if (busy > 0) {
        busy--;
        flush();
        return;
      }
      while (slots.length > depth) {
        const s = slots.pop()!;
        if (s.live && !s.onBack()) {
          // It cannot close (its action is running): put the entry back, the sheet stays.
          slots.push(s);
          env.push(slots.length);
          return;
        }
      }
      const n = deadOnTop();
      if (n > 0) {
        slots.splice(slots.length - n, n);
        goBack(n);
      }
    },
  };
};
