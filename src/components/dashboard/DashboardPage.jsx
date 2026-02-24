import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../state/AuthContext.jsx";
import api from "../../utils/api.js";
import KpiCards from "./KpiCards.jsx";
import SalesChartCard from "./SalesChartCard.jsx";
import OrderBreakdownCard from "./OrderBreakdownCard.jsx";
import TopSellingItemsCard from "./TopSellingItemsCard.jsx";
import RecentActivityCard from "./RecentActivityCard.jsx";
import InventoryAlertsCard from "./InventoryAlertsCard.jsx";
import QuickActionsCard from "./QuickActionsCard.jsx";
import { dashboardMockData } from "./dashboardMockData.js";
import { FadeInItem, FadeInStagger } from "./primitives/FadeIn.jsx";
import "./dashboard.css";

const RANGE_DAYS = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const toDateKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value || "").slice(0, 10);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeStats = (stats) => ({
  todaySales: toNumber(stats?.todaySales),
  totalOrders: toNumber(stats?.totalOrders),
  avgOrderValue: toNumber(stats?.avgOrderValue),
  netProfit: toNumber(stats?.netProfit),
  activeOrders: toNumber(stats?.activeOrders),
  salesChange: toNumber(stats?.salesChange),
});

const normalizeChartSeries = (series) =>
  Array.isArray(series)
    ? series.map((point) => ({
        day: String(point?.day || ""),
        total: toNumber(point?.total),
      }))
    : [];

const normalizeBreakdown = (breakdown) =>
  Array.isArray(breakdown)
    ? breakdown.map((item) => ({
        type: String(item?.type || "UNKNOWN"),
        count: toNumber(item?.count),
        percentage: toNumber(item?.percentage),
        total: toNumber(item?.total),
      }))
    : [];

const normalizeTopItems = (items) =>
  Array.isArray(items)
    ? items.map((item) => ({
        name: String(item?.name || "Unnamed"),
        qty: toNumber(item?.qty),
        revenue: toNumber(item?.revenue),
      }))
    : [];

const normalizeRecentOrders = (orders) =>
  Array.isArray(orders)
    ? orders.map((order) => ({
        id: order?.id,
        paymentMethod: String(order?.paymentMethod || "UNKNOWN"),
        total: toNumber(order?.total),
        createdAt: order?.createdAt,
      }))
    : [];

function buildSalesRangeData(rawSeries, range) {
  const totalDays = RANGE_DAYS[range] || RANGE_DAYS["30d"];
  const today = new Date();

  const totalsByDay = new Map(
    rawSeries.map((item) => [toDateKey(item.day), toNumber(item.total)])
  );

  return Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (totalDays - index - 1));
    const key = toDateKey(date);
    return {
      day: key,
      label: date.toLocaleDateString("en-US", {
        month: totalDays > 31 ? "short" : undefined,
        day: "numeric",
      }),
      total: totalsByDay.get(key) || 0,
    };
  });
}

function buildPeakHours(orders) {
  const buckets = new Map();

  orders.forEach((order) => {
    const createdAt = new Date(order.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      return;
    }
    const hour = createdAt.getHours();
    buckets.set(hour, (buckets.get(hour) || 0) + 1);
  });

  return Array.from(buckets.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour, count]) => {
      const start = new Date();
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start);
      end.setHours(hour + 1);

      return {
        label: `${start.toLocaleTimeString("en-US", { hour: "numeric" })} - ${end.toLocaleTimeString(
          "en-US",
          { hour: "numeric" }
        )}`,
        count,
      };
    });
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [stats, setStats] = useState(null);
  const [salesChart, setSalesChart] = useState([]);
  const [orderBreakdown, setOrderBreakdown] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [range, setRange] = useState("30d");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [usingMockData, setUsingMockData] = useState(false);
  const [newOrderIds, setNewOrderIds] = useState([]);

  const newOrderTimeoutRef = useRef(null);
  const loadingDemoTimeoutRef = useRef(null);

  const formatCurrency = useCallback(
    (amount) =>
      `Rs. ${toNumber(amount).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    []
  );

  const mergeRecentOrders = useCallback((nextOrders) => {
    setRecentOrders((previousOrders) => {
      const previousIds = new Set(previousOrders.map((order) => order.id));
      const newlyAdded = nextOrders
        .filter((order) => !previousIds.has(order.id))
        .map((order) => order.id);

      if (newlyAdded.length > 0 && previousOrders.length > 0) {
        setNewOrderIds(newlyAdded);
        if (newOrderTimeoutRef.current) {
          clearTimeout(newOrderTimeoutRef.current);
        }
        newOrderTimeoutRef.current = setTimeout(() => setNewOrderIds([]), 3000);
      }

      return nextOrders;
    });
  }, []);

  useEffect(() => {
    if (!user?.token) {
      setIsLoading(false);
      return undefined;
    }

    let mounted = true;

    const applyMockFallback = () => {
      setStats((prev) => prev || normalizeStats(dashboardMockData.stats));
      setSalesChart((prev) =>
        prev.length > 0 ? prev : normalizeChartSeries(dashboardMockData.salesChart)
      );
      setOrderBreakdown((prev) =>
        prev.length > 0 ? prev : normalizeBreakdown(dashboardMockData.orderBreakdown)
      );
      setTopItems((prev) => (prev.length > 0 ? prev : normalizeTopItems(dashboardMockData.topItems)));
      setRecentOrders((prev) =>
        prev.length > 0 ? prev : normalizeRecentOrders(dashboardMockData.recentOrders)
      );
      setUsingMockData(true);
    };

    const fetchPrimaryData = async () => {
      const [statsRes, chartRes] = await Promise.all([
        api.get("/admin/dashboard/stats"),
        api.get("/admin/dashboard/sales-chart", { params: { days: 90 } }),
      ]);

      if (!mounted) {
        return;
      }

      setStats(normalizeStats(statsRes.data));
      setSalesChart(normalizeChartSeries(chartRes.data));
      setLastUpdated(new Date());
      setUsingMockData(false);
      setErrorMessage("");
    };

    const fetchSecondaryData = async () => {
      const [breakdownRes, itemsRes, ordersRes] = await Promise.all([
        api.get("/admin/dashboard/order-breakdown"),
        api.get("/admin/dashboard/top-items"),
        api.get("/admin/dashboard/recent-orders"),
      ]);

      if (!mounted) {
        return;
      }

      setOrderBreakdown(normalizeBreakdown(breakdownRes.data));
      setTopItems(normalizeTopItems(itemsRes.data));
      mergeRecentOrders(normalizeRecentOrders(ordersRes.data));
      setErrorMessage("");
    };

    const loadDashboard = async () => {
      try {
        await Promise.all([fetchPrimaryData(), fetchSecondaryData()]);
      } catch (error) {
        console.error("Dashboard load failed:", error);
        if (mounted) {
          setErrorMessage("Live dashboard data is unavailable. Showing sample data.");
          applyMockFallback();
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadDashboard();

    const primaryInterval = setInterval(async () => {
      try {
        await fetchPrimaryData();
      } catch (error) {
        console.error("Primary dashboard refresh failed:", error);
      }
    }, 15000);

    const secondaryInterval = setInterval(async () => {
      try {
        await fetchSecondaryData();
      } catch (error) {
        console.error("Secondary dashboard refresh failed:", error);
      }
    }, 30000);

    return () => {
      mounted = false;
      clearInterval(primaryInterval);
      clearInterval(secondaryInterval);
      if (newOrderTimeoutRef.current) {
        clearTimeout(newOrderTimeoutRef.current);
      }
      if (loadingDemoTimeoutRef.current) {
        clearTimeout(loadingDemoTimeoutRef.current);
      }
    };
  }, [mergeRecentOrders, user?.token]);

  const replayLoadingState = () => {
    setIsLoadingDemo(true);
    if (loadingDemoTimeoutRef.current) {
      clearTimeout(loadingDemoTimeoutRef.current);
    }
    loadingDemoTimeoutRef.current = setTimeout(() => setIsLoadingDemo(false), 1200);
  };

  const effectiveStats = stats || normalizeStats(dashboardMockData.stats);
  const effectiveBreakdown =
    orderBreakdown.length > 0 ? orderBreakdown : normalizeBreakdown(dashboardMockData.orderBreakdown);
  const effectiveTopItems = topItems.length > 0 ? topItems : normalizeTopItems(dashboardMockData.topItems);
  const effectiveRecentOrders =
    recentOrders.length > 0 ? recentOrders : normalizeRecentOrders(dashboardMockData.recentOrders);
  const effectiveSalesChart =
    salesChart.length > 0 ? salesChart : normalizeChartSeries(dashboardMockData.salesChart);

  const salesRangeData = useMemo(
    () => buildSalesRangeData(effectiveSalesChart, range),
    [effectiveSalesChart, range]
  );

  const peakHours = useMemo(() => {
    const generated = buildPeakHours(effectiveRecentOrders);
    return generated.length > 0 ? generated : dashboardMockData.peakHours;
  }, [effectiveRecentOrders]);

  const kpis = useMemo(() => {
    const ordersTotal = Math.max(1, effectiveStats.totalOrders);
    const activityRatio = (effectiveStats.activeOrders / ordersTotal) * 100;

    return [
      {
        id: "sales",
        label: "Today's Sales",
        value: effectiveStats.todaySales,
        valueType: "currency",
        trend: effectiveStats.salesChange,
        caption: "Compared with yesterday",
        iconBgClass: "bg-blue-100",
        iconClass: "text-blue-600",
        glowClass: "from-blue-200 to-blue-100",
      },
      {
        id: "orders",
        label: "Total Orders",
        value: effectiveStats.totalOrders,
        valueType: "number",
        trend: effectiveStats.salesChange * 0.6,
        caption: `${effectiveBreakdown.reduce((sum, item) => sum + item.count, 0)} in current range`,
        iconBgClass: "bg-emerald-100",
        iconClass: "text-emerald-600",
        glowClass: "from-emerald-200 to-emerald-100",
      },
      {
        id: "avg",
        label: "Avg Order Value",
        value: effectiveStats.avgOrderValue,
        valueType: "currency",
        trend: effectiveStats.salesChange * 0.45,
        caption: "Average ticket size",
        iconBgClass: "bg-sky-100",
        iconClass: "text-sky-600",
        glowClass: "from-sky-200 to-sky-100",
      },
      {
        id: "profit",
        label: "Net Profit",
        value: effectiveStats.netProfit,
        valueType: "currency",
        trend: effectiveStats.salesChange * 0.55,
        caption: "Estimated margin",
        iconBgClass: "bg-indigo-100",
        iconClass: "text-indigo-600",
        glowClass: "from-indigo-200 to-indigo-100",
      },
      {
        id: "active",
        label: "Active Orders",
        value: effectiveStats.activeOrders,
        valueType: "number",
        trend: activityRatio - 10,
        caption: "In the last 30 minutes",
        iconBgClass: "bg-rose-100",
        iconClass: "text-rose-600",
        glowClass: "from-rose-200 to-rose-100",
      },
    ];
  }, [effectiveBreakdown, effectiveStats]);

  const quickActions = useMemo(
    () => [
      {
        id: "new-order",
        label: "New Order",
        description: "Open POS and start billing",
        icon: "new-order",
        variant: "primary",
        onClick: () => navigate("/pos"),
      },
      {
        id: "add-stock",
        label: "Add Stock",
        description: "Update product inventory",
        icon: "add-stock",
        variant: "secondary",
        onClick: () => navigate("/products"),
      },
      {
        id: "reports",
        label: "View Reports",
        description: "Check sales performance",
        icon: "reports",
        variant: "accent",
        onClick: () => navigate("/reports"),
      },
      {
        id: "settings",
        label: "Settings",
        description: "Manage system preferences",
        icon: "settings",
        variant: "neutral",
        onClick: () => navigate("/settings"),
      },
    ],
    [navigate]
  );

  const cardLoading = isLoading || isLoadingDemo;

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 p-3 md:p-4 lg:p-5">
      <div className="mx-auto max-w-7xl space-y-4 lg:space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Operational Dashboard</h1>
            <p className="text-sm text-slate-500">Sales, orders, inventory alerts, and quick actions</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {usingMockData && (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                Sample data mode
              </span>
            )}
            {errorMessage && (
              <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
                {errorMessage}
              </span>
            )}
            <button
              type="button"
              onClick={replayLoadingState}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-blue-200 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Replay loading state
            </button>
          </div>
        </header>

        <FadeInStagger className="space-y-4 lg:space-y-5">
          <FadeInItem>
            <KpiCards kpis={kpis} loading={cardLoading} formatCurrency={formatCurrency} />
          </FadeInItem>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <FadeInItem className="lg:col-span-2">
              <SalesChartCard
                data={salesRangeData}
                loading={cardLoading}
                range={range}
                onRangeChange={setRange}
                lastUpdated={lastUpdated}
                formatCurrency={formatCurrency}
              />
            </FadeInItem>
            <FadeInItem>
              <OrderBreakdownCard
                loading={cardLoading}
                breakdown={effectiveBreakdown}
                peakHours={peakHours}
                formatCurrency={formatCurrency}
              />
            </FadeInItem>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <FadeInItem>
              <TopSellingItemsCard
                loading={cardLoading}
                items={effectiveTopItems}
                formatCurrency={formatCurrency}
              />
            </FadeInItem>
            <FadeInItem>
              <RecentActivityCard
                loading={cardLoading}
                orders={effectiveRecentOrders}
                newOrderIds={newOrderIds}
                formatCurrency={formatCurrency}
                onOrderOpen={(order) => navigate(`/orders/${order.id}`)}
              />
            </FadeInItem>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <FadeInItem>
              <InventoryAlertsCard
                loading={cardLoading}
                alerts={dashboardMockData.inventoryAlerts}
              />
            </FadeInItem>
            <FadeInItem>
              <QuickActionsCard actions={quickActions} />
            </FadeInItem>
          </div>
        </FadeInStagger>
      </div>
    </div>
  );
}
