import clsx, { ClassValue } from "clsx";
import { toast } from "sonner";
import { twMerge } from "tailwind-merge";
import dayjsRelativeTime from "dayjs/plugin/relativeTime";
import dayjs from "dayjs";
import { copyText } from "./clipboard";

dayjs.extend(dayjsRelativeTime);
export { dayjs };
// Re-exported so existing importers keep their path; the pure parts live in modules node --test can load.
export { dec, readableBytes } from "./format";
export { url } from "./consts";

export const cn = (...args: ClassValue[]) => {
  return twMerge(clsx(...args));
};

export const handleError = (err: unknown) => {
  toast.error((err as Error)?.message || "Unknown error");
};

/** Selects a hidden textarea and runs the legacy copy command. Inside an open dialog so its focus trap keeps the selection. */
const execCommandCopy = (text: string) => {
  const host =
    document.activeElement?.closest<HTMLElement>('[role="dialog"]') ??
    document.body;
  const previous = document.activeElement as HTMLElement | null;
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.left = "-999999px";
  host.prepend(textArea);
  try {
    textArea.select();
    return document.execCommand("copy");
  } finally {
    textArea.remove();
    previous?.focus?.();
  }
};

/** Copies `text`. Resolves true only when the browser took it; toasts the outcome either way. */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  const ok = await copyText(text, {
    writeText:
      navigator.clipboard && window.isSecureContext
        ? (t) => navigator.clipboard.writeText(t)
        : undefined,
    execCopy: execCommandCopy,
  });
  if (ok) toast.success("Copied to clipboard");
  else toast.error("Could not copy to the clipboard");
  return ok;
};
