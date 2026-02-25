import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import CardShell from "./primitives/CardShell.jsx";
import SkeletonBlock from "./primitives/SkeletonBlock.jsx";

function MonthItemChartSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={`month-item-chart-skeleton-${index}`} className="flex items-center gap-2">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-6 flex-1 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function SalesTooltip({ active, payload, label, formatCurrency }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const source = payload[0]?.payload || {};
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 p-3 text-xs shadow-lg">
      <p className="font-semibold text-slate-800">{label}</p>
      <p className="mt-1 text-slate-600">{Number(source.qty || 0).toLocaleString("en-US")} units sold</p>
      <p className="mt-1 font-semibold text-blue-700">{formatCurrency(source.revenue || 0)}</p>
    </div>
  );
}

export default function ItemSalesMonthChartCard({
  loading,
  items,
  formatCurrency,
  periodLabel = "Monthly",
}) {
  const chartData = useMemo(
    () =>
      (Array.isArray(items) ? items : [])
        .map((item) => ({
          name: String(item?.name || "Unnamed"),
          qty: Number(item?.qty || 0),
          revenue: Number(item?.revenue || 0),
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10),
    [items]
  );

  const chartHeight = Math.max(250, chartData.length * 36);

  return (
    <CardShell
      title={`Item-wise Sales Chart (${periodLabel})`}
      subtitle={`Accurate ${periodLabel.toLowerCase()} product sales from invoices`}
      icon={<i className="fi-rr-chart-histogram" aria-hidden="true" />}
    >
      {loading ? (
        <MonthItemChartSkeleton />
      ) : chartData.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
          No item sales recorded for this period yet.
        </div>
      ) : (
        <div className="min-w-0" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height={chartHeight} minWidth={0} minHeight={250}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 6, right: 14, left: 6, bottom: 6 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis
                type="number"
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={false}
                tickFormatter={(value) =>
                  value >= 1000 ? `Rs ${Math.round(Number(value) / 1000)}k` : `Rs ${Math.round(value)}`
                }
              />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fill: "#334155", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<SalesTooltip formatCurrency={formatCurrency} />} />
              <Bar
                dataKey="revenue"
                radius={[0, 6, 6, 0]}
                fill="#4f46e5"
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </CardShell>
  );
}
