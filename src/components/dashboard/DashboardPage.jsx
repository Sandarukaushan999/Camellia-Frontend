import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../state/AuthContext.jsx";
import api from "../../utils/api.js";
import KpiCards from "./KpiCards.jsx";
import SalesChartCard from "./SalesChartCard.jsx";
import OrderBreakdownCard from "./OrderBreakdownCard.jsx";
import TopSellingItemsCard from "./TopSellingItemsCard.jsx";
import ItemSalesMonthChartCard from "./ItemSalesMonthChartCard.jsx";
import RecentActivityCard from "./RecentActivityCard.jsx";
import InventoryAlertsCard from "./InventoryAlertsCard.jsx";
import QuickActionsCard from "./QuickActionsCard.jsx";
import { FadeInItem, FadeInStagger } from "./primitives/FadeIn.jsx";
import { getActiveBranchId, onActiveBranchChange } from "../../utils/branchContext.js";
import {
  formatBusinessDate,
  formatBusinessTime,
  toBusinessDateKey,
} from "../../utils/timezone.js";
import "./dashboard.css";

const PERIOD_OPTIONS = [
  {
    value: "daily",
    label: "Daily",
    days: 1,
    kpiLabel: "Today's Sales",
    comparisonCaption: "Compared with yesterday",
  },
  {
    value: "seven_days",
    label: "7 Days",
    days: 7,
    kpiLabel: "Last 7 Days Sales",
    comparisonCaption: "Compared with previous 7 days",
  },
  {
    value: "monthly",
    label: "Monthly",
    days: 30,
    kpiLabel: "Monthly Sales",
    comparisonCaption: "Compared with previous 30 days",
  },
  {
    value: "yearly",
    label: "Yearly",
    days: 365,
    kpiLabel: "Yearly Sales",
    comparisonCaption: "Compared with previous 365 days",
  },
];

const PERIOD_DAYS = PERIOD_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.days;
  return acc;
}, {});

function getPeriodMeta(value) {
  return PERIOD_OPTIONS.find((option) => option.value === value) || PERIOD_OPTIONS[0];
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const toDateKey = (value) => {
  const raw = String(value || "").trim();
  if (DATE_ONLY_PATTERN.test(raw)) {
    return raw;
  }
  const businessKey = toBusinessDateKey(value);
  if (businessKey) {
    return businessKey;
  }
  return raw.slice(0, 10);
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeStats = (stats) => ({
  todaySales: toNumber(stats?.todaySales ?? stats?.salesTotal),
  totalOrders: toNumber(stats?.totalOrders),
  avgOrderValue: toNumber(stats?.avgOrderValue),
  netProfit: toNumber(stats?.netProfit),
  activeOrders: toNumber(stats?.activeOrders),
  salesChange: toNumber(stats?.salesChange),
  periodDays: toNumber(stats?.periodDays) || 1,
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

const normalizeItemSales = (items) =>
  Array.isArray(items)
    ? items.map((item) => ({
        name: String(item?.name || "Unnamed"),
        qty: toNumber(item?.qty),
        revenue: toNumber(item?.revenue),
      }))
    : [];

const normalizeInventoryAlerts = (payload) => {
  const lowStock = Array.isArray(payload?.lowStock) ? payload.lowStock : [];
  const nearExpiry = Array.isArray(payload?.nearExpiry) ? payload.nearExpiry : [];
  const expired = Array.isArray(payload?.expired) ? payload.expired : [];

  const today = new Date();
  const dayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    0,
    0,
    0,
    0
  );

  const toDaysUntil = (dateValue) => {
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    const targetStart = new Date(
      parsed.getFullYear(),
      parsed.getMonth(),
      parsed.getDate(),
      0,
      0,
      0,
      0
    );
    const diffMs = targetStart.getTime() - dayStart.getTime();
    return Math.round(diffMs / (24 * 60 * 60 * 1000));
  };

  const formatStockDetail = (item) => {
    const stock = toNumber(item?.current_stock);
    const minStock = toNumber(item?.min_stock);
    const unit = String(item?.unit || "").trim();
    const remainingText = `${stock.toLocaleString("en-US")} ${unit}`.trim();
    const minText = `${minStock.toLocaleString("en-US")} ${unit}`.trim();
    return `Remaining: ${remainingText}${minStock > 0 ? ` (Min: ${minText})` : ""}`;
  };

  const lowStockAlerts = lowStock.map((item) => {
    const stock = toNumber(item?.current_stock);
    const minStock = toNumber(item?.min_stock);
    const severity =
      stock <= 1 || (minStock > 0 && stock <= minStock * 0.5) ? "critical" : "low";

    return {
      id: `low-${item?.id || item?.name || Math.random()}`,
      category: "Low Stock",
      title: String(item?.name || "Inventory Item"),
      detail: formatStockDetail(item),
      severity,
    };
  });

  const nearExpiryAlerts = nearExpiry.map((item) => {
    const daysUntil = toDaysUntil(item?.expiry_date);
    const detail =
      Number.isFinite(daysUntil) && daysUntil <= 0
        ? "Expires today"
      : daysUntil === 1
        ? "Expires tomorrow"
        : Number.isFinite(daysUntil)
        ? `Expires in ${daysUntil} days`
        : "Near expiry";

    return {
      id: `expiry-${item?.id || item?.name || Math.random()}`,
      category: "Near Expiry",
      title: String(item?.name || "Inventory Item"),
      detail,
      severity: daysUntil !== null && daysUntil <= 1 ? "critical" : "medium",
    };
  });

  const expiredAlerts = expired.map((item) => ({
    id: `expired-${item?.id || item?.name || Math.random()}`,
    category: "Expired",
    title: String(item?.name || "Inventory Item"),
    detail: "Item already expired",
    severity: "critical",
  }));

  return [...expiredAlerts, ...nearExpiryAlerts, ...lowStockAlerts];
};

function formatHourWindow(hour) {
  const toLabel = (value) => {
    const normalized = ((value % 24) + 24) % 24;
    const suffix = normalized >= 12 ? "PM" : "AM";
    const twelve = normalized % 12 || 12;
    return `${twelve} ${suffix}`;
  };
  return `${toLabel(hour)} - ${toLabel(hour + 1)}`;
}

function buildSalesRangeData(rawSeries, period) {
  const totalDays = PERIOD_DAYS[period] || PERIOD_DAYS.monthly;
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
      label: formatBusinessDate(date, {
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
    const hour = Number.parseInt(
      formatBusinessTime(createdAt, {
        hour: "2-digit",
        hourCycle: "h23",
      }),
      10
    );
    if (!Number.isFinite(hour)) {
      return;
    }
    buckets.set(hour, (buckets.get(hour) || 0) + 1);
  });

  return Array.from(buckets.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour, count]) => {
      return {
        label: formatHourWindow(hour),
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
  const [monthlyItemSales, setMonthlyItemSales] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [inventoryAlerts, setInventoryAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [period, setPeriod] = useState("daily");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [newOrderIds, setNewOrderIds] = useState([]);
  const [activeBranchId, setActiveBranchId] = useState(() => getActiveBranchId(null));

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

  useEffect(() => onActiveBranchChange((nextBranchId) => setActiveBranchId(nextBranchId)), []);

  useEffect(() => {
    if (!user?.token) {
      setIsLoading(false);
      return undefined;
    }

    let mounted = true;

    const fetchPrimaryData = async () => {
      const selectedDays = PERIOD_DAYS[period] || 1;
      const branchParams = activeBranchId ? { branch_id: activeBranchId } : {};
      const [statsRes, chartRes] = await Promise.all([
        api.get("/admin/dashboard/stats", {
          params: {
            days: selectedDays,
            ...branchParams,
          },
        }),
        api.get("/admin/dashboard/sales-chart", {
          params: {
            days: selectedDays,
            ...branchParams,
          },
        }),
      ]);

      if (!mounted) {
        return;
      }

      setStats(normalizeStats(statsRes.data));
      setSalesChart(normalizeChartSeries(chartRes.data));
      setLastUpdated(new Date());
      setErrorMessage("");
    };

    const fetchSecondaryData = async () => {
      const selectedDays = PERIOD_DAYS[period] || 1;
      const branchParams = activeBranchId ? { branch_id: activeBranchId } : {};
      const [breakdownRes, itemsRes, monthItemsRes, ordersRes, alertsRes] = await Promise.all([
        api.get("/admin/dashboard/order-breakdown", {
          params: { days: selectedDays, ...branchParams },
        }),
        api.get("/admin/dashboard/top-items", {
          params: { days: selectedDays, ...branchParams },
        }),
        api.get("/admin/dashboard/item-sales-monthly", {
          params: { days: selectedDays, ...branchParams },
        }),
        api.get("/admin/dashboard/recent-orders", {
          params: { days: selectedDays, ...branchParams },
        }),
        api
          .get("/inventory/alerts", {
            params: branchParams,
          })
          .catch((error) => {
            console.error("Dashboard inventory alerts fetch failed:", error);
            return { data: {} };
          }),
      ]);

      if (!mounted) {
        return;
      }

      setOrderBreakdown(normalizeBreakdown(breakdownRes.data));
      setTopItems(normalizeTopItems(itemsRes.data));
      setMonthlyItemSales(normalizeItemSales(monthItemsRes.data));
      mergeRecentOrders(normalizeRecentOrders(ordersRes.data));
      setInventoryAlerts(normalizeInventoryAlerts(alertsRes.data));
      setErrorMessage("");
    };

    const loadDashboard = async () => {
      try {
        await Promise.all([fetchPrimaryData(), fetchSecondaryData()]);
      } catch (error) {
        console.error("Dashboard load failed:", error);
        if (mounted) {
          setErrorMessage("Live dashboard data is unavailable.");
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
  }, [activeBranchId, mergeRecentOrders, period, user?.token]);

  const replayLoadingState = () => {
    setIsLoadingDemo(true);
    if (loadingDemoTimeoutRef.current) {
      clearTimeout(loadingDemoTimeoutRef.current);
    }
    loadingDemoTimeoutRef.current = setTimeout(() => setIsLoadingDemo(false), 1200);
  };

  const effectiveStats = stats || normalizeStats({});
  const effectiveBreakdown = orderBreakdown;
  const effectiveTopItems = topItems;
  const effectiveRecentOrders = recentOrders;
  const effectiveSalesChart = salesChart;
  const effectiveMonthlyItemSales = monthlyItemSales;
  const effectiveInventoryAlerts = inventoryAlerts;

  const salesRangeData = useMemo(
    () => buildSalesRangeData(effectiveSalesChart, period),
    [effectiveSalesChart, period]
  );

  const periodMeta = useMemo(() => getPeriodMeta(period), [period]);

  const peakHours = useMemo(() => {
    const generated = buildPeakHours(effectiveRecentOrders);
    return generated;
  }, [effectiveRecentOrders]);

  const kpis = useMemo(() => {
    const ordersTotal = Math.max(1, effectiveStats.totalOrders);
    const activityRatio = (effectiveStats.activeOrders / ordersTotal) * 100;

    return [
      {
        id: "sales",
        label: periodMeta.kpiLabel,
        value: effectiveStats.todaySales,
        valueType: "currency",
        trend: effectiveStats.salesChange,
        caption: periodMeta.comparisonCaption,
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
        caption: `${effectiveBreakdown.reduce((sum, item) => sum + item.count, 0)} in selected period`,
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
  }, [effectiveBreakdown, effectiveStats, periodMeta]);

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
    <div className="cv-page cv-page--dashboard min-h-full p-3 md:p-4 lg:p-5">
      <div className="mx-auto max-w-7xl space-y-4 lg:space-y-5">
        <header className="cv-page-header flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
          <div>
            <h1 className="cv-page-title flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span className="cv-dashboard-icon-inline">
                <i className="fi-rr-dashboard" aria-hidden="true" />
              </span>
              Operational Dashboard
            </h1>
            <p className="cv-page-subtitle text-sm text-slate-500">
              {periodMeta.label} overview: sales, orders, inventory alerts, and quick actions
            </p>
          </div>
          <div className="cv-dashboard-header-actions flex flex-wrap items-center gap-2">
            <div
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1"
              role="group"
              aria-label="Dashboard period filter"
            >
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPeriod(option.value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    period === option.value
                      ? "cv-acid-btn-soft text-slate-900"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {errorMessage && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
                <span className="cv-dashboard-icon-inline">
                  <i className="fi-rr-triangle-warning" aria-hidden="true" />
                </span>
                {errorMessage}
              </span>
            )}
            <button
              type="button"
              onClick={replayLoadingState}
              className="cv-acid-btn-soft inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2"
            >
              <span className="cv-dashboard-icon-inline">
                <i className="fi-rr-refresh" aria-hidden="true" />
              </span>
              Replay loading state
            </button>
          </div>
        </header>

        <FadeInStagger className="space-y-4 lg:space-y-5">
          <FadeInItem>
            <KpiCards kpis={kpis} loading={cardLoading} formatCurrency={formatCurrency} />
          </FadeInItem>

          <div className="cv-dashboard-grid cv-dashboard-grid--chart grid grid-cols-1 gap-4 items-stretch lg:grid-cols-3">
            <FadeInItem className="h-full lg:col-span-2">
              <SalesChartCard
                data={salesRangeData}
                loading={cardLoading}
                range={period}
                onRangeChange={setPeriod}
                rangeOptions={PERIOD_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                lastUpdated={lastUpdated}
                formatCurrency={formatCurrency}
                title={`${periodMeta.label} Sales Trend`}
              />
            </FadeInItem>
            <FadeInItem className="h-full">
              <OrderBreakdownCard
                loading={cardLoading}
                breakdown={effectiveBreakdown}
                peakHours={peakHours}
                formatCurrency={formatCurrency}
              />
            </FadeInItem>
          </div>

          <div className="cv-dashboard-grid cv-dashboard-grid--equal grid grid-cols-1 gap-4 items-stretch lg:grid-cols-2">
            <FadeInItem className="h-full">
              <div className="grid h-full gap-4">
                <TopSellingItemsCard
                  loading={cardLoading}
                  subtitle={`Best performing products (${periodMeta.label.toLowerCase()})`}
                  items={effectiveTopItems}
                  formatCurrency={formatCurrency}
                />
                <ItemSalesMonthChartCard
                  loading={cardLoading}
                  items={effectiveMonthlyItemSales}
                  formatCurrency={formatCurrency}
                  periodLabel={periodMeta.label}
                />
              </div>
            </FadeInItem>
            <FadeInItem className="h-full">
              <RecentActivityCard
                loading={cardLoading}
                orders={effectiveRecentOrders}
                newOrderIds={newOrderIds}
                formatCurrency={formatCurrency}
                onOrderOpen={(order) => navigate(`/orders/${order.id}`)}
              />
            </FadeInItem>
          </div>

          <div className="cv-dashboard-grid cv-dashboard-grid--equal grid grid-cols-1 gap-4 items-stretch lg:grid-cols-2">
            <FadeInItem className="h-full">
              <InventoryAlertsCard
                loading={cardLoading}
                alerts={effectiveInventoryAlerts}
              />
            </FadeInItem>
            <FadeInItem className="h-full">
              <QuickActionsCard actions={quickActions} />
            </FadeInItem>
          </div>
        </FadeInStagger>
      </div>
    </div>
  );
}
