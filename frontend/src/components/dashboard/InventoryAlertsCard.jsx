import React, { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import CardShell from "./primitives/CardShell.jsx";
import SkeletonBlock from "./primitives/SkeletonBlock.jsx";
import { dashboardAnimationConfig, withReducedMotion } from "./animationsConfig.js";

const severityStyles = {
  low: {
    iconClass: "fi-rr-info",
    label: "Low",
    className: "border-amber-200 bg-gradient-to-r from-amber-50 to-white text-amber-800",
  },
  medium: {
    iconClass: "fi-rr-exclamation",
    label: "Medium",
    className: "border-orange-200 bg-gradient-to-r from-orange-50 to-white text-orange-800",
  },
  critical: {
    iconClass: "fi-rr-triangle-warning",
    label: "Critical",
    className: "border-rose-200 bg-gradient-to-r from-rose-50 to-white text-rose-800",
  },
};

function AlertsSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={`alert-skeleton-${index}`} className="rounded-xl border border-slate-200 px-3 py-3">
          <SkeletonBlock className="mb-1 h-3 w-24" />
          <SkeletonBlock className="mb-2 h-4 w-40" />
          <SkeletonBlock className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}

export default function InventoryAlertsCard({ loading, alerts }) {
  const reducedMotion = useReducedMotion();
  const groupedAlerts = useMemo(() => {
    return alerts.reduce((acc, alert) => {
      const key = alert.category || "Alerts";
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(alert);
      return acc;
    }, {});
  }, [alerts]);

  const categoryEntries = Object.entries(groupedAlerts);

  return (
    <CardShell
      title="Inventory & Alerts"
      subtitle="Stock and expiry risk tracker"
      icon={<i className="fi-rr-triangle-warning" aria-hidden="true" />}
    >
      {loading ? (
        <AlertsSkeleton />
      ) : categoryEntries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
          No inventory alerts right now.
        </div>
      ) : (
        <div className="space-y-4">
          {categoryEntries.map(([category, categoryAlerts]) => (
            <div key={category}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{category}</h3>
              <div className="space-y-2">
                {categoryAlerts.map((alert, index) => {
                  const severity = severityStyles[alert.severity] || severityStyles.low;
                  const isCritical = alert.severity === "critical";

                  return (
                    <motion.div
                      key={alert.id || `${alert.title}-${index}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={withReducedMotion(reducedMotion, {
                        duration: dashboardAnimationConfig.duration.fast,
                        delay: index * dashboardAnimationConfig.stagger.list,
                        ease: dashboardAnimationConfig.ease.enter,
                      })}
                      className={`rounded-xl border px-3 py-2 ${severity.className} ${
                        isCritical ? "dashboard-critical-emphasis" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{alert.title}</p>
                          <p className="text-xs text-slate-600">{alert.detail}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold">
                          <span className="cv-dashboard-icon-inline" aria-hidden="true">
                            <i className={severity.iconClass} />
                          </span>
                          {severity.label}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </CardShell>
  );
}
