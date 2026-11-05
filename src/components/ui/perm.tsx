import { cn } from "@/lib/utils";

/** Read / Write / Owner as three cells. Active cells are filled, inactive are outlined; the letters always show. */
const Perm = ({
  read,
  write,
  owner,
  className,
}: {
  read: boolean;
  write: boolean;
  owner: boolean;
  className?: string;
}) => {
  const cells: Array<[string, boolean, string]> = [
    ["R", read, "read"],
    ["W", write, "write"],
    ["O", owner, "owner"],
  ];
  return (
    <span
      className={cn("inline-flex gap-px", className)}
      role="img"
      aria-label={
        cells
          .filter((c) => c[1])
          .map((c) => c[2])
          .join(", ") || "no access"
      }
    >
      {cells.map(([l, on]) => (
        <span
          key={l}
          aria-hidden
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center border font-cond text-caption font-semibold first:rounded-l-sm last:rounded-r-sm",
            on
              ? "border-primary bg-primary text-primary-ink"
              : "border-line-strong text-ink-3",
          )}
        >
          {l}
        </span>
      ))}
    </span>
  );
};

export default Perm;
