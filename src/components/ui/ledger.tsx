import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { hit44 } from "./button-styles";

export type LedgerColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  /** Desktop column width, any CSS length (the table is fixed-layout). */
  width?: string;
  /** Label printed beside the value in the phone stack. Defaults to `header` when that is text; "" prints none. */
  mobileLabel?: string;
  /**
   * Phone stack: `title` leads the card, `actions` trails it, `hide` drops the cell. In a `compact` ledger the
   * parts are `title` (the name line), `meta` (flows on the lines under it) and `trail` (a chevron or a menu on the
   * right); a cell with no part is dropped.
   */
  mobile?: "title" | "actions" | "hide" | "meta" | "trail";
  /**
   * Compact `trail` only: put it on the name line, at the top right, instead of centred over the whole row. For a
   * control that belongs to the row's subject (a key's delete), so it does not sit beside a meta chip and read as
   * an action on that chip. Page-link chevrons stay centred.
   */
  trailTop?: boolean;
  /** Phone only: the column does not exist from 768 px up (its head and cells are hidden). For a compact row's `trail`. */
  phoneOnly?: boolean;
  className?: string;
};

type LedgerProps<T> = {
  columns: LedgerColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** The table's accessible name. */
  caption: string;
  /** Shown instead of the table when there are no rows. */
  empty?: ReactNode;
  /** The row that takes the selected fill (for example a selection). */
  selectedKey?: string | null;
  /** Rows selected together, for example the object browser's checked files. */
  selectedKeys?: readonly string[];
  /** A totals row under the body: cell content by column key. Columns without an entry stay empty. */
  footer?: Record<string, ReactNode>;
  /**
   * Phone only. Instead of the labelled stack, each row is the name, one or two meta lines and one trailing target
   * (see `mobile` on the column). Desktop is the same table either way.
   */
  compact?: boolean;
};

/**
 * The `trail` cell of a compact row that opens a page: a chevron, a 44 px target on phone, labelled for screen
 * readers ("Open media-assets"). Use it in a column with `mobile: "trail"` and `phoneOnly`.
 */
export const LedgerChevron = ({ to, label }: { to: string; label: string }) => (
  <Link
    to={to}
    aria-label={label}
    className={cn(
      hit44,
      "inline-flex size-9 items-center justify-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink",
    )}
  >
    <ChevronRight size={20} aria-hidden />
  </Link>
);

/**
 * Data table: condensed uppercase heads on a quiet band, hover rows, row actions (`.row-actions`) that show on
 * hover, focus or selection and always on touch. Under 768 px every row becomes a stack where each cell carries its
 * own label (or, with `compact`, a short row: name, meta lines, one trailing target). Cells truncate on desktop,
 * so put the full value in a `title` and let long names wrap in the stack. Put it flush in a `Panel flush`.
 */
export const Ledger = <T,>({
  columns,
  rows,
  rowKey,
  caption,
  empty,
  selectedKey,
  selectedKeys,
  footer,
  compact,
}: LedgerProps<T>) => {
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <table className="ledger text-body" data-compact={compact || undefined}>
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {columns.map((c) => (
            <th
              key={c.key}
              scope="col"
              style={c.width ? { width: c.width } : undefined}
              data-mobile={c.mobile}
              className={cn(
                c.align === "right" && "md:text-right",
                c.phoneOnly && "md:hidden",
                c.className,
              )}
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const key = rowKey(row);
          return (
            <tr
              key={key}
              data-selected={
                selectedKey === key || !!selectedKeys?.includes(key)
              }
            >
              {columns.map((c) => {
                const label =
                  c.mobile === "title" ||
                  c.mobile === "actions" ||
                  c.mobile === "meta" ||
                  c.mobile === "trail"
                    ? undefined
                    : (c.mobileLabel ??
                      (typeof c.header === "string" ? c.header : undefined));
                return (
                  <td
                    key={c.key}
                    data-label={label || undefined}
                    data-mobile={c.mobile}
                    data-trail={c.trailTop ? "top" : undefined}
                    className={cn(
                      c.align === "right" && "md:text-right",
                      c.phoneOnly && "md:hidden",
                      c.className,
                    )}
                  >
                    {c.cell(row)}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
      {footer ? (
        <tfoot>
          <tr>
            {columns.map((c) => (
              <td
                key={c.key}
                data-label={
                  footer[c.key] != null && c.mobile !== "title"
                    ? typeof c.header === "string"
                      ? c.header
                      : undefined
                    : undefined
                }
                data-mobile={footer[c.key] == null ? "hide" : c.mobile}
                className={cn(
                  c.align === "right" && "md:text-right",
                  c.phoneOnly && "md:hidden",
                  c.className,
                )}
              >
                {footer[c.key]}
              </td>
            ))}
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
};
