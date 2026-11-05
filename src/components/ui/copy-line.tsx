import { cn } from "@/lib/utils";
import CopyButton from "./copy-button";

/**
 * A value in monospace with an icon copy control beside it, for IDs, access keys, `s3://` URIs and paths. The value
 * wraps anywhere instead of widening the page. `boxed` puts it in a quiet box, as the inspector does.
 */
export const CopyLine = ({
  value,
  label,
  boxed = false,
  className,
}: {
  value: string;
  /** Accessible name of the copy control, for example "Copy bucket ID". */
  label: string;
  boxed?: boolean;
  className?: string;
}) => (
  <span className={cn("flex min-w-0 items-center gap-0.5", className)}>
    <span
      className={cn(
        "min-w-0 flex-1 font-mono text-[12.5px] leading-[1.45] [overflow-wrap:anywhere]",
        boxed && "rounded border border-line bg-surface-2 px-2 py-[5px]",
      )}
    >
      {value}
    </span>
    <CopyButton value={value} label={label} iconOnly />
  </span>
);
