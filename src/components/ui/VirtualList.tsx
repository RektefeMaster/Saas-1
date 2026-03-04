"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { cn } from "@/lib/cn";

export interface VirtualListProps<T> {
  items: T[];
  /** Her öğe için render fonksiyonu */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Tahmini satır yüksekliği (px), varsayılan 56 */
  estimateSize?: number;
  /** Liste container yüksekliği (px), varsayılan 400 */
  height?: number;
  /** Ek sınıflar */
  className?: string;
  /** Öğe wrapper sınıfı */
  itemClassName?: string;
}

/**
 * Uzun listeler için sanal scroll bileşeni.
 * @tanstack/react-virtual ile sadece görünür öğeler render edilir.
 */
export function VirtualList<T>({
  items,
  renderItem,
  estimateSize = 56,
  height = 400,
  className,
  itemClassName,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 5,
  });

  return (
    <div
      ref={parentRef}
      className={cn("overflow-auto", className)}
      style={{ height: `${height}px` }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            className={cn("absolute left-0 top-0 w-full", itemClassName)}
            style={{
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {renderItem(items[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
