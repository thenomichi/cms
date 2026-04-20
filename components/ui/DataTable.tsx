"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  emptyIcon?: string;
  className?: string;
}

function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  emptyMessage = "No data found",
  emptyIcon = "📭",
  className,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="text-3xl">{emptyIcon}</span>
        <p className="mt-2 text-sm text-mid">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-line",
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="sticky top-0 border-b border-line bg-surface2">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-ink3"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-surface">
            {data.map((item, idx) => (
              <tr
                key={idx}
                className={cn(
                  "border-b border-line last:border-b-0 transition-colors",
                  onRowClick && "cursor-pointer hover:bg-surface2"
                )}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-ink">
                    {col.render
                      ? col.render(item)
                      : (item[col.key] as ReactNode)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { DataTable };
export type { DataTableProps, Column };
