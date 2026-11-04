import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { Link } from "react-router-dom";

/** Address text: dim scheme, ink segments, gold delimiters. Segments link when `to` is given. */
export const AddressText = ({
  scheme,
  segments,
  trailing = false,
  className,
}: {
  scheme: "s3" | "garage";
  segments: Array<{ label: string; to?: string }>;
  trailing?: boolean;
  className?: string;
}) => (
  <span
    className={cn("inline-flex min-w-0 flex-wrap items-baseline", className)}
  >
    <span className="text-ink-3">{scheme}://</span>
    {segments.map((s, i) => (
      <span
        key={`${s.label}-${i}`}
        className="inline-flex min-w-0 items-baseline"
      >
        {i > 0 && <span className="px-px text-gold-text">/</span>}
        {s.to ? (
          <Link
            to={s.to}
            className="xlink min-w-0 text-ink [overflow-wrap:anywhere]"
          >
            {s.label}
          </Link>
        ) : (
          <span className="min-w-0 px-0.5 text-ink [overflow-wrap:anywhere]">
            {s.label}
          </span>
        )}
      </span>
    ))}
    {trailing && <span className="text-gold-text">/</span>}
  </span>
);

/** Splits `s3://bucket/some/prefix/` for display. A full address wraps, it never widens the page. */
const AddressLine = ({ address }: { address: string }) => {
  const m = /^(s3|garage):\/\/(.*)$/.exec(address);
  if (!m) return <span className="text-ink-2">{address}</span>;
  const parts = m[2].split("/");
  const trailing = parts.length > 1 && parts[parts.length - 1] === "";
  const segments = (trailing ? parts.slice(0, -1) : parts).filter(
    (p, i) => p !== "" || i === 0,
  );
  return (
    <AddressText
      scheme={m[1] as "s3" | "garage"}
      segments={segments.map((label) => ({ label }))}
      trailing={trailing}
    />
  );
};

/** One page header: title in the display face, a meta line, actions on the right. */
export const PageHeader = ({
  title,
  meta,
  actions,
  address,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  /** The page's own address, for example `s3://media-assets/`. Shown above the title. */
  address?: string;
}) => (
  <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-4 pt-5 md:pt-6">
    <div className="min-w-0">
      {address ? (
        <p className="mb-1.5 min-w-0 text-ink-3">
          <AddressLine address={address} />
        </p>
      ) : null}
      <h1 className="font-display text-[clamp(1.625rem,1.2rem+1.6vw,2.25rem)] font-semibold leading-[1.05] tracking-[-0.03em] [overflow-wrap:anywhere] [text-wrap:balance]">
        {title}
      </h1>
      {meta ? (
        <p className="mt-1.5 text-ink-3 [text-wrap:pretty]">{meta}</p>
      ) : null}
    </div>
    {actions ? (
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    ) : null}
  </header>
);

/** Bordered region with a quiet title. Borders only: no fill jump, no shadow. */
export const Panel = ({
  title,
  aside,
  children,
  className,
  flush,
  id,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  /** No inner padding: for ledgers that run edge to edge. */
  flush?: boolean;
  id?: string;
}) => {
  const hid = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={title ? hid : undefined}
      className={cn("min-w-0 rounded border border-rule bg-lift", className)}
    >
      {title ? (
        <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 border-b border-rule px-3 py-1.5">
          <h2 id={hid} className="font-medium text-ink-2">
            {title}
          </h2>
          {aside ? (
            <div className="min-w-0 text-ink-3 [text-wrap:pretty]">{aside}</div>
          ) : null}
        </div>
      ) : null}
      <div className={cn(!flush && "p-3")}>{children}</div>
    </section>
  );
};
