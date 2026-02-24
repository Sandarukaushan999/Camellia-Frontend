import React, { useEffect, useMemo, useState } from "react";
import api from "../utils/api.js";
import { getActiveBranchId, onActiveBranchChange } from "../utils/branchContext.js";

function toMoney(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function toDateTime(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusTone(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "VOIDED") return "danger";
  if (normalized.includes("REFUND")) return "warn";
  return "ok";
}

export default function Sales() {
  const [activeBranchId, setActiveBranchId] = useState(() => getActiveBranchId(null));
  const [days, setDays] = useState("30");
  const [paymentMethod, setPaymentMethod] = useState("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [salesRows, setSalesRows] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => onActiveBranchChange((nextBranchId) => setActiveBranchId(nextBranchId)), []);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 280);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const loadSales = async () => {
    setLoading(true);
    setMessage("");
    try {
      const params = {
        days: Number(days) || 30,
        limit: 300,
        offset: 0,
        branch_id: activeBranchId || undefined,
        payment_method: paymentMethod === "ALL" ? undefined : paymentMethod,
        search: search || undefined,
      };
      const { data } = await api.get("/admin/sales", { params });
      setSalesRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load sales ledger:", err);
      setSalesRows([]);
      setMessage(err?.response?.data?.message || "Failed to load sales records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranchId, days, paymentMethod, search]);

  const summary = useMemo(() => {
    return salesRows.reduce(
      (acc, row) => {
        acc.invoiceCount += 1;
        acc.totalSales += Number(row.total || 0);
        acc.totalDiscount += Number(row.discount_amount || 0);
        acc.loyaltyRedeemed += Number(row.loyalty_points_redeemed || 0);
        return acc;
      },
      {
        invoiceCount: 0,
        totalSales: 0,
        totalDiscount: 0,
        loyaltyRedeemed: 0,
      }
    );
  }, [salesRows]);

  return (
    <div className="cv-page cv-page--sales p-4 md:p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="cv-page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="cv-page-title text-2xl font-bold text-gray-900">Sales</h1>
            <p className="cv-page-subtitle text-sm text-gray-600 mt-1">
              Invoice ledger with customer, item, payment, discount, and loyalty details
            </p>
          </div>
          <button
            type="button"
            onClick={loadSales}
            className="cv-acid-btn px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Refresh Ledger
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold tracking-wide text-gray-600 uppercase mb-2">
              Range
            </label>
            <select
              value={days}
              onChange={(event) => setDays(event.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last 365 days</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold tracking-wide text-gray-600 uppercase mb-2">
              Payment
            </label>
            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300"
            >
              <option value="ALL">All methods</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="QR">QR</option>
              <option value="ONLINE">Online</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold tracking-wide text-gray-600 uppercase mb-2">
              Search
            </label>
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300"
              placeholder="Invoice, customer, or mobile"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="cv-sales-summary-card cv-sales-summary-card--invoices">
            <div className="cv-sales-summary-label">Invoices</div>
            <div className="cv-sales-summary-value">{summary.invoiceCount}</div>
          </div>
          <div className="cv-sales-summary-card cv-sales-summary-card--sales">
            <div className="cv-sales-summary-label">Total Sales</div>
            <div className="cv-sales-summary-value">{toMoney(summary.totalSales)}</div>
          </div>
          <div className="cv-sales-summary-card cv-sales-summary-card--discount">
            <div className="cv-sales-summary-label">Discount Value</div>
            <div className="cv-sales-summary-value">{toMoney(summary.totalDiscount)}</div>
          </div>
          <div className="cv-sales-summary-card cv-sales-summary-card--loyalty">
            <div className="cv-sales-summary-label">Loyalty Redeemed</div>
            <div className="cv-sales-summary-value">{summary.loyaltyRedeemed} pts</div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">Invoice No</th>
                <th className="px-4 py-3 text-left">Date & Time</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Mobile</th>
                <th className="px-4 py-3 text-left">Purchase Items</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-left">Payment</th>
                <th className="px-4 py-3 text-right">Discount</th>
                <th className="px-4 py-3 text-right">Loyalty</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-gray-500">
                    Loading sales ledger...
                  </td>
                </tr>
              ) : salesRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-gray-500">
                    No sales found for the selected filters
                  </td>
                </tr>
              ) : (
                salesRows.map((row) => {
                  const items = Array.isArray(row.items) ? row.items : [];
                  return (
                    <tr key={row.id} className="border-t">
                      <td className="px-4 py-3">
                        <span className="cv-sales-invoice-chip">{row.invoice_number || "-"}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{toDateTime(row.created_at)}</td>
                      <td className="px-4 py-3">{row.customer_name || "Walk-in Customer"}</td>
                      <td className="px-4 py-3">{row.customer_phone || "-"}</td>
                      <td className="px-4 py-3">
                        <div className="cv-sales-items-cell">
                          {items.length === 0 ? (
                            <span className="text-gray-500">No items</span>
                          ) : (
                            <>
                              {items.slice(0, 2).map((item, index) => (
                                <div key={`${row.id}-item-${index}`} className="cv-sales-item-row">
                                  <span className="cv-sales-item-name">
                                    {item.name || `Item ${item.product_id || ""}`}
                                  </span>
                                  <span className="cv-sales-item-meta">
                                    x{Number(item.qty || 0)} | {toMoney(item.line_total)}
                                  </span>
                                </div>
                              ))}
                              {items.length > 2 && (
                                <span className="cv-sales-item-more">+{items.length - 2} more items</span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{toMoney(row.total)}</td>
                      <td className="px-4 py-3">
                        <span className="cv-sales-payment-chip">{row.payment_method || "OTHER"}</span>
                      </td>
                      <td className="px-4 py-3 text-right">{toMoney(row.discount_amount)}</td>
                      <td className="px-4 py-3 text-right">
                        {Number(row.loyalty_points_redeemed || 0)} pts
                      </td>
                      <td className="px-4 py-3">
                        <span className={`cv-sales-status-chip tone-${getStatusTone(row.status)}`}>
                          {row.status || "COMPLETED"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {message && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg text-sm shadow-lg">
          {message}
        </div>
      )}
    </div>
  );
}

