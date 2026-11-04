import { cn } from "@/lib/utils";
import { ReactNode } from "react";

/** A key cap. Hidden on touch, where there is no keyboard to press it with. */
const Kbd = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <kbd
    className={cn(
      "hint-kbd inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-rule-strong px-1 text-caption font-medium text-ink-3",
      className,
    )}
  >
    {children}
  </kbd>
);

export default Kbd;
