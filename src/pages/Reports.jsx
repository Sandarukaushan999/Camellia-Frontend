import React, { useEffect, useMemo, useState } from "react";
import api from "../utils/api.js";

const REPORT_TYPES = [
  { id: "sales", label: "Sales", icon: "📊" },
  { id: "products", label: "Products", icon: "🍔" },
  { id: "profit", label: "Profit & Expenses", icon: "💰" },
  { id: "inventory", label: "Inventory", icon: "📦" },
  { id: "payment", label: "Payments", icon: "💳" },
];

function toMoney(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function toCsv(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return "";
  }
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const raw = String(v ?? "");
    return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

function downloadCsv(fileName, rows) {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [activeReport, setActiveReport] = useState("sales");
  const [dateRange, setDateRange] = useState("30");
  const [orderType, setOrderType] = useState("ALL");
  const [paymentMethod, setPaymentMethod] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [salesData, setSalesData] = useState([]);
  const [salesDetails, setSalesDetails] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState([]);
  const [orderTypeBreakdown, setOrderTypeBreakdown] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [inventoryAlerts, setInventoryAlerts] = useState({
    lowStock: [],
    nearExpiry: [],
    expired: [],
  });

  const params = useMemo(
    () => ({
      days: Number(dateRange) || 30,
      orderType,
      paymentMethod,
    }),
    [dateRange, orderType, paymentMethod]
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [salesRes, detailsRes, itemsRes, payRes, orderTypeRes, expenseRes, alertRes] =
          await Promise.all([
            api.get("/admin/reports/sales", { params }),
            api.get("/admin/reports/sales/details", {
              params: { ...params, limit: 200, offset: 0 },
            }),
            api.get("/admin/dashboard/top-items"),
            api.get("/admin/reports/payment-breakdown", { params }),
            api.get("/admin/reports/order-type-breakdown", { params }),
            api.get("/admin/expenses", { params: { days: params.days, limit: 500 } }),
            api.get("/inventory/alerts"),
          ]);

        setSalesData(Array.isArray(salesRes.data) ? salesRes.data : []);
        setSalesDetails(Array.isArray(detailsRes.data) ? detailsRes.data : []);
        setTopItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);
        setPaymentBreakdown(Array.isArray(payRes.data) ? payRes.data : []);
        setOrderTypeBreakdown(Array.isArray(orderTypeRes.data) ? orderTypeRes.data : []);
        setExpenses(Array.isArray(expenseRes.data) ? expenseRes.data : []);
        setInventoryAlerts(alertRes.data || { lowStock: [], nearExpiry: [], expired: [] });
      } catch (err) {
        console.error("Failed to load reports", err);
        setMessage(err?.response?.data?.message || "Failed to load reports");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [params]);

  const salesSummary = useMemo(() => {
    const netSales = salesDetails.reduce(
      (sum, row) => sum + (Number(row.total || 0) - Number(row.refundedAmount || 0)),
      0
    );
    const orders = salesDetails.length;
    const avg = orders > 0 ? netSales / orders : 0;
    return {
      netSales,
      orders,
      avg,
    };
  }, [salesDetails]);

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0),
    [expenses]
  );

  const estimatedProfit = useMemo(() => salesSummary.netSales - totalExpenses, [salesSummary, totalExpenses]);

  const exportCurrent = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (activeReport === "sales") {
      downloadCsv(`sales-details-${stamp}.csv`, salesDetails);
      return;
    }
    if (activeReport === "products") {
      downloadCsv(`top-products-${stamp}.csv`, topItems);
      return;
    }
    if (activeReport === "profit") {
      downloadCsv(`expenses-${stamp}.csv`, expenses);
      return;
    }
    if (activeReport === "payment") {
      downloadCsv(`payment-breakdown-${stamp}.csv`, paymentBreakdown);
      return;
    }
    const rows = [
      ...(inventoryAlerts.lowStock || []),
      ...(inventoryAlerts.nearExpiry || []),
      ...(inventoryAlerts.expired || []),
    ];
    downloadCsv(`inventory-alerts-${stamp}.csv`, rows);
  };

  return (
    <div className="cv-page cv-page--reports p-4 md:p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="cv-page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="cv-page-title text-2xl font-bold text-gray-900">Reports</h1>
            <p className="cv-page-subtitle text-sm text-gray-600 mt-1">Live operational and financial reporting</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportCurrent}
              className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700"
            >
              Export CSV
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-2 bg-gray-600 text-white rounded-lg text-sm font-semibold hover:bg-gray-700"
            >
              Print
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-2 border border-gray-200">
          <div className="flex flex-wrap gap-2">
            {REPORT_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setActiveReport(type.id)}
                className={`flex-1 min-w-[140px] px-3 py-2.5 rounded-lg text-sm font-medium ${
                  activeReport === type.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <span className="mr-2">{type.icon}</span>
                {type.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="365">Last 365 Days</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Order Type</label>
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="ALL">All Types</option>
              <option value="DINE-IN">Dine-In</option>
              <option value="TAKEAWAY">Takeaway</option>
              <option value="DELIVERY">Delivery</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="ALL">All Methods</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="QR">QR</option>
              <option value="ONLINE">Online</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-600">Loading report data...</div>
        ) : (
          <>
            {activeReport === "sales" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white border rounded-xl p-4">
                    <div className="text-xs text-gray-500">Net Sales</div>
                    <div className="text-2xl font-bold text-gray-900">{toMoney(salesSummary.netSales)}</div>
                  </div>
                  <div className="bg-white border rounded-xl p-4">
                    <div className="text-xs text-gray-500">Orders</div>
                    <div className="text-2xl font-bold text-gray-900">{salesSummary.orders}</div>
                  </div>
                  <div className="bg-white border rounded-xl p-4">
                    <div className="text-xs text-gray-500">Avg Net Ticket</div>
                    <div className="text-2xl font-bold text-gray-900">{toMoney(salesSummary.avg)}</div>
                  </div>
                </div>

                <div className="bg-white border rounded-xl overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left">Order</th>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-left">Payment</th>
                        <th className="px-4 py-3 text-right">Gross</th>
                        <th className="px-4 py-3 text-right">Refunded</th>
                        <th className="px-4 py-3 text-right">Net</th>
                        <th className="px-4 py-3 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesDetails.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No sales records</td>
                        </tr>
                      ) : (
                        salesDetails.map((row) => {
                          const gross = Number(row.total || 0);
                          const refunded = Number(row.refundedAmount || 0);
                          const net = gross - refunded;
                          return (
                            <tr key={row.id} className="border-t">
                              <td className="px-4 py-3">#{row.id}</td>
                              <td className="px-4 py-3">{new Date(row.createdAt).toLocaleString()}</td>
                              <td className="px-4 py-3">{row.orderType || "-"}</td>
                              <td className="px-4 py-3">{row.paymentMethod || "-"}</td>
                              <td className="px-4 py-3 text-right">{toMoney(gross)}</td>
                              <td className="px-4 py-3 text-right">{toMoney(refunded)}</td>
                              <td className="px-4 py-3 text-right font-semibold">{toMoney(net)}</td>
                              <td className="px-4 py-3">{row.status || "COMPLETED"}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeReport === "products" && (
              <div className="bg-white border rounded-xl p-4 space-y-3">
                {topItems.length === 0 ? (
                  <div className="text-sm text-gray-500">No top-item data available</div>
                ) : (
                  topItems.map((item, idx) => (
                    <div key={`${item.name}-${idx}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-semibold text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-600">Qty sold: {item.qty}</div>
                      </div>
                      <div className="font-bold text-gray-900">{toMoney(item.revenue)}</div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeReport === "profit" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white border rounded-xl p-4">
                    <div className="text-xs text-gray-500">Net Sales</div>
                    <div className="text-2xl font-bold text-blue-700">{toMoney(salesSummary.netSales)}</div>
                  </div>
                  <div className="bg-white border rounded-xl p-4">
                    <div className="text-xs text-gray-500">Expenses</div>
                    <div className="text-2xl font-bold text-red-700">{toMoney(totalExpenses)}</div>
                  </div>
                  <div className="bg-white border rounded-xl p-4">
                    <div className="text-xs text-gray-500">Estimated Profit</div>
                    <div className={`text-2xl font-bold ${estimatedProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {toMoney(estimatedProfit)}
                    </div>
                  </div>
                </div>

                <div className="bg-white border rounded-xl overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Category</th>
                        <th className="px-4 py-3 text-left">Description</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-gray-500">No expense records</td>
                        </tr>
                      ) : (
                        expenses.map((exp) => (
                          <tr key={exp.id} className="border-t">
                            <td className="px-4 py-3">{new Date(exp.incurred_at).toLocaleString()}</td>
                            <td className="px-4 py-3">{exp.category}</td>
                            <td className="px-4 py-3">{exp.description || "-"}</td>
                            <td className="px-4 py-3 text-right font-semibold">{toMoney(exp.amount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeReport === "inventory" && (
              <div className="bg-white border rounded-xl p-4 space-y-3">
                {[...(inventoryAlerts.lowStock || []), ...(inventoryAlerts.nearExpiry || []), ...(inventoryAlerts.expired || [])].length === 0 ? (
                  <div className="text-sm text-gray-500">No inventory alerts</div>
                ) : (
                  [...(inventoryAlerts.lowStock || []), ...(inventoryAlerts.nearExpiry || []), ...(inventoryAlerts.expired || [])].map((alert, idx) => (
                    <div key={`${alert.id || idx}`} className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                      <div className="font-semibold text-gray-900">{alert.name}</div>
                      <div className="text-xs text-gray-600 mt-1">{alert.message}</div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeReport === "payment" && (
              <div className="space-y-4">
                <div className="bg-white border rounded-xl p-4 space-y-3">
                  {paymentBreakdown.length === 0 ? (
                    <div className="text-sm text-gray-500">No payment data</div>
                  ) : (
                    paymentBreakdown.map((row) => (
                      <div key={row.method}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-900">{row.method}</span>
                          <span className="text-gray-600">{row.percentage}%</span>
                        </div>
                        <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600" style={{ width: `${Math.min(100, Number(row.percentage || 0))}%` }} />
                        </div>
                        <div className="text-xs text-gray-600 mt-1">{toMoney(row.total)} ({row.count} orders)</div>
                      </div>
                    ))
                  )}
                </div>

                <div className="bg-white border rounded-xl p-4">
                  <div className="text-sm font-semibold text-gray-900 mb-2">Order Type Breakdown</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {orderTypeBreakdown.map((row) => (
                      <div key={row.type} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="font-semibold text-gray-900">{row.type}</div>
                        <div className="text-xs text-gray-600">{row.count} orders</div>
                        <div className="text-xs text-gray-600">{row.percentage}%</div>
                        <div className="text-sm font-bold text-gray-900 mt-1">{toMoney(row.total)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {message && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg text-sm shadow-lg">
          {message}
        </div>
      )}
    </div>
  );
}
