import { cn } from "@/lib/utils";
import { ReactNode } from "react";

/**
 * One page header: the title in the condensed face, a meta line, actions on the right. Below `md` the actions sit
 * on the title row and the meta line runs full width under both (the title block dissolves into the header grid).
 */
export const PageHeader = ({
  title,
  meta,
  actions,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) => (
  <header className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-y-1">
    <div className="min-w-0 max-md:contents">
      <h1 className="font-cond text-[26px] font-semibold leading-[1.15] tracking-[-0.005em] [overflow-wrap:anywhere] max-md:col-start-1 max-md:row-start-1 md:text-title">
        {title}
      </h1>
      {meta ? (
        <p className="mt-1 text-ink-3 [text-wrap:pretty] max-md:col-span-2 max-md:row-start-2">
          {meta}
        </p>
      ) : null}
    </div>
    {actions ? (
      <div className="flex flex-wrap items-center gap-3 max-md:col-start-2 max-md:row-start-1 max-md:self-center">
        {actions}
      </div>
    ) : null}
  </header>
);

/**
 * Bordered surface with an optional head: a condensed title on the left, `meta` (or the older `aside`) and
 * `actions` on the right. `flush` drops the inner padding and clips to the corners, for a Ledger that runs edge to
 * edge. Borders only, no shadow at rest.
 */
export const Panel = ({
  title,
  aside,
  meta,
  actions,
  children,
  className,
  flush,
  id,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** No inner padding: for ledgers that run edge to edge. */
  flush?: boolean;
  id?: string;
}) => {
  const hid = id ? `${id}-title` : undefined;
  const side = meta ?? aside;
  return (
    <section
      id={id}
      aria-labelledby={title ? hid : undefined}
      className={cn(
        "min-w-0 rounded-lg border border-line bg-surface",
        // `clip`, not `hidden`: it rounds the corners the same but is no scroll container, so a `sticky` child sticks.
        flush && "overflow-clip",
        className,
      )}
    >
      {title ? (
        <div className="flex min-h-[46px] flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-2.5">
          <h2
            id={hid}
            className="min-w-0 font-cond text-h3 font-semibold tracking-[0.01em] [overflow-wrap:anywhere]"
          >
            {title}
          </h2>
          {side || actions ? (
            <div className="flex min-w-0 flex-wrap items-center gap-3 text-caption text-ink-3">
              {side}
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}
      {flush ? children : <div className="p-4">{children}</div>}
    </section>
  );
};
