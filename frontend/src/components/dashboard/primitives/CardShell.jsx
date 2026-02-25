import React from "react";

export default function CardShell({ title, subtitle, action, icon, className = "", children }) {
  return (
    <section
      className={`h-full rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm md:p-5 flex flex-col ${className}`.trim()}
    >
      {(title || subtitle || action) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            {icon ? <span className="cv-dashboard-card-icon">{icon}</span> : null}
            <div className="min-w-0">
              {title && <h2 className="text-base font-semibold text-slate-900 md:text-lg">{title}</h2>}
              {subtitle && <p className="mt-1 text-xs text-slate-500 md:text-sm">{subtitle}</p>}
            </div>
          </div>
          {action}
        </header>
      )}
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
