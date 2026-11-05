import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";
import { Panel } from "./page-header";

/**
 * The right-hand details panel of a browser or list: a Panel with a quiet empty state. Pass the selection as
 * `children`; with none, `emptyText` shows. Stacks under the list below 1180 px, so give it a full-width layout.
 */
export const Inspector = ({
  title = "Details",
  emptyText = "Select an item to see its details.",
  children,
  className,
}: {
  title?: ReactNode;
  emptyText?: ReactNode;
  children?: ReactNode;
  className?: string;
}) => (
  <Panel title={title} className={className}>
    {children ? (
      <div className="flex flex-col gap-3.5">{children}</div>
    ) : (
      <p className="px-2 py-5 text-center text-ink-3">{emptyText}</p>
    )}
  </Panel>
);

/** The selected thing's icon tile and name; a long name wraps. */
export const InspectorName = ({
  icon: Icon,
  children,
}: {
  icon?: LucideIcon;
  children: ReactNode;
}) => (
  <div className="flex items-center gap-2.5">
    {Icon ? (
      <span
        aria-hidden
        className="grid h-9 w-9 flex-none place-items-center rounded-lg border border-line bg-surface-2 text-ink-2"
      >
        <Icon size={18} />
      </span>
    ) : null}
    <p className="min-w-0 font-cond text-[18px] font-semibold leading-tight [overflow-wrap:anywhere]">
      {children}
    </p>
  </div>
);

type Prop = {
  label: string;
  value: ReactNode;
  /** The value takes its own full-width line under the label, for long monospace values. */
  wide?: boolean;
};

/** Label and value pairs: 80 px labels, values wrap anywhere. */
export const PropList = ({
  items,
  className,
}: {
  items: Prop[];
  className?: string;
}) => (
  <dl
    className={cn(
      "m-0 grid grid-cols-[80px_minmax(0,1fr)] gap-x-3 gap-y-2",
      className,
    )}
  >
    {items.map((p) => (
      <div key={p.label} className="contents">
        <dt className={cn("text-ink-3", p.wide && "col-span-full")}>
          {p.label}
        </dt>
        <dd
          className={cn(
            "m-0 min-w-0 [overflow-wrap:anywhere]",
            p.wide && "col-span-full -mt-1",
          )}
        >
          {p.value}
        </dd>
      </div>
    ))}
  </dl>
);
