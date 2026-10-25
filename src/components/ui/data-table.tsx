import type { ComponentProps, Key, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const tableVariants = cva("data-table", {
  variants: {
    variant: {
      default: "",
      dashboard: "dashboard-table",
      invoice: "invoice-lines",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface DataColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  align?: "right";
  cellClassName?: string | ((row: T) => string);
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  className,
  containerClassName,
  variant,
  ...scrollProps
}: Omit<ComponentProps<"div">, "children"> &
  VariantProps<typeof tableVariants> & {
    rows: readonly T[];
    columns: readonly DataColumn<T>[];
    rowKey: (row: T, index: number) => Key;
    containerClassName?: string;
  }) {
  return (
    <div {...scrollProps} className={cn("table-scroll", containerClassName)}>
      <table className={cn(tableVariants({ variant }), className)}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.id} scope="col" className={column.align}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey(row, index)}>
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={cn(
                    column.align,
                    typeof column.cellClassName === "function"
                      ? column.cellClassName(row)
                      : column.cellClassName,
                  )}
                >
                  {column.cell(row, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TableToolbar({ children }: { children: ReactNode }) {
  return <div className="table-toolbar">{children}</div>;
}
export function TableFooter({
  children,
  actions,
}: {
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="table-footer">
      <span>{children}</span>
      {actions}
    </div>
  );
}
