import React, { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import CardShell from "./primitives/CardShell.jsx";
import SkeletonBlock from "./primitives/SkeletonBlock.jsx";
import { dashboardAnimationConfig, withReducedMotion } from "./animationsConfig.js";
import { formatBusinessDate } from "../../utils/timezone.js";

const defaultRangeOptions = [
  { value: "daily", label: "Daily" },
  { value: "seven_days", label: "7 Days" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

function formatRelativeTime(dateValue) {
  if (!dateValue) {
    return "Updated just now";
  }

  const timestamp = new Date(dateValue).getTime();
  const diffInSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (diffInSeconds < 60) {
    return "Updated just now";
  }

  const minutes = Math.floor(diffInSeconds / 60);
  if (minutes < 60) {
    return `Updated ${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  return `Updated ${hours}h ago`;
}

function ChartSkeleton() {
  return (
    <div className="h-[320px] rounded-xl border border-slate-200/70 bg-slate-50 p-4">
      <div className="mb-5 flex justify-between">
        <SkeletonBlock className="h-3 w-20" />
        <SkeletonBlock className="h-3 w-14" />
      </div>
      <div className="flex h-[250px] items-end gap-2">
        {Array.from({ length: 12 }).map((_, index) => (
          <SkeletonBlock
            key={`bar-${index}`}
            className="w-full rounded-md"
            style={{ height: `${40 + ((index % 5) + 1) * 30}px` }}
          />
        ))}
      </div>
    </div>
  );
}

function SalesTooltip({ active, payload, label, formatCurrency }) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const dateLabel = formatBusinessDate(label, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 p-3 shadow-lg">
      <p className="text-xs font-medium text-slate-500">{dateLabel}</p>
      <p className="mt-1 text-sm font-semibold text-blue-700">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

export default function SalesChartCard({
  data,
  loading,
  range,
  onRangeChange,
  rangeOptions = defaultRangeOptions,
  lastUpdated,
  formatCurrency,
  title = "Sales Trend",
}) {
  const reducedMotion = useReducedMotion();

  const yTicks = useMemo(() => {
    const maxValue = Math.max(0, ...data.map((entry) => Number(entry.total || 0)));
    const top = maxValue === 0 ? 5000 : Math.ceil(maxValue / 1000) * 1000;
    const step = Math.max(1000, Math.ceil(top / 4 / 500) * 500);

    const ticks = [];
    for (let value = 0; value <= top; value += step) {
      ticks.push(value);
    }
    return ticks;
  }, [data]);

  return (
    <CardShell
      title={title}
      subtitle={formatRelativeTime(lastUpdated)}
      icon={<i className="fi-rr-chart-line-up" aria-hidden="true" />}
      action={
        <div className="inline-flex rounded-lg bg-slate-100 p-1">
          {rangeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onRangeChange(option.value)}
              className={`relative px-3 py-1 text-xs font-semibold transition-colors ${
                range === option.value ? "text-blue-700" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {range === option.value && (
                <motion.span
                  layoutId="sales-range-toggle"
                  className="absolute inset-0 rounded-md bg-white shadow-sm"
                  transition={withReducedMotion(reducedMotion, {
                    duration: dashboardAnimationConfig.duration.fast,
                    ease: dashboardAnimationConfig.ease.standard,
                  })}
                />
              )}
              <span className="relative z-10">{option.label}</span>
            </button>
          ))}
        </div>
      }
    >
      {loading ? (
        <ChartSkeleton />
      ) : (
        <div className="h-[320px] min-w-0">
          <ResponsiveContainer width="100%" height={320} minWidth={0} minHeight={240}>
            <LineChart data={data} margin={{ top: 8, right: 10, left: 2, bottom: 4 }}>
              <defs>
                <linearGradient id="salesAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid stroke="#e2e8f0" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="day"
                tickFormatter={(_, idx) => data[idx]?.label || ""}
                minTickGap={20}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
              />
              <YAxis
                width={54}
                ticks={yTicks}
                tickFormatter={(value) => (value >= 1000 ? `${Math.round(value / 1000)}k` : value)}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ stroke: "#93c5fd", strokeDasharray: "4 4", strokeWidth: 1 }}
                content={<SalesTooltip formatCurrency={formatCurrency} />}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="none"
                fill="url(#salesAreaGradient)"
                isAnimationActive={!reducedMotion}
                animationDuration={reducedMotion ? 0 : 500}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={false}
                activeDot={{
                  r: 5,
                  fill: "#ffffff",
                  stroke: "#1d4ed8",
                  strokeWidth: 2,
                }}
                isAnimationActive={!reducedMotion}
                animationDuration={reducedMotion ? 0 : 700}
                animationEasing="ease-out"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </CardShell>
  );
}
