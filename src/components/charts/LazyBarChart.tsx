"use client";

import { useInView } from "react-intersection-observer";
import { BarChartLazy } from "./BarChartLazy";
import type { ComponentProps } from "react";

type BarChartLazyProps = ComponentProps<typeof BarChartLazy>;

export function LazyBarChart(props: BarChartLazyProps) {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <div ref={ref} className="min-h-[256px]">
      {inView ? (
        <BarChartLazy {...props} />
      ) : (
        <div className="h-64 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
      )}
    </div>
  );
}
