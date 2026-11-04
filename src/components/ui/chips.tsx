import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { PropsWithChildren } from "react";
import IconButton from "./icon-button";

type Props = PropsWithChildren<{
  className?: string;
  onRemove?: () => void;
  removeLabel?: string;
}>;

/** A tag or an alias. Removable when `onRemove` is given; long values wrap instead of widening the page. */
const Chips = ({
  className,
  children,
  onRemove,
  removeLabel = "Remove",
}: Props) => (
  <span
    className={cn(
      "inline-flex min-h-7 max-w-full items-center gap-1 rounded-sm border border-rule-strong bg-sunk pl-2 [overflow-wrap:anywhere]",
      onRemove ? "pr-0.5" : "pr-2",
      className,
    )}
  >
    <span className="min-w-0">{children}</span>
    {onRemove ? (
      <IconButton
        label={removeLabel}
        icon={X}
        size="sm"
        iconSize={13}
        variant="ghost-danger"
        onClick={onRemove}
      />
    ) : null}
  </span>
);

export default Chips;
