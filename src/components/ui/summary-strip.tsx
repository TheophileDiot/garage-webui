import { cn } from "@/lib/utils";
import { CSSProperties, ReactNode } from "react";

type SummaryItem = {
  label: string;
  /** The figure, in the condensed face. A `<small>` inside it is a unit and takes the muted style. */
  value: ReactNode;
  /** Under the figure: a Meter, a note, a link. */
  detail?: ReactNode;
};

/**
 * Label and figure cells in one bordered strip, as the bucket summary of the prototype. Two columns on phone,
 * one row from 768 px. Cells are separated by hairlines drawn from the strip's own background.
 *
 * `phone="line"` swaps the two-column grid for one wrapping line below 768 px: "Objects 26 · Size 5.7 MB · Quota
 * No limit", each label small and each figure body-sized, no cell border. An item's `detail` (a meter, a link) is
 * not drawn in the line, so put nothing there that only the line would need. From 768 px it is the same strip.
 */
export const SummaryStrip = ({
  items,
  label,
  className,
  phone = "grid",
}: {
  items: SummaryItem[];
  /** Accessible name of the group. */
  label?: string;
  className?: string;
  /** Below 768 px: the two-column grid (default) or one wrapping line. */
  phone?: "grid" | "line";
}) => {
  const line = phone === "line";
  return (
    <dl
      aria-label={label}
      style={{ "--n": items.length } as CSSProperties}
      className={cn(
        "overflow-hidden rounded-lg border border-line bg-line md:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]",
        line
          ? "flex flex-wrap max-md:border-0 max-md:bg-transparent md:grid md:gap-px"
          : "grid grid-cols-2 gap-px",
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "min-w-0 bg-surface px-4 py-3",
            line
              ? "max-md:flex max-md:items-baseline max-md:gap-1.5 max-md:bg-transparent max-md:p-0 max-md:[&:not(:last-child)]:after:mr-1.5 max-md:[&:not(:last-child)]:after:text-ink-3 max-md:[&:not(:last-child)]:after:content-['·'] md:[&:nth-child(odd):last-child]:col-span-1"
              : "[&:nth-child(odd):last-child]:col-span-2 md:[&:nth-child(odd):last-child]:col-span-1",
          )}
        >
          <dt
            className={cn(
              "lbl",
              line && "max-md:normal-case max-md:tracking-normal",
            )}
          >
            {item.label}
          </dt>
          <dd
            className={cn(
              "m-0 mt-1.5 font-cond text-stat font-semibold [overflow-wrap:anywhere] [&_small]:ml-[3px] [&_small]:font-cond [&_small]:text-[14px] [&_small]:font-medium [&_small]:text-ink-3",
              line &&
                "max-md:mt-0 max-md:font-sans max-md:text-body max-md:font-semibold",
            )}
          >
            {item.value}
          </dd>
          {item.detail ? (
            <div className={cn("mt-1.5", line && "max-md:hidden")}>
              {item.detail}
            </div>
          ) : null}
        </div>
      ))}
    </dl>
  );
};
