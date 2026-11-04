import clsx, { ClassValue } from "clsx";
import { toast } from "sonner";
import { twMerge } from "tailwind-merge";
import dayjsRelativeTime from "dayjs/plugin/relativeTime";
import dayjs from "dayjs";
import { BASE_PATH } from "./consts";
import { copyText } from "./clipboard";

dayjs.extend(dayjsRelativeTime);
export { dayjs };

export const cn = (...args: ClassValue[]) => {
  return twMerge(clsx(...args));
};

export const readableBytes = (bytes?: number | null, divider = 1024) => {
  if (bytes == null || Number.isNaN(bytes)) return "n/a";

  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.max(0, Math.floor(Math.log(bytes) / Math.log(divider)));

  return `${(bytes / Math.pow(divider, i)).toFixed(1)} ${sizes[i]}`;
};

/** Decimal units (1 GB = 1000 MB): what Garage reports node capacity in. */
export const dec = (bytes: number) => readableBytes(bytes, 1000);

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

export const url = (...paths: unknown[]) => {
  return BASE_PATH + paths.join("/");
};
