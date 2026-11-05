import { cn } from "@/lib/utils";
import React from "react";
import CopyButton from "./copy-button";

type Props = Omit<React.ComponentPropsWithoutRef<"div">, "children"> & {
  children?: string;
};

/** A command with a copy control. Scrolls sideways inside its own box rather than widening the page. */
const Code = ({ className, children, ...props }: Props) => {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center justify-between gap-2 rounded border border-line bg-surface-2 py-0.5 pl-3 pr-1",
        className,
      )}
      {...props}
    >
      <code className="min-w-0 overflow-x-auto whitespace-nowrap py-1.5 text-[12.5px]">
        {children}
      </code>
      <CopyButton value={children || ""} label="Copy command" />
    </div>
  );
};

export default Code;
