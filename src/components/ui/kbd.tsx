import { cn } from "@/lib/utils";
import { ReactNode } from "react";

/** A key cap. Used in the palette footer only, and hidden on touch where there is no keyboard to press it with. */
const Kbd = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <kbd
    className={cn(
      "hint-kbd inline-flex items-center justify-center rounded-sm border border-line bg-surface-2 px-[5px] py-[3px] font-cond text-[11.5px] font-medium leading-none tracking-[0.03em] text-ink-2",
      className,
    )}
  >
    {children}
  </kbd>
);

export default Kbd;
