/** Copy with a fallback. No imports: node --test runs this file as it is. */

type CopyDeps = {
  writeText?: (text: string) => Promise<void>;
  execCopy: (text: string) => boolean;
};

/** Resolves true only when a copy path reported success; a false from `execCopy` is a failure. */
export const copyText = async (text: string, deps: CopyDeps) => {
  if (deps.writeText) {
    try {
      await deps.writeText(text);
      return true;
    } catch {
      // Denied or unavailable: try the textarea path.
    }
  }
  try {
    return deps.execCopy(text) === true;
  } catch {
    return false;
  }
};
