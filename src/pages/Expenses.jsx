import React, { useEffect, useMemo, useState } from "react";
import api from "../utils/api.js";
import { getActiveBranchId, onActiveBranchChange } from "../utils/branchContext.js";

const PRESET_EXPENSE_CATEGORIES = [
  "Utilities",
  "Supplies",
  "Salary",
  "Rent",
  "Maintenance",
  "Marketing",
  "Transport",
  "Tax",
  "Equipment",
  "Ingredients",
  "Other",
];

const DEFAULT_FORM = {
  category: PRESET_EXPENSE_CATEGORIES[0],
  custom_category: "",
  description: "",
  amount: "",
  incurred_at: "",
};

const BADGE_STYLES = [
  "bg-sky-100 text-sky-800",
  "bg-purple-100 text-purple-800",
  "bg-emerald-100 text-emerald-800",
  "bg-orange-100 text-orange-800",
  "bg-rose-100 text-rose-800",
  "bg-indigo-100 text-indigo-800",
];

function toMoney(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizeCategory(value) {
  return String(value || "").trim();
}

function formatDateTime(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Expenses() {
  const [activeBranchId, setActiveBranchId] = useState(() => getActiveBranchId(null));
  const [days, setDays] = useState("30");
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState({ ...DEFAULT_FORM });

  useEffect(() => onActiveBranchChange((nextBranchId) => setActiveBranchId(nextBranchId)), []);

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const params = {
        days: Number(days) || 30,
        limit: 1000,
        branch_id: activeBranchId || undefined,
      };
      const { data } = await api.get("/admin/expenses", { params });
      setExpenses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load expenses", err);
      setExpenses([]);
      setMessage(err.response?.data?.message || "Failed to load expenses");
      setTimeout(() => setMessage(""), 2800);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [activeBranchId, days]);

  const allCategories = useMemo(() => {
    const fromRows = expenses.map((row) => normalizeCategory(row.category)).filter(Boolean);
    const merged = [...new Set([...PRESET_EXPENSE_CATEGORIES.filter((c) => c !== "Other"), ...fromRows])];
    return merged.sort((a, b) => a.localeCompare(b));
  }, [expenses]);

  const categoryTotals = useMemo(() => {
    const totals = new Map();
    for (const row of expenses) {
      const key = normalizeCategory(row.category) || "Uncategorized";
      const current = totals.get(key) || 0;
      totals.set(key, current + Number(row.amount || 0));
    }
    return Array.from(totals.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return expenses.filter((row) => {
      const rowCategory = normalizeCategory(row.category);
      const passesCategory = categoryFilter === "ALL" || rowCategory === categoryFilter;
      if (!passesCategory) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      const description = String(row.description || "").toLowerCase();
      return rowCategory.toLowerCase().includes(normalizedSearch) || description.includes(normalizedSearch);
    });
  }, [expenses, categoryFilter, searchTerm]);

  const totalExpense = useMemo(
    () => filteredExpenses.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [filteredExpenses]
  );

  const avgExpense = useMemo(
    () => (filteredExpenses.length > 0 ? totalExpense / filteredExpenses.length : 0),
    [filteredExpenses.length, totalExpense]
  );

  const topCategory = useMemo(() => categoryTotals[0] || null, [categoryTotals]);

  const resolvedFormCategory = useMemo(() => {
    if (form.category === "Other") {
      return normalizeCategory(form.custom_category);
    }
    return normalizeCategory(form.category);
  }, [form.category, form.custom_category]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const amount = parseFloat(form.amount);
    const trimmedDescription = form.description.trim();
    if (!resolvedFormCategory) {
      setMessage("Please select or type an expense category");
      setTimeout(() => setMessage(""), 2600);
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Amount must be a valid positive number");
      setTimeout(() => setMessage(""), 2500);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: (trimmedDescription || resolvedFormCategory).slice(0, 120),
        category: resolvedFormCategory,
        description: trimmedDescription || null,
        amount,
        incurred_at: form.incurred_at ? new Date(form.incurred_at).toISOString() : null,
        branch_id: activeBranchId || null,
      };
      await api.post("/admin/expenses", payload);
      setForm((prev) => ({
        ...DEFAULT_FORM,
        category: prev.category,
        custom_category: prev.category === "Other" ? prev.custom_category : "",
      }));
      await loadExpenses();
      setMessage("Expense recorded");
      setTimeout(() => setMessage(""), 2500);
    } catch (err) {
      console.error("Failed to create expense", err);
      setMessage(err.response?.data?.message || "Failed to create expense");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  const getBadgeClass = (category) => {
    const index = Math.max(0, allCategories.indexOf(normalizeCategory(category)));
    return BADGE_STYLES[index % BADGE_STYLES.length];
  };

  return (
    <div className="cv-page cv-page--expenses p-4 md:p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="cv-page-header flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <h1 className="cv-page-title flex items-center gap-2 text-3xl font-bold text-gray-900">
              <span className="cv-expense-page-icon" aria-hidden="true">
                <i className="fi-rr-receipt" />
              </span>
              Expenses
            </h1>
            <p className="cv-page-subtitle text-sm text-gray-600 mt-1">
              Manage daily costs with category-level control and custom expense types
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full xl:w-auto">
            <select
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="365">Last 365 Days</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="ALL">All Categories</option>
              {allCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search category or note"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-wide text-gray-500">Filtered Total</div>
              <span className="cv-expense-stat-icon bg-red-50 text-red-700">
                <i className="fi-rr-wallet" aria-hidden="true" />
              </span>
            </div>
            <div className="text-3xl font-bold text-red-700 mt-2">{toMoney(totalExpense)}</div>
            <div className="text-xs text-gray-500 mt-2">{filteredExpenses.length} records shown</div>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-wide text-gray-500">Average Entry</div>
              <span className="cv-expense-stat-icon bg-blue-50 text-blue-700">
                <i className="fi-rr-calculator" aria-hidden="true" />
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mt-2">{toMoney(avgExpense)}</div>
            <div className="text-xs text-gray-500 mt-2">Per selected range/filter</div>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-wide text-gray-500">Top Category</div>
              <span className="cv-expense-stat-icon bg-indigo-50 text-indigo-700">
                <i className="fi-rr-tags" aria-hidden="true" />
              </span>
            </div>
            <div className="text-xl font-bold text-indigo-700 mt-2">{topCategory?.category || "-"}</div>
            <div className="text-xs text-gray-500 mt-2">
              {topCategory ? toMoney(topCategory.total) : "No data in selected range"}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-wide text-gray-500">Current Branch</div>
              <span className="cv-expense-stat-icon bg-emerald-50 text-emerald-700">
                <i className="fi-rr-shop" aria-hidden="true" />
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mt-2">
              {activeBranchId ? `#${activeBranchId}` : "All"}
            </div>
            <div className="text-xs text-gray-500 mt-2">Use top selector to switch</div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-4">
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 space-y-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                <span className="cv-expense-inline-icon" aria-hidden="true">
                  <i className="fi-rr-plus" />
                </span>
                Add Expense
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Choose a category, or select Other to type a custom expense category.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {PRESET_EXPENSE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {form.category === "Other" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Custom Category Name
                  </label>
                  <input
                    type="text"
                    value={form.custom_category}
                    maxLength={80}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, custom_category: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Type category name"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {PRESET_EXPENSE_CATEGORIES.filter((item) => item !== "Other")
                  .slice(0, 6)
                  .map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, category, custom_category: "" }))}
                      className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        form.category === category ? "cv-acid-btn" : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {category}
                    </button>
                  ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Amount (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Date & Time</label>
                <input
                  type="datetime-local"
                  value={form.incurred_at}
                  onChange={(e) => setForm((prev) => ({ ...prev, incurred_at: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={4}
                  maxLength={500}
                  placeholder="Optional note for this expense"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className={`w-full px-4 py-2.5 rounded-lg font-semibold ${
                  submitting ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "cv-acid-btn"
                }`}
              >
                {submitting ? "Saving..." : "Save Expense"}
              </button>
            </form>

            <div className="pt-2 border-t border-gray-200">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 mb-2">
                <span className="cv-expense-inline-icon" aria-hidden="true">
                  <i className="fi-rr-chart-pie-alt" />
                </span>
                Category Breakdown
              </div>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {categoryTotals.length === 0 ? (
                  <div className="text-xs text-gray-500">No category totals yet</div>
                ) : (
                  categoryTotals.map((item) => (
                    <div key={item.category} className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-semibold text-gray-700 truncate">{item.category}</span>
                      <span className="text-gray-900 font-bold">{toMoney(item.total)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <span className="cv-expense-inline-icon" aria-hidden="true">
                  <i className="fi-rr-list-check" />
                </span>
                Expense Records
              </div>
              <div className="text-xs text-gray-500">
                Showing {filteredExpenses.length} of {expenses.length}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                        Loading expenses...
                      </td>
                    </tr>
                  ) : filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                        No expenses found for the current filter
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-700">{formatDateTime(row.incurred_at)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${getBadgeClass(
                              row.category
                            )}`}
                          >
                            {row.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{row.description || "-"}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{toMoney(row.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {message && (
        <div className="fixed bottom-4 right-4 cv-acid-btn px-5 py-3 rounded-lg shadow-xl z-50 text-sm font-semibold">
          {message}
        </div>
      )}
    </div>
  );
}
