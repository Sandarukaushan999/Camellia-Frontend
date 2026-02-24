import React from "react";

export default function CardShell({ title, subtitle, action, className = "", children }) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm md:p-5 ${className}`.trim()}
    >
      {(title || subtitle || action) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold text-slate-900 md:text-lg">{title}</h2>}
            {subtitle && <p className="mt-1 text-xs text-slate-500 md:text-sm">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
