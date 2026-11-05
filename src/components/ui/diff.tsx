import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type DiffLine = { sign: "+" | "-" | " "; text: ReactNode };

/** A pending change as a diff: `-` leaves, `+` arrives. One treatment wherever something waits to be applied. */
const Diff = ({
  lines,
  label = "Pending change",
  className,
}: {
  lines: DiffLine[];
  label?: string;
  className?: string;
}) => (
  <pre className={cn("diff", className)} aria-label={label}>
    {lines.map((l, i) => (
      <span
        key={i}
        className={cn(
          "block",
          l.sign === "-" ? "del" : l.sign === "+" ? "add" : "ctx",
        )}
      >
        {l.sign === "-" ? (
          <span className="sr-only">removed: </span>
        ) : l.sign === "+" ? (
          <span className="sr-only">added: </span>
        ) : null}
        {`${l.sign} `}
        {l.text}
      </span>
    ))}
  </pre>
);

export default Diff;
