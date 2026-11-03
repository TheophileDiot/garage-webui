import { cn } from "@/lib/utils";
import { LucideIcon, TriangleAlert } from "lucide-react";
import { ReactNode } from "react";
import Button from "./button";

export const SkeletonRows = ({
  rows = 4,
  label = "Loading",
}: {
  rows?: number;
  label?: string;
}) => (
  <div role="status" aria-label={label} className="space-y-4 p-5">
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="flex items-center gap-4">
        <div
          className="skeleton-line h-4 w-1/3"
          style={{ animationDelay: `${i * 90}ms` }}
        />
        <div
          className="skeleton-line h-4 flex-1"
          style={{ animationDelay: `${i * 90}ms` }}
        />
        <div
          className="skeleton-line h-4 w-16"
          style={{ animationDelay: `${i * 90}ms` }}
        />
      </div>
    ))}
    <span className="sr-only">{label}…</span>
  </div>
);

export const EmptyState = ({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "flex flex-col items-center px-6 py-14 text-center",
      className,
    )}
  >
    {Icon ? (
      <Icon size={28} className="mb-4 text-base-content/70" aria-hidden />
    ) : null}
    <h3 className="title">{title}</h3>
    {children ? (
      <p className="muted mt-2 max-w-sm text-sm">{children}</p>
    ) : null}
    {action ? <div className="mt-5">{action}</div> : null}
  </div>
);

export const ErrorState = ({
  title = "Could not load this data",
  error,
  onRetry,
  className,
}: {
  title?: string;
  error?: Error | null;
  onRetry?: () => void;
  className?: string;
}) => (
  <div
    role="alert"
    className={cn(
      "flex flex-col items-center px-6 py-12 text-center",
      className,
    )}
  >
    <TriangleAlert size={28} className="mb-4 text-error" aria-hidden />
    <h3 className="title">{title}</h3>
    {error?.message ? (
      <p className="muted mt-2 max-w-md break-words text-sm">{error.message}</p>
    ) : null}
    {onRetry ? (
      <Button className="mt-5" onClick={onRetry}>
        Try again
      </Button>
    ) : null}
  </div>
);
