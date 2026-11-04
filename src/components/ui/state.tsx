import { cn } from "@/lib/utils";
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
  <div
    role="status"
    aria-label={label}
    className={cn("grid gap-px", className)}
  >
    {Array.from({ length: rows }, (_, i) => (
      <div
        key={i}
        aria-hidden
        className="flex h-8 items-center gap-4 border-b border-rule px-3"
      >
        <span
          className="h-2 bg-rule-strong"
          style={{ width: `${Math.max(12, 34 - i * 3)}%` }}
        />
        <span className="ml-auto h-2 w-16 bg-rule" />
        <span className="hidden h-2 w-24 bg-rule md:block" />
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
  className,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "grid justify-items-start gap-2 px-4 py-10 md:px-6",
      className,
    )}
  >
    <p className="text-ink-3" aria-hidden>
      {"s3://"}
      <span className="caret-blink ml-0.5" />
    </p>
    <h2 className="font-display text-h2 font-semibold tracking-[-0.02em]">
      {title}
    </h2>
    {children ? <p className="max-w-[52ch] text-ink-2">{children}</p> : null}
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
        "grid justify-items-start gap-2 px-4 py-10 md:px-6",
        className,
      )}
    >
      <p className="font-medium text-bad">
        {code ?? (status ? String(status) : "error")}
      </p>
      <h2 className="font-display text-h2 font-semibold tracking-[-0.02em]">
        {title}
      </h2>
      {children ? (
        <p className="max-w-[52ch] text-ink-2">{children}</p>
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
