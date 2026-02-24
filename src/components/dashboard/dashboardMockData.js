const createMockSalesSeries = (days = 90) => {
  const today = new Date();

  return Array.from({ length: days }, (_, idx) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - idx - 1));

    const trend = 2600 + idx * 5;
    const seasonal = Math.sin(idx / 3.7) * 260;
    const weekendBoost = [0, 6].includes(date.getDay()) ? 350 : 0;

    return {
      day: date.toISOString().slice(0, 10),
      total: Math.max(500, Math.round(trend + seasonal + weekendBoost)),
    };
  });
};

const now = Date.now();
const minutesAgo = (minutes) => new Date(now - minutes * 60 * 1000).toISOString();

export const dashboardMockData = {
  stats: {
    todaySales: 42850.35,
    totalOrders: 83,
    avgOrderValue: 516.27,
    netProfit: 12855.11,
    activeOrders: 9,
    salesChange: 11.8,
  },
  salesChart: createMockSalesSeries(90),
  orderBreakdown: [
    { type: "CASH", count: 47, percentage: 57, total: 23620.0 },
    { type: "CARD", count: 31, percentage: 37, total: 17220.0 },
    { type: "ONLINE", count: 5, percentage: 6, total: 2010.35 },
  ],
  topItems: [
    { name: "Classic Latte", qty: 48, revenue: 12480.0 },
    { name: "Chicken Club Sandwich", qty: 33, revenue: 15840.0 },
    { name: "Iced Mocha", qty: 29, revenue: 7830.0 },
    { name: "Crispy Fries", qty: 27, revenue: 6210.0 },
    { name: "Herb Pasta Bowl", qty: 22, revenue: 9020.0 },
    { name: "Blueberry Muffin", qty: 20, revenue: 4100.0 },
    { name: "Lemon Iced Tea", qty: 19, revenue: 3990.0 },
  ],
  recentOrders: [
    { id: 7643, paymentMethod: "CARD", total: 1430.0, createdAt: minutesAgo(4) },
    { id: 7642, paymentMethod: "CASH", total: 790.0, createdAt: minutesAgo(9) },
    { id: 7641, paymentMethod: "CARD", total: 2180.0, createdAt: minutesAgo(13) },
    { id: 7640, paymentMethod: "CASH", total: 650.0, createdAt: minutesAgo(18) },
    { id: 7639, paymentMethod: "ONLINE", total: 1210.0, createdAt: minutesAgo(22) },
    { id: 7638, paymentMethod: "CARD", total: 980.0, createdAt: minutesAgo(29) },
    { id: 7637, paymentMethod: "CASH", total: 530.0, createdAt: minutesAgo(34) },
  ],
  inventoryAlerts: [
    {
      id: "a1",
      title: "Cooking Oil",
      detail: "Critical: 2 bottles remaining",
      severity: "critical",
      category: "Low Stock",
    },
    {
      id: "a2",
      title: "Chicken Breast",
      detail: "Low stock: 3 kg remaining",
      severity: "low",
      category: "Low Stock",
    },
    {
      id: "a3",
      title: "Milk",
      detail: "Expires in 2 days",
      severity: "medium",
      category: "Near Expiry",
    },
    {
      id: "a4",
      title: "Juice Concentrate",
      detail: "Expires tomorrow",
      severity: "critical",
      category: "Near Expiry",
    },
  ],
  peakHours: [
    { label: "12:00 PM - 2:00 PM", count: 24 },
    { label: "6:00 PM - 8:00 PM", count: 21 },
    { label: "9:00 AM - 10:00 AM", count: 16 },
  ],
};
