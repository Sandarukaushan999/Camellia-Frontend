import React, { useEffect, useMemo, useState } from "react";
import api from "../utils/api.js";

const REPORT_TYPES = [
  { id: "sales", label: "Sales Reports", icon: "📅" },
  { id: "products", label: "Product Reports", icon: "🍔" },
  { id: "profit", label: "Profit & Expense", icon: "💰" },
  { id: "inventory", label: "Inventory Reports", icon: "📦" },
  { id: "payment", label: "Payment Reports", icon: "💳" },
];

export default function Reports() {
  const [activeReport, setActiveReport] = useState("sales");
  const [dateRange, setDateRange] = useState("7"); // days
  const [orderType, setOrderType] = useState("ALL");
  const [paymentMethod, setPaymentMethod] = useState("ALL");
  const [salesData, setSalesData] = useState([]);
  const [productData, setProductData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReportData();
  }, [activeReport, dateRange, orderType, paymentMethod]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      if (activeReport === "sales") {
        const params = new URLSearchParams({
          days: dateRange,
          orderType: orderType,
          paymentMethod: paymentMethod,
        });
        const res = await api.get(`/admin/reports/sales?${params}`);
        setSalesData(res.data || []);
      } else if (activeReport === "products") {
        const res = await api.get("/admin/dashboard/top-items");
        setProductData(res.data || []);
      }
    } catch (err) {
      console.error("Failed to load report data", err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate summary metrics
  const salesSummary = useMemo(() => {
    const totalSales = salesData.reduce((sum, d) => sum + parseFloat(d.total || 0), 0);
    const totalOrders = salesData.length;
    const avgBill = totalOrders > 0 ? totalSales / totalOrders : 0;
    return {
      totalSales: totalSales.toFixed(2),
      totalOrders,
      avgBill: avgBill.toFixed(2),
    };
  }, [salesData]);

  // Calculate date range
  const getDateRangeLabel = () => {
    const days = parseInt(dateRange);
    if (days === 7) return "Last 7 Days";
    if (days === 30) return "Last 30 Days";
    if (days === 90) return "Last 3 Months";
    return "Custom";
  };

  const formatCurrency = (amount) => {
    return `Rs. ${parseFloat(amount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Export handlers (stubs)
  const handleExportPDF = () => {
    alert("PDF export will be implemented");
  };

  const handleExportExcel = () => {
    alert("Excel export will be implemented");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-sm text-gray-600 mt-1">Business insights and analytics</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportPDF}
              className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors flex items-center gap-1.5"
            >
              <span className="text-base">📄</span> PDF
            </button>
            <button
              onClick={handleExportExcel}
              className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-1.5"
            >
              <span className="text-base">📊</span> Excel
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors flex items-center gap-1.5"
            >
              <span className="text-base">🖨</span> Print
            </button>
          </div>
        </div>

        {/* Report Type Selector */}
        <div className="bg-white rounded-xl shadow-md p-2 mb-6 border border-gray-200">
          <div className="flex flex-wrap gap-2">
            {REPORT_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setActiveReport(type.id)}
                className={`flex-1 min-w-[140px] px-3 py-2.5 rounded-lg font-medium text-sm transition-all ${
                  activeReport === type.id
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <span className="mr-1.5 text-base">{type.icon}</span>
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 3 Months</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Order Type</label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Types</option>
                <option value="DINE-IN">Dine-In</option>
                <option value="TAKEAWAY">Takeaway</option>
                <option value="DELIVERY">Delivery</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Methods</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="QR">QR</option>
              </select>
            </div>
          </div>
        </div>

        {/* Report Content */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <div className="text-gray-600">Loading report data...</div>
          </div>
        ) : (
          <>
            {/* Sales Reports */}
            {activeReport === "sales" && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Total Sales</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatCurrency(salesSummary.totalSales)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{getDateRangeLabel()}</div>
                  </div>
                  <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Total Orders</div>
                    <div className="text-2xl font-bold text-gray-900">{salesSummary.totalOrders}</div>
                    <div className="text-xs text-gray-500 mt-1">Orders processed</div>
                  </div>
                  <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Average Bill</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatCurrency(salesSummary.avgBill)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Per order</div>
                  </div>
                </div>

                {/* Daily Sales Chart */}
                <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Daily Sales Trend</h2>
                  <div className="h-64 flex items-end justify-between gap-2">
                    {salesData.length === 0 ? (
                      <div className="w-full text-center text-gray-400 py-12">No data available</div>
                    ) : (
                      salesData.map((day, idx) => {
                        const maxValue = Math.max(...salesData.map((d) => parseFloat(d.total || 0)), 100);
                        const height = maxValue > 0 ? (parseFloat(day.total || 0) / maxValue) * 100 : 0;
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center group">
                            <div className="w-full bg-gray-100 rounded-t-md relative h-full flex items-end" style={{ minHeight: "150px" }}>
                              <div
                                className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-md hover:from-blue-700 hover:to-blue-500 transition-all duration-300"
                                style={{ height: `${height}%`, minHeight: height > 0 ? "4px" : "0" }}
                                title={`${day.day}: ${formatCurrency(day.total)}`}
                              />
                            </div>
                            <div className="text-xs font-medium text-gray-600 mt-2 text-center">
                              {new Date(day.day).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Order Type Breakdown */}
                <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Order Type Breakdown</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-xl font-bold text-blue-600">65%</div>
                      <div className="text-xs text-gray-600 mt-1">Dine-In</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-xl font-bold text-green-600">25%</div>
                      <div className="text-xs text-gray-600 mt-1">Takeaway</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="text-xl font-bold text-purple-600">10%</div>
                      <div className="text-xs text-gray-600 mt-1">Delivery</div>
                    </div>
                  </div>
                </div>

                {/* Detailed Sales Table */}
                <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900">Detailed Sales</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Order ID</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Type</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Payment</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {salesData.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="px-6 py-8 text-center text-gray-400">
                              No sales data available
                            </td>
                          </tr>
                        ) : (
                          salesData.slice(0, 20).map((sale, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm text-gray-900">{sale.day}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">#{idx + 1000}</td>
                              <td className="px-6 py-4 text-sm">
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">DINE-IN</span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">CASH</td>
                              <td className="px-6 py-4 text-sm font-semibold text-right">{formatCurrency(sale.total)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Product Reports */}
            {activeReport === "products" && (
              <div className="space-y-6">
                {/* Top Selling Items */}
                <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Top Selling Items</h2>
                  <div className="space-y-3">
                    {productData.length === 0 ? (
                      <div className="text-center text-gray-400 py-8">No product data available</div>
                    ) : (
                      productData.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
                              {idx + 1}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{item.name}</div>
                              <div className="text-sm text-gray-500">{item.qty} orders</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-gray-900">{formatCurrency(item.revenue)}</div>
                            <div className="text-xs text-gray-500">Revenue</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Category-wise Sales */}
                <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Category-wise Sales</h2>
                  <div className="space-y-3">
                    {[
                      { category: "Burger", sales: 420000 },
                      { category: "Kottu", sales: 380000 },
                      { category: "Juice", sales: 220000 },
                      { category: "Café", sales: 180000 },
                      { category: "Rice", sales: 150000 },
                    ].map((cat, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium text-gray-900">{cat.category}</span>
                        <span className="font-bold text-gray-900">{formatCurrency(cat.sales)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Profit & Expense Reports */}
            {activeReport === "profit" && (
              <div className="space-y-6">
                {/* Expense Summary */}
                <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Expense Summary</h2>
                  <div className="space-y-3">
                    {[
                      { item: "Gas", amount: 45000 },
                      { item: "Electricity", amount: 38000 },
                      { item: "Ingredients", amount: 420000 },
                      { item: "Staff Salary", amount: 310000 },
                    ].map((exp, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium text-gray-900">{exp.item}</span>
                        <span className="font-bold text-red-600">{formatCurrency(exp.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Profit Calculation */}
                <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Profit Calculation</h2>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                      <span className="font-semibold text-gray-900">Total Sales</span>
                      <span className="text-xl font-bold text-blue-600">{formatCurrency(1245000)}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-red-50 rounded-lg">
                      <span className="font-semibold text-gray-900">Total Expenses</span>
                      <span className="text-xl font-bold text-red-600">{formatCurrency(813000)}</span>
                    </div>
                    <div className="border-t-2 border-gray-300 pt-4">
                      <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                        <span className="text-base font-bold text-gray-900">Net Profit</span>
                        <span className="text-xl font-bold text-green-600">{formatCurrency(432000)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Inventory Reports */}
            {activeReport === "inventory" && (
              <div className="space-y-6">
                {/* Stock Movement */}
                <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900">Stock Movement</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Item</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Opening</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Used</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Closing</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {[
                          { item: "Chicken", opening: "50 kg", used: "32 kg", closing: "18 kg" },
                          { item: "Rice", opening: "100 kg", used: "45 kg", closing: "55 kg" },
                          { item: "Cheese", opening: "20 units", used: "12 units", closing: "8 units" },
                        ].map((stock, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-6 py-4 font-medium text-gray-900">{stock.item}</td>
                            <td className="px-6 py-4 text-gray-600">{stock.opening}</td>
                            <td className="px-6 py-4 text-gray-600">{stock.used}</td>
                            <td className="px-6 py-4 font-semibold text-gray-900">{stock.closing}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Wastage Report */}
                <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Wastage / Expiry Report</h2>
                  <div className="space-y-3">
                    <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
                      <div className="font-semibold text-gray-900">Milk – Expired</div>
                      <div className="text-sm text-red-600 mt-1">Rs. 4,500 loss</div>
                    </div>
                    <div className="p-4 bg-orange-50 border-l-4 border-orange-500 rounded-lg">
                      <div className="font-semibold text-gray-900">Juice Concentrate – Near Expiry</div>
                      <div className="text-sm text-orange-600 mt-1">Expires in 2 days</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Reports */}
            {activeReport === "payment" && (
              <div className="space-y-6">
                {/* Payment Method Breakdown */}
                <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Payment Method Breakdown</h2>
                  <div className="space-y-4">
                    {[
                      { method: "Cash", percentage: 65, amount: 809250 },
                      { method: "Card", percentage: 20, amount: 249000 },
                      { method: "QR", percentage: 15, amount: 186750 },
                    ].map((pay, idx) => (
                      <div key={idx}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium text-gray-900">{pay.method}</span>
                          <span className="text-sm text-gray-600">{pay.percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className={`h-3 rounded-full ${
                              idx === 0 ? "bg-green-500" : idx === 1 ? "bg-blue-500" : "bg-purple-500"
                            }`}
                            style={{ width: `${pay.percentage}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{formatCurrency(pay.amount)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
