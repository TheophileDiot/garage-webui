import { cn, copyToClipboard } from "@/lib/utils";
import React from "react";
import Button from "./button";
import { Copy } from "lucide-react";

type Props = Omit<React.ComponentPropsWithoutRef<"div">, "children"> & {
  children?: string;
};

const Code = ({ className, children, ...props }: Props) => {
  return (
    <div
      className={cn(
        "relative flex items-center justify-between gap-2 rounded-lg border border-base-300 bg-base-200 py-1 pl-4 pr-1",
        className,
      )}
      {...props}
    >
      <code className="overflow-x-auto whitespace-nowrap py-2">{children}</code>
      <Button
        size="sm"
        icon={Copy}
        color="ghost"
        aria-label="Copy command"
        onClick={() => copyToClipboard(children || "")}
      />
    </div>
  );
};

export default Code;
