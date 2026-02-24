import React, { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import CardShell from "./primitives/CardShell.jsx";
import SkeletonBlock from "./primitives/SkeletonBlock.jsx";
import { dashboardAnimationConfig, withReducedMotion } from "./animationsConfig.js";

function createSparklinePoints(item, seed) {
  const quantity = Number(item.qty || 1);
  const revenue = Number(item.revenue || 0);
  const base = Math.max(1, revenue / Math.max(1, quantity));

  const values = Array.from({ length: 10 }, (_, idx) => {
    const wave = Math.sin((idx + 1 + seed) * 0.85) * 0.25;
    const drift = 0.85 + idx * 0.04;
    return Math.max(1, base * (1 + wave) * drift);
  });

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);

  return values
    .map((value, idx) => {
      const x = (idx / (values.length - 1)) * 72;
      const y = 18 - ((value - min) / range) * 16;
      return `${x},${y}`;
    })
    .join(" ");
}

function RankBadge({ rank }) {
  const rankStyles = [
    "from-amber-300 to-amber-500 text-amber-950",
    "from-slate-300 to-slate-400 text-slate-800",
    "from-orange-300 to-orange-500 text-orange-950",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.82 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: dashboardAnimationConfig.duration.fast,
        ease: dashboardAnimationConfig.ease.enter,
      }}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-xs font-bold ${
        rankStyles[rank - 1] || "from-blue-100 to-blue-200 text-blue-800"
      }`}
    >
      #{rank}
    </motion.div>
  );
}

function TopItemsSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={`top-items-skeleton-${index}`} className="rounded-xl border border-slate-200 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-8 w-8 rounded-lg" />
              <div className="space-y-1">
                <SkeletonBlock className="h-3 w-32" />
                <SkeletonBlock className="h-3 w-16" />
              </div>
            </div>
            <SkeletonBlock className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TopSellingItemsCard({ loading, items, formatCurrency }) {
  const [visibleCount, setVisibleCount] = useState(5);
  const reducedMotion = useReducedMotion();

  const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);
  const canExpand = items.length > visibleCount;

  return (
    <CardShell
      title="Top Selling Items"
      subtitle="Best performing products today"
      icon={<i className="fi-rr-star" aria-hidden="true" />}
      action={
        items.length > 5 ? (
          <button
            type="button"
            onClick={() => setVisibleCount((count) => (count > 5 ? 5 : Math.min(items.length, count + 5)))}
            className="cv-acid-btn-soft inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors"
          >
            {visibleCount > 5 ? "Show less" : "View more"}
          </button>
        ) : null
      }
    >
      {loading ? (
        <TopItemsSkeleton />
      ) : visibleItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
          Top items will appear when sales start.
        </div>
      ) : (
        <>
          <motion.ul layout className="space-y-2">
            <AnimatePresence initial={false}>
              {visibleItems.map((item, index) => (
                <motion.li
                  key={item.name}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={withReducedMotion(reducedMotion, {
                    duration: dashboardAnimationConfig.duration.fast,
                    ease: dashboardAnimationConfig.ease.standard,
                  })}
                  whileHover={
                    reducedMotion
                      ? {}
                      : {
                          y: -1,
                          borderColor: "rgba(96,165,250,0.4)",
                          boxShadow: "0 10px 20px -16px rgba(37,99,235,0.45)",
                        }
                  }
                  className="rounded-xl border border-slate-200/80 bg-slate-50/40 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <RankBadge rank={index + 1} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
                        <p className="text-xs text-slate-500">{item.qty} units sold</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.revenue)}</p>
                      <svg viewBox="0 0 72 20" className="mt-1 h-5 w-[72px]" aria-hidden="true">
                        <polyline
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={createSparklinePoints(item, index)}
                        />
                      </svg>
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>

          {canExpand && (
            <motion.button
              type="button"
              whileHover={reducedMotion ? {} : { x: 2 }}
              whileTap={reducedMotion ? {} : { scale: 0.98 }}
              transition={withReducedMotion(reducedMotion, {
                duration: dashboardAnimationConfig.duration.fast,
                ease: dashboardAnimationConfig.ease.standard,
              })}
              onClick={() => setVisibleCount((count) => Math.min(items.length, count + 5))}
              className="cv-acid-btn-soft mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold"
            >
              Show {Math.min(5, items.length - visibleCount)} more
            </motion.button>
          )}
        </>
      )}
    </CardShell>
  );
}
