import { cn } from "@/lib/utils";
import { ReactNode } from "react";

export type LedgerColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  /** Desktop column width, any CSS length (the table is fixed-layout). */
  width?: string;
  /** Label printed beside the value in the phone stack. Defaults to `header` when that is text; "" prints none. */
  mobileLabel?: string;
  /** Phone stack: `title` leads the card, `actions` trails it, `hide` drops the cell. */
  mobile?: "title" | "actions" | "hide";
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
  /** The row that takes the gold caret (for example a selection). */
  selectedKey?: string | null;
};

/**
 * Dense table: 32 px rows on desktop; under 768 px every row becomes a stack where each cell carries its own label.
 * Cells truncate on desktop, so put the full value in a `title` and let long names wrap in the stack.
 */
export const Ledger = <T,>({
  columns,
  rows,
  rowKey,
  caption,
  empty,
  selectedKey,
}: LedgerProps<T>) => {
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <table className="ledger text-body">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {columns.map((c) => (
            <th
              key={c.key}
              scope="col"
              style={c.width ? { width: c.width } : undefined}
              className={cn(c.align === "right" && "text-right", c.className)}
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
              className="caret-tr"
              data-selected={selectedKey === key}
            >
              {columns.map((c) => {
                const label =
                  c.mobile === "title" || c.mobile === "actions"
                    ? undefined
                    : (c.mobileLabel ??
                      (typeof c.header === "string" ? c.header : undefined));
                return (
                  <td
                    key={c.key}
                    data-label={label || undefined}
                    data-mobile={c.mobile}
                    className={cn(
                      c.align === "right" && "text-right md:text-right",
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
    </table>
  );
};
