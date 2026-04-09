export const salesForecastData = [
  { day: "Mon", actual: 420, predicted: 400, lower: 360, upper: 440 },
  { day: "Tue", actual: 380, predicted: 390, lower: 350, upper: 430 },
  { day: "Wed", actual: 450, predicted: 430, lower: 390, upper: 470 },
  { day: "Thu", actual: 470, predicted: 460, lower: 420, upper: 500 },
  { day: "Fri", actual: 520, predicted: 510, lower: 470, upper: 550 },
  { day: "Sat", actual: 680, predicted: 650, lower: 600, upper: 700 },
  { day: "Sun", actual: null, predicted: 580, lower: 530, upper: 630 },
];

export const categoryDemandData = [
  { category: "Groceries", demand: 3200, fill: "#6366f1" },
  { category: "Dairy", demand: 2100, fill: "#a855f7" },
  { category: "Beverages", demand: 1800, fill: "#ec4899" },
  { category: "Snacks", demand: 1500, fill: "#f59e0b" },
  { category: "Personal Care", demand: 1200, fill: "#22c55e" },
  { category: "Household", demand: 900, fill: "#06b6d4" },
];

export const inventoryData = [
  {
    id: 1, product: "Tata Salt 1kg", sku: "TS-001", category: "Groceries",
    currentStock: 250, recommendedStock: 300, dailyDemand: 45, daysOfStock: 5.6,
    status: "optimal" as const, trend: "stable" as const,
  },
  {
    id: 2, product: "Amul Butter 500g", sku: "AB-002", category: "Dairy",
    currentStock: 40, recommendedStock: 120, dailyDemand: 25, daysOfStock: 1.6,
    status: "critical" as const, trend: "rising" as const,
  },
  {
    id: 3, product: "Coca Cola 2L", sku: "CC-003", category: "Beverages",
    currentStock: 180, recommendedStock: 200, dailyDemand: 30, daysOfStock: 6.0,
    status: "optimal" as const, trend: "stable" as const,
  },
  {
    id: 4, product: "Lays Classic 150g", sku: "LC-004", category: "Snacks",
    currentStock: 60, recommendedStock: 150, dailyDemand: 35, daysOfStock: 1.7,
    status: "low" as const, trend: "rising" as const,
  },
  {
    id: 5, product: "Surf Excel 1kg", sku: "SE-005", category: "Household",
    currentStock: 90, recommendedStock: 80, dailyDemand: 12, daysOfStock: 7.5,
    status: "overstock" as const, trend: "falling" as const,
  },
  {
    id: 6, product: "Parle-G 800g", sku: "PG-006", category: "Snacks",
    currentStock: 200, recommendedStock: 180, dailyDemand: 28, daysOfStock: 7.1,
    status: "optimal" as const, trend: "stable" as const,
  },
  {
    id: 7, product: "Dove Soap 100g", sku: "DS-007", category: "Personal Care",
    currentStock: 30, recommendedStock: 100, dailyDemand: 20, daysOfStock: 1.5,
    status: "critical" as const, trend: "rising" as const,
  },
  {
    id: 8, product: "Maggi Noodles 280g", sku: "MN-008", category: "Groceries",
    currentStock: 320, recommendedStock: 250, dailyDemand: 40, daysOfStock: 8.0,
    status: "overstock" as const, trend: "falling" as const,
  },
];

export const alertsData = [
  {
    id: 1, type: "stockout" as const, severity: "critical" as const,
    product: "Amul Butter 500g",
    message: "Stockout risk in 1.6 days — demand surge due to upcoming festival",
    recommendation: "Order 80 units immediately. Expected delivery: 1 day.",
    timestamp: "10 min ago",
    factors: ["Diwali festival", "Temperature rise", "Weekend approaching"],
  },
  {
    id: 2, type: "stockout" as const, severity: "critical" as const,
    product: "Dove Soap 100g",
    message: "Stock will run out in 1.5 days — promotional campaign driving demand",
    recommendation: "Order 70 units. Consider bulk discount from supplier.",
    timestamp: "25 min ago",
    factors: ["Active promotion", "Seasonal demand"],
  },
  {
    id: 3, type: "low_stock" as const, severity: "warning" as const,
    product: "Lays Classic 150g",
    message: "Stock below recommended levels — 1.7 days of inventory remaining",
    recommendation: "Order 90 units within 24 hours to prevent stockout.",
    timestamp: "1 hour ago",
    factors: ["Weekend approaching", "Cricket match day"],
  },
  {
    id: 4, type: "overstock" as const, severity: "info" as const,
    product: "Maggi Noodles 280g",
    message: "Overstock detected — 28% above recommended level",
    recommendation: "Consider running a promotional offer to reduce excess inventory.",
    timestamp: "2 hours ago",
    factors: ["Demand declined", "Competitor promotion active"],
  },
  {
    id: 5, type: "demand_spike" as const, severity: "warning" as const,
    product: "Coca Cola 2L",
    message: "Predicted 40% demand spike this weekend due to heatwave forecast",
    recommendation: "Pre-order additional 60 units for Saturday-Sunday.",
    timestamp: "3 hours ago",
    factors: ["Heatwave forecast", "Weekend", "IPL match"],
  },
];

export const weatherData = {
  current: "Partly Cloudy", temperature: 34, humidity: 65,
  forecast: "Heatwave expected this weekend",
  impact: "Expect 30-40% increase in beverage demand",
};

export const upcomingEvents = [
  { name: "Diwali", daysAway: 3, expectedImpact: "+45% demand" },
  { name: "IPL Final", daysAway: 5, expectedImpact: "+30% snacks & beverages" },
  { name: "Weekend Sale", daysAway: 2, expectedImpact: "+25% overall" },
];
