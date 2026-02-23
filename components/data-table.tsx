"use client";

import { type ReactNode, useMemo, useState } from "react";

type SortDirection = "asc" | "desc";

export interface DataTableColumn<T extends object> {
  key: keyof T | string;
  label: string;
  widthClassName?: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  render?: (row: T) => ReactNode;
}

export interface DataTableRowAction<T extends object> {
  label: string;
  onClick: (row: T) => void | Promise<void>;
  variant?: "default" | "danger";
}

interface DataTableProps<T extends object> {
  title: string;
  subtitle?: string;
  toolbar?: ReactNode;
  rows: T[];
  columns: Array<DataTableColumn<T>>;
  onRowClick?: (row: T) => void;
  rowActions?: Array<DataTableRowAction<T>>;
  emptyTitle: string;
  emptyDescription: string;
}

export function DataTable<T extends object>({
  title,
  subtitle,
  toolbar,
  rows,
  columns,
  onRowClick,
  rowActions = [],
  emptyTitle,
  emptyDescription,
}: DataTableProps<T>) {
  const firstSortableColumn = columns.find((column) => column.sortable);
  const [sortKey, setSortKey] = useState<string>(
    String(firstSortableColumn?.key ?? columns[0]?.key ?? "id")
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedRows = useMemo(() => {
    const column = columns.find((c) => String(c.key) === sortKey);
    if (!column || !column.sortable) return rows;

    return [...rows].sort((a, b) => {
      const aValue = column.sortValue
        ? column.sortValue(a)
        : ((a as Record<string, unknown>)[String(column.key)] as
            | string
            | number
            | undefined);
      const bValue = column.sortValue
        ? column.sortValue(b)
        : ((b as Record<string, unknown>)[String(column.key)] as
            | string
            | number
            | undefined);

      const left = aValue ?? "";
      const right = bValue ?? "";

      if (typeof left === "number" && typeof right === "number") {
        return sortDirection === "asc" ? left - right : right - left;
      }

      const compare = String(left).localeCompare(String(right), undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return sortDirection === "asc" ? compare : -compare;
    });
  }, [columns, rows, sortDirection, sortKey]);

  function handleSort(column: DataTableColumn<T>) {
    if (!column.sortable) return;
    const nextKey = String(column.key);
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection("asc");
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 font-mono text-xs text-muted">{subtitle}</p>
          ) : null}
        </div>
        {toolbar ? <div className="flex items-center gap-2">{toolbar}</div> : null}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-panel">
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-border/80">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={`px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted ${
                    column.widthClassName ?? ""
                  }`}
                >
                  <button
                    type="button"
                    className={`inline-flex items-center gap-1 ${
                      column.sortable ? "hover:text-foreground" : "cursor-default"
                    }`}
                    onClick={() => handleSort(column)}
                  >
                    {column.label}
                    {column.sortable && sortKey === String(column.key) ? (
                      <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                    ) : null}
                  </button>
                </th>
              ))}
              {rowActions.length > 0 ? (
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted">
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (rowActions.length > 0 ? 1 : 0)}
                  className="px-4 py-8 text-center"
                >
                  <p className="font-mono text-sm tracking-wider text-muted">
                    {emptyTitle}
                  </p>
                  <p className="mt-2 text-sm text-muted">{emptyDescription}</p>
                </td>
              </tr>
            ) : (
              sortedRows.map((row, index) => (
                <tr
                  key={String(((row as { id?: string }).id ?? index))}
                  className="border-b border-border/40 last:border-b-0 hover:bg-muted/10"
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className="px-4 py-3 text-sm text-foreground"
                    >
                      {column.render
                        ? column.render(row)
                        : String(
                            (row as Record<string, unknown>)[String(column.key)] ?? "--"
                          )}
                    </td>
                  ))}
                  {rowActions.length > 0 ? (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {rowActions.map((action) => (
                          <button
                            key={action.label}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void action.onClick(row);
                            }}
                            className={`font-mono text-[11px] uppercase tracking-wider ${
                              action.variant === "danger"
                                ? "text-destructive hover:text-destructive/80"
                                : "text-muted hover:text-foreground"
                            }`}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
