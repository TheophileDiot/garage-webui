/**
 * Reconciles an autosaving form with the server snapshot it refetches. Pure and import-free: node --test
 * runs this file as it is.
 */

type AutosaveState = {
  /** Key of the payload last sent, or of the snapshot the form last reset to. */
  sent: string | null;
  /** Saves sent and not yet settled. */
  inFlight: number;
  /** The user changed the form after the last send, so the form holds something not yet saved. */
  edited: boolean;
};

export const newAutosave = (): AutosaveState => ({
  sent: null,
  inFlight: 0,
  edited: false,
});

export const markEdited = (s: AutosaveState) => {
  s.edited = true;
};

export const markSent = (s: AutosaveState, key: string) => {
  s.sent = key;
  s.edited = false;
  s.inFlight += 1;
};

export const markSettled = (s: AutosaveState) => {
  s.inFlight = Math.max(0, s.inFlight - 1);
};

/**
 * True when the form must reset to the server snapshot `serverKey`. A snapshot that only echoes the last
 * payload, or that arrives while a save is in flight or the user has typed since, is stale or redundant:
 * it never overwrites newer edits. Once idle, any other snapshot is the server's truth and wins.
 */
export const shouldReset = (s: AutosaveState, serverKey: string): boolean => {
  if (s.inFlight > 0 || s.edited || s.sent === serverKey) return false;
  s.sent = serverKey;
  return true;
};
