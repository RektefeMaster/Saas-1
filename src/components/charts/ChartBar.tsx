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
  emerald: ["#10b981", "#34d399", "#6ee7b7"],
  amber: ["#f59e0b", "#fbbf24", "#fcd34d"],
  violet: ["#8b5cf6", "#a78bfa", "#c4b5fd"],
  blue: ["#3b82f6", "#60a5fa", "#93c5fd"],
  slate: ["#64748b", "#94a3b8", "#cbd5e1"],
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
  /** Yükseklik (px) */
  height?: number;
  /** Bar genişliği (px) */
  barSize?: number;
  /** Bar gap (0-1) */
  barGap?: number;
  /** Farklı ölçekli serileri 0-100 normalize et (görsel karşılaştırma) */
  normalize?: boolean;
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
  payload?: Array<{ name: string; value: number; color: string; payload?: Record<string, unknown> }>;
  label?: string;
  valueFormatter?: (v: number) => string;
  barKeys?: string[];
  normalize?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const fmt = valueFormatter ?? ((v: number) => String(v));
  const displayPayload =
    normalize && barKeys
      ? payload.map((p, i) => ({
          ...p,
          value: Number(p.payload?.[barKeys[i]]) ?? p.value,
        }))
      : payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl dark:border-slate-700 dark:bg-slate-800">
      <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</p>
      <div className="space-y-1.5">
        {displayPayload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}
            </span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {fmt(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
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
  height = 280,
  barSize = 36,
  barGap = 0.25,
  normalize = false,
  className = "",
}: ChartBarProps) {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.05 });
  const barKeys = Array.isArray(bars) ? bars : [bars];

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
  const yDomain = [0, Math.ceil(maxVal * 1.2) || 1];

  if (!inView) {
    return (
      <div
        ref={ref}
        className={`animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/50 ${className}`}
        style={{ height }}
      />
    );
  }

  return (
    <div ref={ref} className={`w-full ${className}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={displayData}
          margin={{ top: 16, right: 12, left: 4, bottom: 8 }}
        >
          <defs>
            {displayKeys.map((key, i) => {
              const color = getBarColor(barKeys, colors, i);
              return (
                <linearGradient key={key} id={`chart-bar-${key}-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={1} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.8} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid
            strokeDasharray="4 4"
            stroke="currentColor"
            strokeOpacity={0.1}
            vertical={false}
          />
          <XAxis
            dataKey={xKey}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "currentColor", opacity: 0.7 }}
            tickMargin={12}
          />
          <YAxis
            domain={yDomain}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }}
            tickFormatter={
              normalize
                ? (v) => (v % 25 === 0 ? String(v) : "")
                : valueFormatter
                  ? (v) => valueFormatter(v)
                  : undefined
            }
            width={44}
            tickMargin={8}
          />
          <Tooltip
            cursor={{ fill: "currentColor", opacity: 0.06 }}
            content={(props) => (
              <CustomTooltip
                {...props}
                valueFormatter={valueFormatter}
                barKeys={normalize ? barKeys : undefined}
                normalize={normalize}
              />
            )}
          />
          {displayKeys.map((key, i) => (
            <Bar
              key={key}
              dataKey={key}
              name={barLabels?.[barKeys[i]] ?? barKeys[i]}
              fill={`url(#chart-bar-${key}-${i})`}
              radius={[8, 8, 0, 0]}
              maxBarSize={barSize}
              barCategoryGap={`${barGap * 100}%`}
              isAnimationActive
              animationDuration={400}
              animationEasing="ease-out"
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
      {showLegend && barKeys.length > 1 && (
        <div className="mt-4 flex flex-wrap justify-center gap-6">
          {barKeys.map((key, i) => {
            const color = getBarColor(barKeys, colors, i);
            return (
              <div key={key} className="flex items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
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
