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
 */
export const SummaryStrip = ({
  items,
  label,
  className,
}: {
  items: SummaryItem[];
  /** Accessible name of the group. */
  label?: string;
  className?: string;
}) => (
  <dl
    aria-label={label}
    style={{ "--n": items.length } as CSSProperties}
    className={cn(
      "grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]",
      className,
    )}
  >
    {items.map((item) => (
      <div
        key={item.label}
        className="min-w-0 bg-surface px-4 py-3 [&:nth-child(odd):last-child]:col-span-2 md:[&:nth-child(odd):last-child]:col-span-1"
      >
        <dt className="lbl">{item.label}</dt>
        <dd className="m-0 mt-1.5 font-cond text-stat font-semibold [overflow-wrap:anywhere] [&_small]:ml-[3px] [&_small]:font-cond [&_small]:text-[14px] [&_small]:font-medium [&_small]:text-ink-3">
          {item.value}
        </dd>
        {item.detail ? <div className="mt-1.5">{item.detail}</div> : null}
      </div>
    ))}
  </dl>
);
