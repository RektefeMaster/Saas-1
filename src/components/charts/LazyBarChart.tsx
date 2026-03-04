"use client";

import { useInView } from "react-intersection-observer";
import { BarChartLazy } from "./BarChartLazy";
import type { ComponentProps } from "react";

type BarChartLazyProps = ComponentProps<typeof BarChartLazy>;

/** Profesyonel grafik varsayılanları: ince sütunlar, yumuşak renkler */
const CHART_DEFAULTS: Partial<BarChartLazyProps> = {
  barCategoryGap: "25%",
  colors: ["emerald"],
  showLegend: true,
  className: "h-72 w-full",
};

export function LazyBarChart(props: BarChartLazyProps) {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
  const merged = {
    ...CHART_DEFAULTS,
    ...props,
    colors: props.colors ?? CHART_DEFAULTS.colors,
    className: props.className ?? CHART_DEFAULTS.className,
  };

  return (
    <div ref={ref} className="chart-container min-h-[280px] w-full">
      {inView ? (
        <BarChartLazy {...merged} />
      ) : (
        <div className="h-72 w-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/50" />
      )}
    </div>
  );
}
