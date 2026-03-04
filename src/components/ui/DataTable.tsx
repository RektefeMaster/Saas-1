"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

export interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  /** Sıralanabilir sütunlar için başlangıç durumu */
  initialSorting?: SortingState;
  /** Tablo sınıfı */
  className?: string;
  /** Satır tıklanabilir mi */
  onRowClick?: (row: TData) => void;
  /** Boş durum mesajı */
  emptyMessage?: string;
}

export function DataTable<TData>({
  data,
  columns,
  initialSorting = [],
  className,
  onRowClick,
  emptyMessage = "Veri bulunamadı",
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className={cn("overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700", className)}>
      <table className="w-full min-w-[600px] text-left text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={cn(
                    "px-4 py-3 font-semibold text-slate-700 dark:text-slate-300",
                    header.column.getCanSort() && "cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700/50"
                  )}
                  style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                  onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                >
                  <div className="flex items-center gap-1.5">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanSort() &&
                      (header.column.getIsSorted() === "asc" ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : header.column.getIsSorted() === "desc" ? (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      ) : null)}
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-slate-100 transition-colors last:border-0 dark:border-slate-800",
                  onRowClick && "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                )}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/** useDataTable - Tablo instance'ını dışarıda kullanmak için (filtre, sayfalama vb.) */
export function useDataTable<TData>(config: {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  initialSorting?: SortingState;
}) {
  const [sorting, setSorting] = useState<SortingState>(config.initialSorting ?? []);

  return useReactTable({
    data: config.data,
    columns: config.columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
}
