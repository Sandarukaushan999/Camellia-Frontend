import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { dashboardAnimationConfig, withReducedMotion } from "./animationsConfig.js";
import CountUpNumber from "./primitives/CountUpNumber.jsx";
import SkeletonBlock from "./primitives/SkeletonBlock.jsx";

const iconMap = {
  sales: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M12 6v12m0-12c-2.2 0-4 1.1-4 2.5S9.8 11 12 11s4 1.1 4 2.5S14.2 16 12 16m0-10V4m0 14v2M5 12a7 7 0 1014 0A7 7 0 005 12z"
      />
    </svg>
  ),
  orders: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M9 5h6m-7 4h8M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
      />
    </svg>
  ),
  avg: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M4 18l5-6 4 3 7-9M16 6h4v4"
      />
    </svg>
  ),
  profit: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M4 6h16M7 10h10M8 14h8M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z"
      />
    </svg>
  ),
  active: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M13 3L4 14h6l-1 7 9-11h-6l1-7z"
      />
    </svg>
  ),
};

function TrendPill({ trend }) {
  const trendValue = Number(trend || 0);
  const isUp = trendValue >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: dashboardAnimationConfig.duration.fast,
        ease: dashboardAnimationConfig.ease.enter,
      }}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        isUp ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
      }`}
    >
      <svg
        className={`h-3 w-3 ${isUp ? "" : "rotate-180"}`}
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M8 3l4 5H9v5H7V8H4l4-5z" />
      </svg>
      <span>{Math.abs(trendValue).toFixed(1)}%</span>
    </motion.div>
  );
}

function KpiSkeleton() {
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm md:p-5">
      <div className="mb-3 flex items-center justify-between">
        <SkeletonBlock className="h-9 w-9 rounded-lg" />
        <SkeletonBlock className="h-5 w-14 rounded-full" />
      </div>
      <SkeletonBlock className="mb-2 h-3 w-24" />
      <SkeletonBlock className="mb-2 h-8 w-32" />
      <SkeletonBlock className="h-3 w-20" />
    </article>
  );
}

export default function KpiCards({ kpis, loading, formatCurrency }) {
  const reducedMotion = useReducedMotion();

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <KpiSkeleton key={`kpi-skeleton-${index}`} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {kpis.map((kpi) => (
        <motion.article
          key={kpi.id}
          whileHover={
            reducedMotion
              ? {}
              : {
                  y: -3,
                  boxShadow: "0 18px 35px -26px rgba(37, 99, 235, 0.55)",
                }
          }
          transition={withReducedMotion(reducedMotion, {
            duration: dashboardAnimationConfig.duration.fast,
            ease: dashboardAnimationConfig.ease.standard,
          })}
          className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm md:p-5"
        >
          <div
            className={`absolute -right-10 -top-10 h-24 w-24 rounded-full bg-gradient-to-br opacity-0 blur-2xl transition-opacity duration-200 group-hover:opacity-100 ${
              kpi.glowClass || "from-blue-200 to-blue-50"
            }`}
          />
          <div className="relative z-10">
            <div className="mb-3 flex items-center justify-between">
              <div
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${
                  kpi.iconBgClass || "bg-blue-100"
                } ${kpi.iconClass || "text-blue-600"}`}
              >
                {iconMap[kpi.id]}
              </div>
              <TrendPill trend={kpi.trend} />
            </div>
            <p className="mb-1 text-xs font-medium text-slate-500">{kpi.label}</p>
            <CountUpNumber
              value={kpi.value}
              className="block text-xl font-bold tracking-tight text-slate-900"
              formatValue={(latest) =>
                kpi.valueType === "currency"
                  ? formatCurrency(latest)
                  : Math.round(latest).toLocaleString("en-US")
              }
            />
            <p className="mt-1 text-xs text-slate-500">{kpi.caption}</p>
          </div>
        </motion.article>
      ))}
    </div>
  );
}
