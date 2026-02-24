import React from "react";
import { motion, useReducedMotion } from "motion/react";
import CardShell from "./primitives/CardShell.jsx";
import { dashboardAnimationConfig, withReducedMotion } from "./animationsConfig.js";

const actionStyles = {
  primary: "from-blue-600 to-blue-500 text-white",
  secondary: "from-emerald-600 to-emerald-500 text-white",
  neutral: "from-slate-700 to-slate-600 text-white",
  accent: "from-indigo-600 to-indigo-500 text-white",
};

function ActionIcon({ type }) {
  const iconClassByType = {
    "new-order": "fi-rr-plus",
    "add-stock": "fi-rr-boxes",
    reports: "fi-rr-chart-line-up",
    settings: "fi-rr-settings",
  };
  const resolvedClass = iconClassByType[type] || "fi-rr-apps";

  return (
    <span className="cv-dashboard-icon-inline">
      <i className={resolvedClass} aria-hidden="true" />
    </span>
  );
}

export default function QuickActionsCard({ actions }) {
  const reducedMotion = useReducedMotion();

  return (
    <CardShell
      title="Quick Actions"
      subtitle="Fast shortcuts for daily tasks"
      icon={<i className="fi-rr-bolt" aria-hidden="true" />}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {actions.map((action, index) => (
          <motion.button
            key={action.id}
            type="button"
            onClick={action.onClick}
            initial="hidden"
            animate="visible"
            whileHover="hover"
            variants={
              reducedMotion
                ? {
                    hidden: { opacity: 1, y: 0 },
                    visible: { opacity: 1, y: 0 },
                    hover: { y: 0, scale: 1 },
                  }
                : {
                    hidden: { opacity: 0, y: 8 },
                    visible: { opacity: 1, y: 0 },
                    hover: { y: -2, scale: 1.01 },
                  }
            }
            transition={withReducedMotion(reducedMotion, {
              duration: dashboardAnimationConfig.duration.fast,
              delay: index * dashboardAnimationConfig.stagger.list,
              ease: dashboardAnimationConfig.ease.enter,
            })}
            whileTap={reducedMotion ? {} : { scale: 0.98 }}
            className={`group rounded-xl bg-gradient-to-br px-4 py-4 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
              actionStyles[action.variant] || actionStyles.primary
            }`}
          >
            <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
              <span
                className={`inline-flex transition-transform duration-200 ${
                  reducedMotion
                    ? ""
                    : action.id === "settings"
                    ? "group-hover:rotate-12"
                    : action.id === "reports"
                    ? "group-hover:translate-x-0.5"
                    : action.id === "new-order"
                    ? "group-hover:-translate-y-0.5"
                    : "group-hover:translate-x-0.5"
                }`}
              >
                <ActionIcon type={action.icon} />
              </span>
            </div>
            <p className="text-sm font-semibold">{action.label}</p>
            <p className="mt-0.5 text-xs text-white/80">{action.description}</p>
          </motion.button>
        ))}
      </div>
    </CardShell>
  );
}
