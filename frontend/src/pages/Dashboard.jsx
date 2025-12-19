import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext.jsx";
import api from "../utils/api.js";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [salesChart, setSalesChart] = useState([]);
  const [orderBreakdown, setOrderBreakdown] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only load data if user is authenticated
    if (!user?.token) {
      setLoading(false);
      return;
    }
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [user]);

  const loadDashboardData = async () => {
    try {
      const [statsRes, chartRes, breakdownRes, itemsRes, ordersRes] = await Promise.all([
        api.get("/admin/dashboard/stats"),
        api.get("/admin/dashboard/sales-chart"),
        api.get("/admin/dashboard/order-breakdown"),
        api.get("/admin/dashboard/top-items"),
        api.get("/admin/dashboard/recent-orders"),
      ]);
      setStats(statsRes.data);
      setSalesChart(chartRes.data);
      setOrderBreakdown(breakdownRes.data);
      setTopItems(itemsRes.data);
      setRecentOrders(ordersRes.data);
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => `Rs. ${parseFloat(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const getMaxChartValue = () => {
    if (salesChart.length === 0) return 100;
    return Math.max(...salesChart.map((d) => d.total), 100);
  };

  const latestChartPoint = salesChart.length > 0 ? salesChart[salesChart.length - 1] : null;

  const formatChartDate = (day) =>
    new Date(day).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600 font-medium">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md">
          <div className="text-red-500 text-center">
            <div className="text-2xl mb-2">⚠️</div>
            <div className="font-semibold">Failed to load dashboard data</div>
            <div className="text-sm text-gray-500 mt-2">Please refresh the page or check your connection</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 p-3 md:p-4 lg:p-5">
      <div className="max-w-7xl mx-auto space-y-4 lg:space-y-5">
        {/* Compact Stat Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 lg:gap-3">
          {/* Today's Sales */}
          <div className="bg-white rounded-md shadow-sm hover:shadow-md transition-all duration-300 p-2.5 border-l-2 border-blue-500 cursor-pointer group">
            <div className="flex items-center justify-between mb-1">
              <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-[10px] font-medium text-gray-500 mb-0.5 leading-tight">Today's Sales</div>
            <div className="text-sm font-bold text-gray-900 mb-0.5 leading-tight">{formatCurrency(stats.todaySales)}</div>
            <div className={`text-[10px] flex items-center font-medium ${stats.salesChange >= 0 ? "text-green-600" : "text-red-600"}`}>
              <span className={`mr-0.5 ${stats.salesChange >= 0 ? "text-green-500" : "text-red-500"}`}>
                {stats.salesChange >= 0 ? "↑" : "↓"}
              </span>
              {Math.abs(stats.salesChange)}%
            </div>
          </div>

          {/* Total Orders */}
          <div className="bg-white rounded-md shadow-sm hover:shadow-md transition-all duration-300 p-2.5 border-l-2 border-green-500 cursor-pointer group">
            <div className="flex items-center justify-between mb-1">
              <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
            <div className="text-[10px] font-medium text-gray-500 mb-0.5 leading-tight">Total Orders</div>
            <div className="text-sm font-bold text-gray-900 mb-0.5 leading-tight">{stats.totalOrders}</div>
            <div className="text-[10px] text-gray-500 leading-tight">
              {orderBreakdown.length > 0 ? (
                <span>Orders today</span>
              ) : (
                <span>No orders</span>
              )}
            </div>
          </div>

          {/* Average Order Value */}
          <div className="bg-white rounded-md shadow-sm hover:shadow-md transition-all duration-300 p-2.5 border-l-2 border-purple-500 cursor-pointer group">
            <div className="flex items-center justify-between mb-1">
              <div className="w-6 h-6 bg-purple-100 rounded flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <div className="text-[10px] font-medium text-gray-500 mb-0.5 leading-tight">Avg Order Value</div>
            <div className="text-sm font-bold text-gray-900 leading-tight">{formatCurrency(stats.avgOrderValue)}</div>
          </div>

          {/* Net Profit */}
          <div className="bg-white rounded-md shadow-sm hover:shadow-md transition-all duration-300 p-2.5 border-l-2 border-yellow-500 cursor-pointer group">
            <div className="flex items-center justify-between mb-1">
              <div className="w-6 h-6 bg-yellow-100 rounded flex items-center justify-center group-hover:bg-yellow-200 transition-colors">
                <svg className="w-3 h-3 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-[10px] font-medium text-gray-500 mb-0.5 leading-tight">Net Profit</div>
            <div className="text-sm font-bold text-gray-900 leading-tight">{formatCurrency(stats.netProfit)}</div>
          </div>

          {/* Active Orders */}
          <div className="bg-white rounded-md shadow-sm hover:shadow-md transition-all duration-300 p-2.5 border-l-2 border-red-500 cursor-pointer group">
            <div className="flex items-center justify-between mb-1">
              <div className="w-6 h-6 bg-red-100 rounded flex items-center justify-center group-hover:bg-red-200 transition-colors">
                <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <div className="text-[10px] font-medium text-gray-500 mb-0.5 leading-tight">Active Orders</div>
            <div className="text-sm font-bold text-gray-900 leading-tight">{stats.activeOrders}</div>
          </div>
        </div>

        {/* Sales Chart & Order Breakdown - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Sales Chart - Takes 2 columns */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-4 md:p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Daily Sales (Last 7 Days)</h2>
              <div className="text-xs text-gray-500">Weekly Overview</div>
            </div>
            <div className="h-56 flex items-end justify-between gap-2">
              {salesChart.length === 0 ? (
                <div className="w-full text-center text-gray-400 py-12">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <div className="text-sm">No sales data available</div>
                </div>
              ) : (
                salesChart.map((day, idx) => {
                  const maxValue = getMaxChartValue();
                  const height = maxValue > 0 ? (day.total / maxValue) * 100 : 0;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center group">
                      <div className="w-full bg-gray-100 rounded-t-md relative h-full flex items-end" style={{ minHeight: "150px" }}>
                        <div
                          className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-md hover:from-blue-700 hover:to-blue-500 transition-all duration-300 shadow-sm hover:shadow-md"
                          style={{ height: `${height}%`, minHeight: height > 0 ? "6px" : "0" }}
                          title={`${new Date(day.day).toLocaleDateString()}: ${formatCurrency(day.total)}`}
                        />
                      </div>
                      <div className="text-xs font-medium text-gray-600 mt-2 text-center">
                        {new Date(day.day).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                      <div className="text-xs font-bold text-gray-900 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatCurrency(day.total)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Order Breakdown - Takes 1 column */}
          <div className="bg-white rounded-xl shadow-lg p-4 md:p-5 border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Order Breakdown</h2>
            {orderBreakdown.length === 0 ? (
              <div className="text-gray-400 text-center py-8">
                <div className="text-sm mb-1">No orders today</div>
                <div className="text-xs">Start processing orders</div>
              </div>
            ) : (
              <div className="space-y-3 mb-4">
                {orderBreakdown.map((item, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-800">{item.type}</span>
                      <span className="text-sm text-gray-600 font-medium">{item.percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 shadow-inner">
                      <div
                        className={`h-2 rounded-full shadow-sm transition-all duration-500 ${
                          idx % 3 === 0 ? "bg-gradient-to-r from-blue-500 to-blue-600" : 
                          idx % 3 === 1 ? "bg-gradient-to-r from-green-500 to-green-600" : 
                          "bg-gradient-to-r from-purple-500 to-purple-600"
                        }`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500">
                      {item.count} orders • {formatCurrency(item.total)}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-xs font-bold text-gray-800 mb-2 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Peak Hours
              </h3>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-gray-700 bg-gray-50 rounded-md px-2 py-1.5">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  <span>12:00 PM – 2:00 PM</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-700 bg-gray-50 rounded-md px-2 py-1.5">
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                  <span>7:00 PM – 9:00 PM</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Items & Recent Orders - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Selling Items */}
          <div className="bg-white rounded-xl shadow-lg p-4 md:p-5 border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Top Selling Items</h2>
            {topItems.length === 0 ? (
              <div className="text-gray-400 text-center py-8">
                <div className="text-sm mb-1">No items sold today</div>
                <div className="text-xs">Items will appear here</div>
              </div>
            ) : (
              <div className="space-y-2">
                {topItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-white rounded-lg hover:shadow-md transition-all duration-300 border border-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-sm shadow-sm ${
                        idx === 0 ? "bg-gradient-to-br from-yellow-400 to-yellow-600" :
                        idx === 1 ? "bg-gradient-to-br from-gray-400 to-gray-600" :
                        idx === 2 ? "bg-gradient-to-br from-orange-400 to-orange-600" :
                        "bg-gradient-to-br from-blue-400 to-blue-600"
                      }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-500">{item.qty} units</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm text-gray-900">{formatCurrency(item.revenue)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Orders */}
          <div className="bg-white rounded-xl shadow-lg p-4 md:p-5 border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h2>
            {recentOrders.length === 0 ? (
              <div className="text-gray-400 text-center py-8">
                <div className="text-sm mb-1">No recent orders</div>
                <div className="text-xs">Orders will appear here</div>
              </div>
            ) : (
              <div className="space-y-2">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="p-3 bg-gradient-to-r from-gray-50 to-white rounded-lg hover:shadow-md transition-all duration-300 cursor-pointer border border-gray-100 hover:border-blue-200 group"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-bold text-sm text-gray-900 group-hover:text-blue-600 transition-colors">#{order.id}</div>
                        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                          <span className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">{order.paymentMethod}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm text-gray-900">{formatCurrency(order.total)}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{formatTime(order.createdAt)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Inventory Alerts & Quick Actions - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Inventory Alerts */}
          <div className="bg-white rounded-xl shadow-lg p-4 md:p-5 border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Inventory & Alerts</h2>
            
            <div className="mb-4">
              <h3 className="text-xs font-bold text-yellow-700 mb-2 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Low Stock Alerts
              </h3>
              <div className="space-y-1.5">
                <div className="p-2.5 bg-yellow-50 border-l-3 border-yellow-500 rounded-md shadow-sm">
                  <div className="text-xs font-medium text-gray-800">Chicken Breast – 3 kg left</div>
                </div>
                <div className="p-2.5 bg-yellow-50 border-l-3 border-yellow-500 rounded-md shadow-sm">
                  <div className="text-xs font-medium text-gray-800">Cheese Slices – 12 units</div>
                </div>
                <div className="p-2.5 bg-red-50 border-l-3 border-red-500 rounded-md shadow-sm">
                  <div className="text-xs font-semibold text-gray-800">Cooking Oil – Critical</div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-orange-700 mb-2 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Near Expiry Items
              </h3>
              <div className="space-y-1.5">
                <div className="p-2.5 bg-orange-50 border-l-3 border-orange-500 rounded-md shadow-sm">
                  <div className="text-xs font-medium text-gray-800">Milk – Expires in 2 days</div>
                </div>
                <div className="p-2.5 bg-orange-50 border-l-3 border-orange-500 rounded-md shadow-sm">
                  <div className="text-xs font-medium text-gray-800">Juice Concentrate – Expires in 1 day</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-lg p-4 md:p-5 border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate("/pos")}
                className="group p-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-300 font-semibold text-sm shadow-md hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <div className="text-xl mb-1">➕</div>
                <div>New Order</div>
              </button>
              <button
                onClick={() => navigate("/products")}
                className="group p-4 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-300 font-semibold text-sm shadow-md hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <div className="text-xl mb-1">➕</div>
                <div>Add Stock</div>
              </button>
              <button
                onClick={() => navigate("/reports")}
                className="group p-4 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-300 font-semibold text-sm shadow-md hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <div className="text-xl mb-1">📊</div>
                <div>View Reports</div>
              </button>
              <button
                onClick={() => navigate("/settings")}
                className="group p-4 bg-gradient-to-br from-gray-500 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-700 transition-all duration-300 font-semibold text-sm shadow-md hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <div className="text-xl mb-1">⚙️</div>
                <div>Settings</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
