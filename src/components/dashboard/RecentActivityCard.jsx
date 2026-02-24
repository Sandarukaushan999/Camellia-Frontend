import React, { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import CardShell from "./primitives/CardShell.jsx";
import SkeletonBlock from "./primitives/SkeletonBlock.jsx";
import { dashboardAnimationConfig, withReducedMotion } from "./animationsConfig.js";

function paymentChipClasses(paymentMethod) {
  const method = String(paymentMethod || "").toUpperCase();

  if (method === "CASH") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (method === "CARD") {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }
  if (method === "ONLINE") {
    return "bg-violet-50 text-violet-700 border-violet-200";
  }
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function formatTime(createdAt) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RecentActivitySkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={`activity-skeleton-${index}`} className="rounded-xl border border-slate-200 p-3">
          <div className="flex justify-between">
            <div className="space-y-1">
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="h-4 w-16 rounded-full" />
            </div>
            <div className="space-y-1 text-right">
              <SkeletonBlock className="ml-auto h-3 w-20" />
              <SkeletonBlock className="ml-auto h-3 w-14" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RecentActivityCard({
  loading,
  orders,
  newOrderIds,
  formatCurrency,
  onOrderOpen,
}) {
  const [visibleCount, setVisibleCount] = useState(5);
  const reducedMotion = useReducedMotion();
  const visibleOrders = orders.slice(0, visibleCount);
  const canExpand = visibleCount < orders.length;

  return (
    <CardShell
      title="Recent Activity"
      subtitle="Latest order flow"
      icon={<i className="fi-rr-time-fast" aria-hidden="true" />}
      action={
        orders.length > 5 ? (
          <button
            type="button"
            onClick={() => setVisibleCount((count) => (count > 5 ? 5 : Math.min(orders.length, count + 5)))}
            className="cv-acid-btn-soft inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors"
          >
            {visibleCount > 5 ? "Show less" : "View more"}
          </button>
        ) : null
      }
    >
      {loading ? (
        <RecentActivitySkeleton />
      ) : visibleOrders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
          Recent orders will appear here as soon as transactions are placed.
        </div>
      ) : (
        <>
          <motion.ul layout className="space-y-2">
            <AnimatePresence initial={false}>
              {visibleOrders.map((order) => {
                const isNew = newOrderIds.includes(order.id);
                return (
                  <motion.li
                    key={order.id}
                    layout
                    initial={{ opacity: 0, x: 22 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -18 }}
                    transition={withReducedMotion(reducedMotion, {
                      duration: dashboardAnimationConfig.duration.fast,
                      ease: dashboardAnimationConfig.ease.standard,
                    })}
                    whileHover={
                      reducedMotion
                        ? {}
                        : {
                            y: -1,
                            borderColor: "rgba(96,165,250,0.45)",
                            boxShadow: "0 10px 20px -16px rgba(37,99,235,0.45)",
                          }
                    }
                    className="rounded-xl border border-slate-200/80 bg-slate-50/30 px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => onOrderOpen(order)}
                      className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">#{order.id}</p>
                          <span
                            className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${paymentChipClasses(
                              order.paymentMethod
                            )} ${isNew ? "dashboard-status-chip-new" : ""}`}
                          >
                            {String(order.paymentMethod || "UNKNOWN").toUpperCase()}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">{formatCurrency(order.total)}</p>
                          <p className="text-xs text-slate-500">{formatTime(order.createdAt)}</p>
                        </div>
                      </div>
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ul>

          {canExpand && (
            <motion.button
              type="button"
              onClick={() => setVisibleCount((count) => Math.min(orders.length, count + 5))}
              whileHover={reducedMotion ? {} : { x: 2 }}
              whileTap={reducedMotion ? {} : { scale: 0.98 }}
              transition={withReducedMotion(reducedMotion, {
                duration: dashboardAnimationConfig.duration.fast,
                ease: dashboardAnimationConfig.ease.standard,
              })}
              className="cv-acid-btn-soft mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
            >
              View more
              <span className="cv-dashboard-icon-inline" aria-hidden="true">
                <i className="fi-rr-arrow-small-right" />
              </span>
            </motion.button>
          )}
        </>
      )}
    </CardShell>
  );
}
