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
  if (type === "new-order") {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
      </svg>
    );
  }
  if (type === "add-stock") {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 8l-9-5-9 5m18 0l-9 5m9-5v9l-9 5m0-9L3 8m9 5v9"
        />
      </svg>
    );
  }
  if (type === "reports") {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 19V9m7 10V5m7 14v-6M3 21h18"
        />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11.049 2.927c.3-1.14 1.926-1.14 2.226 0a1.2 1.2 0 001.69.737c1.01-.51 2.18.66 1.67 1.67a1.2 1.2 0 00.737 1.69c1.14.3 1.14 1.926 0 2.226a1.2 1.2 0 00-.737 1.69c.51 1.01-.66 2.18-1.67 1.67a1.2 1.2 0 00-1.69.737c-.3 1.14-1.926 1.14-2.226 0a1.2 1.2 0 00-1.69-.737c-1.01.51-2.18-.66-1.67-1.67a1.2 1.2 0 00-.737-1.69c-1.14-.3-1.14-1.926 0-2.226a1.2 1.2 0 00.737-1.69c-.51-1.01.66-2.18 1.67-1.67a1.2 1.2 0 001.69-.737z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9.5A2.5 2.5 0 1112 14.5 2.5 2.5 0 0112 9.5z" />
    </svg>
  );
}

export default function QuickActionsCard({ actions }) {
  const reducedMotion = useReducedMotion();

  return (
    <CardShell title="Quick Actions" subtitle="Fast shortcuts for daily tasks">
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
