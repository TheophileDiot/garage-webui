import { cn } from "@/lib/utils";
import { CircleAlert, LucideIcon } from "lucide-react";
import { ReactNode } from "react";
import Button from "./button";

/** Loading: rows that hold the table's shape. */
export const SkeletonRows = ({
  rows = 5,
  label = "Loading",
  className,
}: {
  rows?: number;
  label?: string;
  className?: string;
}) => (
  <div role="status" aria-label={label} className={cn("grid", className)}>
    {Array.from({ length: rows }, (_, i) => (
      <div
        key={i}
        aria-hidden
        className="flex h-[45px] items-center gap-4 border-b border-line px-4"
      >
        <span
          className="h-2.5 rounded-[2px] bg-track"
          style={{ width: `${Math.max(12, 34 - i * 3)}%` }}
        />
        <span className="ml-auto h-2.5 w-16 rounded-[2px] bg-surface-2" />
        <span className="hidden h-2.5 w-24 rounded-[2px] bg-surface-2 md:block" />
      </div>
    ))}
    <span className="sr-only">{label}…</span>
  </div>
);

/** Empty: say what is missing and the next move. */
export const EmptyState = ({
  title,
  children,
  action,
  icon: Icon,
  className,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  /** An optional lucide icon above the title. */
  icon?: LucideIcon;
  className?: string;
}) => (
  <div
    className={cn(
      "grid justify-items-center gap-2 px-4 py-10 text-center md:px-6",
      className,
    )}
  >
    {Icon ? (
      <span
        aria-hidden
        className="mb-1 grid h-10 w-10 place-items-center rounded-lg border border-line bg-surface-2 text-ink-2"
      >
        <Icon size={20} />
      </span>
    ) : null}
    <h2 className="font-cond text-[18px] font-semibold">{title}</h2>
    {children ? (
      <p className="max-w-[52ch] text-ink-2 [text-wrap:pretty]">{children}</p>
    ) : null}
    {action ? <div className="mt-2">{action}</div> : null}
  </div>
);

/** Error: the code, what it means, and a retry. The server's message is shown, never swallowed. */
export const ErrorState = ({
  title = "Could not load this data",
  error,
  onRetry,
  code,
  children,
  action,
  className,
}: {
  title?: string;
  error?: Error | null;
  onRetry?: () => void;
  /** Defaults to the HTTP status of the error, else "error". */
  code?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) => {
  const status = (error as { status?: number } | null | undefined)?.status;
  return (
    <div
      role="alert"
      className={cn(
        "grid justify-items-center gap-2 px-4 py-10 text-center md:px-6",
        className,
      )}
    >
      <span
        aria-hidden
        className="mb-1 grid h-10 w-10 place-items-center rounded-lg bg-bad-soft text-bad"
      >
        <CircleAlert size={20} />
      </span>
      <p className="text-caption font-semibold uppercase tracking-[0.07em] text-bad">
        {code ?? (status ? String(status) : "error")}
      </p>
      <h2 className="font-cond text-[18px] font-semibold">{title}</h2>
      {children ? (
        <p className="max-w-[52ch] text-ink-2 [text-wrap:pretty]">{children}</p>
      ) : error?.message ? (
        <p className="max-w-[52ch] text-ink-2 [overflow-wrap:anywhere]">
          {error.message}
        </p>
      ) : null}
      {action ? (
        <div className="mt-2">{action}</div>
      ) : onRetry ? (
        <Button className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
};
