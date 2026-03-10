"use client";

import React from "react";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useInView } from "react-intersection-observer";

const COLORS = {
  emerald: ["#059669", "#10b981", "#34d399", "#6ee7b7"],
  amber: ["#d97706", "#f59e0b", "#fbbf24", "#fcd34d"],
  violet: ["#7c3aed", "#8b5cf6", "#a78bfa", "#c4b5fd"],
  blue: ["#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"],
  slate: ["#475569", "#64748b", "#94a3b8", "#cbd5e1"],
};

type ColorKey = keyof typeof COLORS;

export type ChartBarDataPoint = Record<string, string | number>;

export type ChartBarProps = {
  data: ChartBarDataPoint[];
  /** X ekseni için key (örn: "name", "tarih", "gün") */
  xKey: string;
  /** Bar değerleri: tek key veya array (örn: ["value"] veya ["maliyet","token","çağrı"]) */
  bars: string | string[];
  /** Renk paleti */
  colors?: ColorKey | ColorKey[];
  /** Değer formatı (tooltip ve eksen) */
  valueFormatter?: (v: number) => string;
  /** Bar etiketleri (tooltip/legend) */
  barLabels?: Record<string, string>;
  /** Legend göster */
  showLegend?: boolean;
  /** Bar üzerinde değer etiketi göster */
  showBarLabels?: boolean;
  /** Yükseklik (px) */
  height?: number;
  /** Bar genişliği (px) */
  barSize?: number;
  /** Bar gap (0-1) */
  barGap?: number;
  /** Farklı ölçekli serileri 0-100 normalize et (görsel karşılaştırma) */
  normalize?: boolean;
  /** Yatay bar (uzun etiketler için) */
  layout?: "vertical" | "horizontal";
  className?: string;
};

function getBarColor(bars: string[], colors: ColorKey | ColorKey[], barIndex: number): string {
  if (Array.isArray(colors)) {
    const colorKey = colors[barIndex % colors.length];
    return COLORS[colorKey]?.[0] ?? COLORS.emerald[0];
  }
  const palette = COLORS[colors] ?? COLORS.emerald;
  return palette[barIndex % palette.length] ?? palette[0];
}

function CustomTooltip({
  active,
  payload,
  label,
  valueFormatter,
  barKeys,
  normalize,
}: {
  active?: boolean;
  payload?: readonly { name: string; value: number; color: string; payload?: Record<string, unknown> }[];
  label?: string;
  valueFormatter?: (v: number) => string;
  barKeys?: string[];
  normalize?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const fmt = valueFormatter ?? ((v: number) => String(v));
  const items = [...payload];
  const displayPayload =
    normalize && barKeys
      ? items.map((p, i) => ({
          ...p,
          value: Number(p.payload?.[barKeys[i]]) ?? p.value,
        }))
      : items;
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/95 px-4 py-3 shadow-2xl shadow-slate-900/10 backdrop-blur-sm dark:border-slate-600 dark:bg-slate-800/95 dark:shadow-slate-950/50">
      <p className="mb-2.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</p>
      <div className="space-y-2">
        {displayPayload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-8">
            <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white dark:ring-slate-800"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}
            </span>
            <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {fmt(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderBarLabel(
  props: { x?: number | string; y?: number | string; width?: number; height?: number; value?: number },
  valueFormatter?: (v: number) => string,
  isHorizontal?: boolean
) {
  const x = Number(props.x) || 0;
  const y = Number(props.y) || 0;
  const width = props.width ?? 0;
  const height = props.height ?? 0;
  const { value } = props;
  if (value == null || value === 0) return null;
  const fmt = valueFormatter ?? ((v: number) => String(v));
  const text = fmt(value);
  if (isHorizontal) {
    const labelX = x + width + 8;
    const labelY = y + height / 2;
    return (
      <text
        x={labelX}
        y={labelY}
        dy={4}
        fill="currentColor"
        className="text-xs font-medium text-slate-600 dark:text-slate-400"
        textAnchor="start"
      >
        {text}
      </text>
    );
  }
  const labelX = x + width / 2;
  const labelY = Math.max(y - 6, 12);
  return (
    <text
      x={labelX}
      y={labelY}
      fill="currentColor"
      className="text-xs font-semibold text-slate-700 dark:text-slate-300"
      textAnchor="middle"
    >
      {text}
    </text>
  );
}

export function ChartBar({
  data,
  xKey,
  bars,
  colors = "emerald",
  valueFormatter,
  barLabels,
  showLegend = false,
  showBarLabels = false,
  height = 280,
  barSize = 36,
  barGap = 0.25,
  normalize = false,
  layout = "vertical",
  className = "",
}: ChartBarProps) {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.05 });
  const barKeys = Array.isArray(bars) ? bars : [bars];
  const isHorizontal = layout === "horizontal";

  const chartData = React.useMemo(() => {
    if (!normalize || barKeys.length <= 1) return data;
    return data.map((row) => {
      const out = { ...row };
      barKeys.forEach((k) => {
        const vals = data.map((d) => Number(d[k]) || 0);
        const max = Math.max(...vals, 1);
        (out as Record<string, number>)[`_${k}`] = max > 0 ? ((Number(row[k]) || 0) / max) * 100 : 0;
      });
      return out;
    });
  }, [data, barKeys, normalize]);

  const displayData = normalize && barKeys.length > 1 ? chartData : data;
  const displayKeys = normalize && barKeys.length > 1 ? barKeys.map((k) => `_${k}`) : barKeys;

  const maxVal = Math.max(
    ...displayData.flatMap((d) => displayKeys.map((k) => Number(d[k]) || 0)),
    1
  );
  const yDomain = [0, Math.ceil(maxVal * 1.15) || 1];

  if (!inView) {
    return (
      <div
        ref={ref}
        className={`animate-pulse rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800/60 dark:to-slate-900/40 ${className}`}
        style={{ height }}
      />
    );
  }

  const margin = isHorizontal
    ? { top: 8, right: 60, left: 8, bottom: 8 }
    : { top: 20, right: 16, left: 8, bottom: 12 };

  return (
    <div ref={ref} className={`w-full ${className}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={displayData}
          layout={layout}
          margin={margin}
          barCategoryGap={`${Math.round(barGap * 100)}%`}
        >
          <defs>
            {displayKeys.map((key, i) => {
              const color = getBarColor(barKeys, colors, i);
              const gradId = `chart-bar-grad-${key}-${i}`;
              return (
                <linearGradient key={key} id={gradId} x1="0" y1="0" x2={isHorizontal ? "1" : "0"} y2={isHorizontal ? "0" : "1"}>
                  <stop offset="0%" stopColor={color} stopOpacity={1} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.75} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            strokeOpacity={0.08}
            vertical={!isHorizontal}
            horizontal={isHorizontal}
          />
          <XAxis
            type={isHorizontal ? "number" : "category"}
            dataKey={isHorizontal ? undefined : xKey}
            domain={isHorizontal ? yDomain : undefined}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "currentColor", opacity: 0.65 }}
            tickFormatter={
              isHorizontal
                ? valueFormatter
                  ? (v) => valueFormatter(v)
                  : undefined
                : undefined
            }
            tickMargin={8}
          />
          <YAxis
            type={isHorizontal ? "category" : "number"}
            dataKey={isHorizontal ? xKey : undefined}
            domain={!isHorizontal ? yDomain : undefined}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "currentColor", opacity: 0.7 }}
            tickFormatter={
              !isHorizontal && normalize
                ? (v) => (v % 25 === 0 ? String(v) : "")
                : !isHorizontal && valueFormatter
                  ? (v) => valueFormatter(v)
                  : undefined
            }
            width={isHorizontal ? 120 : 44}
            tickMargin={8}
          />
          <Tooltip
            cursor={{ fill: "currentColor", opacity: 0.04, radius: 8 }}
            content={(props) => (
              <CustomTooltip
                active={props.active}
                payload={props.payload as Array<{ name: string; value: number; color: string; payload?: Record<string, unknown> }>}
                label={props.label != null ? String(props.label) : undefined}
                valueFormatter={valueFormatter}
                barKeys={normalize ? barKeys : undefined}
                normalize={normalize}
              />
            )}
          />
          {displayKeys.map((key, i) => {
            const gradId = `chart-bar-grad-${key}-${i}`;
            return (
              <Bar
                key={key}
                dataKey={key}
                name={barLabels?.[barKeys[i]] ?? barKeys[i]}
                fill={`url(#${gradId})`}
                radius={isHorizontal ? [0, 8, 8, 0] : [8, 8, 0, 0]}
                maxBarSize={isHorizontal ? 24 : barSize}
                isAnimationActive
                animationDuration={500}
                animationEasing="ease-out"
                {...(showBarLabels && {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  label: (p: any) => renderBarLabel(p, valueFormatter, isHorizontal),
                })}
              />
            );
          })}
        </RechartsBarChart>
      </ResponsiveContainer>
      {showLegend && barKeys.length > 1 && (
        <div className="mt-5 flex flex-wrap justify-center gap-4">
          {barKeys.map((key, i) => {
            const color = getBarColor(barKeys, colors, i);
            return (
              <div
                key={key}
                className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 dark:bg-slate-800/60"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {barLabels?.[key] ?? key}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
