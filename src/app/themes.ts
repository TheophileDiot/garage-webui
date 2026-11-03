export const themes = ["light", "dark"] as const;
export type Themes = (typeof themes)[number];
