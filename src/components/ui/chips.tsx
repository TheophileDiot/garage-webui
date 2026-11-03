import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { PropsWithChildren } from "react";

type Props = PropsWithChildren<{
  className?: string;
  onRemove?: () => void;
  removeLabel?: string;
}>;

const Chips = ({
  className,
  children,
  onRemove,
  removeLabel = "Remove",
}: Props) => (
  <span
    className={cn(
      "inline-flex h-9 items-center gap-1 rounded-full border border-base-300 bg-base-200 pl-3 text-sm font-semibold",
      onRemove ? "pr-1" : "pr-3",
      className,
    )}
  >
    {children}
    {onRemove ? (
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="grid h-7 w-7 place-items-center rounded-full text-base-content/70 transition-colors hover:bg-error/15 hover:text-error"
      >
        <X size={16} aria-hidden />
      </button>
    ) : null}
  </span>
);

export default Chips;
