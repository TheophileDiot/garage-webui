/** A stored choice. `system` stores nothing on the document and lets the OS preference decide. */
export const themes = ["light", "dark", "system"] as const;
export type Themes = (typeof themes)[number];
