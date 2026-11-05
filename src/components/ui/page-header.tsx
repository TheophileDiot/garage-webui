import { cn } from "@/lib/utils";
import { ReactNode } from "react";

/** One page header: the title in the condensed face, a meta line, actions on the right. */
export const PageHeader = ({
  title,
  meta,
  actions,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) => (
  <header className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
    <div className="min-w-0">
      <h1 className="font-cond text-[26px] font-semibold leading-[1.15] tracking-[-0.005em] [overflow-wrap:anywhere] md:text-title">
        {title}
      </h1>
      {meta ? (
        <p className="mt-1 text-ink-3 [text-wrap:pretty]">{meta}</p>
      ) : null}
    </div>
    {actions ? (
      <div className="flex flex-wrap items-center gap-3">{actions}</div>
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
        flush && "overflow-hidden",
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
