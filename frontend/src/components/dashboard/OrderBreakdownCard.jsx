import React, { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import CardShell from "./primitives/CardShell.jsx";
import SkeletonBlock from "./primitives/SkeletonBlock.jsx";
import { dashboardAnimationConfig, withReducedMotion } from "./animationsConfig.js";

const chartColors = ["#2563eb", "#0ea5e9", "#14b8a6", "#a855f7"];

function BreakdownSkeleton() {
  return (
    <div className="space-y-4">
      <div className="mx-auto h-44 w-44 rounded-full">
        <SkeletonBlock className="h-full w-full rounded-full" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonBlock key={`breakdown-${index}`} className="h-10 w-full rounded-xl" />
        ))}
      </div>
      <div className="space-y-2 pt-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <SkeletonBlock key={`peak-${index}`} className="h-7 w-full rounded-full" />
        ))}
      </div>
    </div>
  );
}

function BreakdownTooltip({ active, payload, formatCurrency }) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 p-3 text-xs shadow-lg">
      <p className="font-semibold text-slate-800">{item.type}</p>
      <p className="mt-1 text-slate-600">{item.percentage}% of orders</p>
      <p className="mt-1 font-semibold text-blue-700">{formatCurrency(item.total)}</p>
    </div>
  );
}

export default function OrderBreakdownCard({ loading, breakdown, peakHours, formatCurrency }) {
  const reducedMotion = useReducedMotion();

  const normalizedBreakdown = useMemo(
    () =>
      breakdown.map((item) => ({
        ...item,
        count: Number(item.count || 0),
        percentage: Number(item.percentage || 0),
        total: Number(item.total || 0),
      })),
    [breakdown]
  );

  const totalOrders = useMemo(
    () => normalizedBreakdown.reduce((sum, item) => sum + item.count, 0),
    [normalizedBreakdown]
  );

  return (
    <CardShell
      title="Order Breakdown"
      subtitle="By payment method + peak hour windows"
      icon={<i className="fi-rr-chart-pie-alt" aria-hidden="true" />}
    >
      {loading ? (
        <BreakdownSkeleton />
      ) : normalizedBreakdown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
          No orders captured in this period yet.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[170px_1fr] md:items-center">
            <div className="h-[170px] min-w-0">
              <ResponsiveContainer width="100%" height={170} minWidth={0} minHeight={140}>
                <PieChart>
                  <Tooltip content={<BreakdownTooltip formatCurrency={formatCurrency} />} />
                  <Pie
                    data={normalizedBreakdown}
                    dataKey="count"
                    nameKey="type"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                    startAngle={90}
                    endAngle={-270}
                    isAnimationActive={!reducedMotion}
                    animationDuration={reducedMotion ? 0 : 800}
                    animationEasing="ease-out"
                  >
                    {normalizedBreakdown.map((entry, index) => (
                      <Cell key={`${entry.type}-${index}`} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="-mt-24 text-center">
                <p className="text-2xl font-bold tracking-tight text-slate-900">{totalOrders}</p>
                <p className="text-xs text-slate-500">orders</p>
              </div>
            </div>

            <div className="space-y-2">
              {normalizedBreakdown.map((item, index) => (
                <div
                  key={item.type}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: chartColors[index % chartColors.length] }}
                      />
                      <span className="text-sm font-medium text-slate-700">{item.type}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">{item.percentage}%</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                    <span>{item.count} orders</span>
                    <span>{formatCurrency(item.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 border-t border-slate-200 pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Peak Hours</h3>
            <div className="flex flex-wrap gap-2">
              {peakHours.map((slot, index) => (
                <motion.div
                  key={slot.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={withReducedMotion(reducedMotion, {
                    duration: dashboardAnimationConfig.duration.fast,
                    delay: index * dashboardAnimationConfig.stagger.chips,
                    ease: dashboardAnimationConfig.ease.enter,
                  })}
                  className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                >
                  <span className="cv-dashboard-icon-inline">
                    <i className="fi-rr-time-fast" aria-hidden="true" />
                  </span>
                  <span>{slot.label}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-blue-700">
                    {slot.count}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </>
      )}
    </CardShell>
  );
}
