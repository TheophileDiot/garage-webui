// consts.ts

export const BASE_PATH =
  (import.meta.env.PROD ? window.__BASE_PATH : null) ||
  import.meta.env.VITE_BASE_PATH ||
  "";

export const url = (...paths: unknown[]) => {
  return BASE_PATH + paths.join("/");
};
