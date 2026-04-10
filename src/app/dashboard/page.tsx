"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from "recharts";
import StatCard from "@/components/StatCard";
import {
  TrendingUp, Package, ShieldCheck, AlertTriangle, Cloud, Calendar,
  Zap, Activity, DollarSign, BarChart3, ArrowUpRight, ArrowDownRight,
  Tag, Radio, Layers, Sun, Snowflake, ThermometerSun, Clock,
  ExternalLink, Megaphone, Newspaper, ShoppingBag, RefreshCw,
  FileDown,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const CAT_COLORS = ["#6366f1", "#a855f7", "#ec4899", "#f59e0b", "#22c55e", "#06b6d4", "#f43f5e", "#8b5cf6"];
const STATUS_COLORS: Record<string, string> = {
  critical: "text-red-500 bg-red-500/10", low: "text-amber-500 bg-amber-500/10",
  overstock: "text-blue-500 bg-blue-500/10", optimal: "text-green-500 bg-green-500/10", ok: "text-green-500 bg-green-500/10",
};

type FilterTab = "recent" | "lowStock" | "highValue" | "topDemand";

export default function DashboardPage() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const [data, setData] = useState<any>(null);
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("topDemand");
  const [promoResults, setPromoResults] = useState<any>(null);
  const [promoCategory, setPromoCategory] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [stockLevels, setStockLevels] = useState<any[]>([]);
  const [stockLoading, setStockLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        try {
          const pos = await new Promise<GeolocationPosition>((r, j) => navigator.geolocation.getCurrentPosition(r, j, { timeout: 8000 }));
          const wRes = await fetch(`/api/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
          if (wRes.ok) setWeather(await wRes.json());
        } catch {}
        const res = await fetch("/api/dashboard", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        });
        const d = await res.json();
        if (!d.error) setData(d);
      } catch {} finally { setLoading(false); }
    })();
  }, [user]);

  // Fetch Groq-powered min/max stock levels after dashboard loads
  useEffect(() => {
    if (!data || !user) return;
    setStockLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/product-stock-levels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        });
        if (res.ok) {
          const d = await res.json();
          if (d.products) setStockLevels(d.products);
        }
      } catch {} finally { setStockLoading(false); }
    })();
  }, [data, user]);

  // Auto-rotate promos through inventory categories every 1 hour
  useEffect(() => {
    if (!data) return;
    const cats: string[] = (data.categoryDemand || []).map((c: any) => c.category).filter(Boolean);
    if (cats.length === 0) return;

    const fetchPromo = async () => {
      const hourIndex = Math.floor(Date.now() / 3600000) % cats.length;
      const cat = cats[hourIndex];
      setPromoCategory(cat);
      setPromoLoading(true);
      try {
        const res = await fetch("/api/search-promos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: cat }),
        });
        if (res.ok) setPromoResults(await res.json());
      } catch {} finally { setPromoLoading(false); }
    };

    fetchPromo();
    const interval = setInterval(fetchPromo, 3600000); // refresh every 1 hour
    return () => clearInterval(interval);
  }, [data]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  const s = data?.stats || {};
  const forecast = data?.salesForecast || [];
  const categories = data?.categoryDemand || [];
  const events = data?.events || [];
  const signals = data?.realtimeSignals || [];
  const recentProducts = data?.recentProducts || [];
  const topDemand = data?.topDemandProducts || [];
  const lowStock = data?.inventoryByLowQty || [];
  const highValue = data?.inventoryByValue || [];
  const weatherImpact = data?.weatherImpact || [];
  const promoImpact = data?.promotionImpact || [];
  const dbWeather = data?.dbWeather || [];
  const matchedStore = data?.matchedStore;
  // Use Groq-powered stock levels (min/max from AI, current from DB)
  const selectedProd = stockLevels.find((p: any) => p.name === selectedProduct);
  const chartData = selectedProd
    ? selectedProd.days.map((d: any) => ({
        day: `${d.day} (${d.date.slice(5)})`,
        predicted: d.predicted,
        recommended: d.recommended,
        minStock: selectedProd.minStock,
        maxStock: selectedProd.maxStock,
        currentStock: selectedProd.currentStock,
      }))
    : forecast;
  const testInputInfo = data?.testInputs || { total: 0, fulfilled: 0, pending: 0 };

  const filterData: Record<FilterTab, any[]> = { topDemand, lowStock, highValue, recent: recentProducts };
  const filterLabels: Record<FilterTab, string> = { topDemand: t("table.topDemand"), lowStock: t("table.lowStock"), highValue: t("table.highValue"), recent: t("table.recentlyAdded") };

  const genTime = data?.generatedAt ? new Date(data.generatedAt) : new Date();
  const timeStr = genTime.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

  const exportPDF = () => {
    const storeName = data?.store?.store_name || "My Store";
    const storeCity = data?.store?.city || "";
    const stockoutProds = data?.stockoutProducts?.filter((p: any) => p.probability > 10) || [];
    const volProds = data?.volatilityProducts || [];
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Forecastify Report - ${storeName}</title>
<style>
  @page { size:A4; margin:12mm 14mm; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Segoe UI',system-ui,sans-serif; color:#1e293b; font-size:11px; line-height:1.5; background:#fff; }
  .header { background:linear-gradient(135deg,#312e81,#6366f1,#7c3aed); color:#fff; padding:24px 28px; margin:-12mm -14mm 0; }
  .header h1 { font-size:22px; font-weight:700; } .header p { opacity:0.85; font-size:11px; margin-top:4px; }
  .header .meta { display:flex; gap:16px; margin-top:10px; font-size:10px; opacity:0.9; }
  .section { margin-top:18px; } .section h2 { font-size:14px; font-weight:700; color:#312e81; border-bottom:2px solid #e2e8f0; padding-bottom:4px; margin-bottom:10px; }
  .grid4 { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
  .card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; }
  .card .label { font-size:9px; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; } .card .val { font-size:18px; font-weight:700; color:#1e293b; margin-top:2px; }
  .card .sub { font-size:9px; color:#94a3b8; margin-top:2px; }
  table { width:100%; border-collapse:collapse; font-size:10px; } th { text-align:left; padding:6px 8px; background:#f1f5f9; border-bottom:2px solid #e2e8f0; font-weight:600; color:#475569; }
  td { padding:6px 8px; border-bottom:1px solid #f1f5f9; } tr:nth-child(even) { background:#fafafa; }
  .badge { display:inline-block; padding:2px 8px; border-radius:10px; font-size:9px; font-weight:600; }
  .red { background:#fef2f2; color:#dc2626; } .amber { background:#fffbeb; color:#d97706; } .green { background:#f0fdf4; color:#16a34a; } .blue { background:#eff6ff; color:#2563eb; }
  .risk-bar { width:60px; height:6px; background:#e2e8f0; border-radius:3px; display:inline-block; position:relative; }
  .risk-fill { height:100%; border-radius:3px; position:absolute; left:0; top:0; }
  .footer { margin-top:24px; padding-top:12px; border-top:2px solid #e2e8f0; text-align:center; font-size:9px; color:#94a3b8; }
</style></head><body>

<div class="header">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
    <div style="width:36px;height:36px;background:linear-gradient(135deg,#6366f1,#9333ea);border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;box-shadow:0 4px 12px rgba(99,102,241,0.3);">F</div>
    <span style="font-size:18px;font-weight:700;">Forecastify</span>
  </div>
  <h1>Dashboard Report — ${storeName}</h1>
  <p>AI-Powered Demand Forecasting & Inventory Intelligence</p>
  <div class="meta"><span>Generated: ${timeStr}</span><span>City: ${storeCity}</span><span>Products: ${s.totalSKUs || 0}</span><span>Forecast Accuracy: ${s.forecastAccuracy || 0}%</span></div>
</div>

<div class="section"><h2>Key Metrics</h2>
<div class="grid4">
  <div class="card"><div class="label">Predicted Revenue (7d)</div><div class="val">₹${(s.predictedRevenue || 0).toLocaleString("en-IN")}</div><div class="sub">Trend: ${s.demandTrend > 0 ? "+" : ""}${s.demandTrend || 0}% vs last week</div></div>
  <div class="card"><div class="label">Total Products</div><div class="val">${s.totalSKUs || 0}</div><div class="sub">Stock value: ₹${(s.totalInventoryValue || 0).toLocaleString("en-IN")}</div></div>
  <div class="card"><div class="label">Forecast Accuracy</div><div class="val">${s.forecastAccuracy || 0}%</div><div class="sub">${s.totalForecastDemand || 0} units expected</div></div>
  <div class="card"><div class="label">Active Alerts</div><div class="val">${s.activeAlerts || 0}</div><div class="sub">${s.criticalItems || 0} critical, ${s.lowItems || 0} low, ${s.overstockItems || 0} overstock</div></div>
</div></div>

<div class="section"><h2>Risk Indicators</h2>
<div class="grid4">
  <div class="card"><div class="label">Stockout Risk</div><div class="val">${s.stockoutRisk || 0} products</div><div class="sub">Less than 3 days stock left</div></div>
  <div class="card"><div class="label">Demand Volatility</div><div class="val">${s.demandVolatility || 0}%</div><div class="sub">${s.demandVolatility > 25 ? "High fluctuation" : s.demandVolatility > 12 ? "Moderate" : "Stable"}</div></div>
  <div class="card"><div class="label">Demand Trend</div><div class="val">${s.demandTrend > 0 ? "↑ +" : "↓ "}${s.demandTrend || 0}%</div><div class="sub">vs last week</div></div>
  <div class="card"><div class="label">Overstock Risk</div><div class="val">${s.overstockItems || 0} products</div><div class="sub">Near max capacity</div></div>
</div></div>

<div class="section"><h2>Top Demand Products</h2>
<table><thead><tr><th>Product</th><th>Category</th><th style="text-align:right">Daily Demand</th><th style="text-align:right">Weekly</th><th style="text-align:right">Stock</th><th style="text-align:right">Days Left</th><th style="text-align:right">Gap</th></tr></thead>
<tbody>${topDemand.slice(0, 10).map((p: any) => `<tr><td><strong>${p.name}</strong></td><td>${p.category}</td><td style="text-align:right">${p.dailyDemand}/day</td><td style="text-align:right">${p.weeklyDemand}</td><td style="text-align:right">${p.currentStock} ${p.unit}</td><td style="text-align:right"><span class="${p.daysOfStock < 3 ? "red" : p.daysOfStock < 5 ? "amber" : "green"}">${p.daysOfStock}d</span></td><td style="text-align:right">${p.gap > 0 ? `<span class="badge red">+${p.gap} needed</span>` : '<span class="badge green">OK</span>'}</td></tr>`).join("")}</tbody></table></div>

<div class="section"><h2>Stockout Probability</h2>
<table><thead><tr><th>Product</th><th style="text-align:right">Stock</th><th style="text-align:right">Demand/day</th><th style="text-align:right">Days Left</th><th style="text-align:right">Probability</th></tr></thead>
<tbody>${stockoutProds.slice(0, 10).map((p: any) => `<tr><td><strong>${p.name}</strong> <span style="color:#94a3b8">${p.category}</span></td><td style="text-align:right">${p.currentStock} ${p.unit}</td><td style="text-align:right">${p.dailyDemand}</td><td style="text-align:right"><span class="${p.daysLeft <= 2 ? "red" : p.daysLeft <= 5 ? "amber" : "green"}">${p.daysLeft}d</span></td><td style="text-align:right"><span class="badge ${p.probability >= 70 ? "red" : p.probability >= 40 ? "amber" : "green"}">${p.probability}%</span></td></tr>`).join("")}</tbody></table></div>

<div class="section"><h2>Demand Volatility</h2>
<table><thead><tr><th>Product</th><th style="text-align:right">Avg Sales/day</th><th style="text-align:right">Volatility</th><th style="text-align:center">Level</th></tr></thead>
<tbody>${volProds.slice(0, 10).map((p: any) => `<tr><td><strong>${p.name}</strong> <span style="color:#94a3b8">(${p.dataPoints} records)</span></td><td style="text-align:right">${p.avgSales}</td><td style="text-align:right">${p.volatility}%</td><td style="text-align:center"><span class="badge ${p.level === "high" ? "red" : p.level === "medium" ? "amber" : "green"}">${p.level}</span></td></tr>`).join("")}</tbody></table></div>

<div class="section"><h2>Category Breakdown</h2>
<table><thead><tr><th>Category</th><th style="text-align:right">Stock Units</th><th style="text-align:right">Value</th><th style="text-align:right">Products</th></tr></thead>
<tbody>${categories.map((c: any) => `<tr><td><strong>${c.category}</strong></td><td style="text-align:right">${c.stock}</td><td style="text-align:right">₹${c.value?.toLocaleString("en-IN")}</td><td style="text-align:right">${c.products}</td></tr>`).join("")}</tbody></table></div>

<div class="section"><h2>Business Insights</h2>
<div class="grid4">
  <div class="card"><div class="label">Weekend Sales</div><div class="val">${s.avgWeekendSales || 0} avg/product</div></div>
  <div class="card"><div class="label">Weekday Sales</div><div class="val">${s.avgWeekdaySales || 0} avg/product</div></div>
  <div class="card"><div class="label">Hot Day Sales</div><div class="val">${s.avgHotSales || 0} avg (>35°C)</div></div>
  <div class="card"><div class="label">Cold Day Sales</div><div class="val">${s.avgColdSales || 0} avg (<20°C)</div></div>
</div></div>

${events.length > 0 ? `<div class="section"><h2>Upcoming Events</h2>
<table><thead><tr><th>Event</th><th>Date</th><th>Type</th><th style="text-align:right">Demand Impact</th></tr></thead>
<tbody>${events.slice(0, 6).map((e: any) => `<tr><td><strong>${e.event_name}</strong></td><td>${e.start_date}</td><td>${e.event_type}</td><td style="text-align:right"><span class="badge green">+${e.demand_impact_percent}%</span></td></tr>`).join("")}</tbody></table></div>` : ""}

<div class="footer">
  <p>Forecastify — AI-Powered Demand Forecasting for Retail | Generated on ${timeStr}</p>
  <p style="margin-top:4px;">This report contains predictions based on historical data, weather patterns, and market signals. Actual results may vary.</p>
</div>
</body></html>`;

    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  };

  return (
    <div className="space-y-5">
      {/* Data source info */}
      <div className="flex items-center justify-between text-xs text-muted-foreground bg-secondary/50 rounded-lg px-4 py-2 flex-wrap gap-1">
        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Last updated: {timeStr}</span>
        <div className="flex items-center gap-3">
          <span>Data: {s.historicDataDays || 0} sales records from {s.dataSource || "your city"} | {s.forecastProductCount || 0} products forecasted</span>
          <button onClick={exportPDF} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors">
            <FileDown className="w-3.5 h-3.5" /> Export PDF
          </button>
        </div>
      </div>

      {/* Stat Cards — simple Hindi+English labels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} title={t("stat.expectedSales")} value={`₹${(s.predictedRevenue || 0).toLocaleString("en-IN")}`}
          change={t("stat.vsLastWeek", { val: `${s.demandTrend > 0 ? "+" : ""}${s.demandTrend || 0}` })} changeType={s.demandTrend > 0 ? "positive" : s.demandTrend < 0 ? "negative" : "neutral"} color="bg-green-500" />
        <StatCard icon={Package} title={t("stat.totalProducts")} value={String(s.totalSKUs || 0)}
          change={t("stat.stockValue", { val: `₹${(s.totalInventoryValue || 0).toLocaleString("en-IN")}` })} changeType="neutral" color="bg-blue-500" />
        <StatCard icon={ShieldCheck} title={t("stat.accuracy")} value={`${s.forecastAccuracy || 0}%`}
          change={t("stat.unitsExpected", { val: s.totalForecastDemand || 0 })} changeType="positive" color="bg-indigo-500" />
        <StatCard icon={AlertTriangle} title={t("stat.alerts")} value={String(s.activeAlerts || 0)}
          change={t("stat.alertBreakdown", { critical: s.criticalItems || 0, low: s.lowItems || 0, overstock: s.overstockItems || 0 })} changeType={s.criticalItems > 0 ? "negative" : "neutral"} color="bg-red-500" />
      </div>

      {/* Auto-rotating Market Insights for inventory categories */}
      {(promoResults || promoLoading) && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-pink-500" /> Market Insights — <span className="text-primary">{promoCategory}</span>
            </h3>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <RefreshCw className={`w-3.5 h-3.5 ${promoLoading ? "animate-spin" : ""}`} /> Auto-updates every hour
            </span>
          </div>
          {promoLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-linear-to-br from-green-500/5 to-green-500/10 border border-green-500/20 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                  <ShoppingBag className="w-4 h-4 text-green-500" /> Offers & Deals
                </h4>
                {promoResults?.offers?.length > 0 ? (
                  <div className="space-y-3">
                    {promoResults.offers.slice(0, 3).map((item: any, i: number) => (
                      <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" className="block group">
                        <p className="text-sm font-medium text-foreground group-hover:text-green-500 transition-colors line-clamp-2 flex items-start gap-1">
                          {item.title}
                          <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.snippet}</p>
                      </a>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">No offers found</p>}
              </div>

              <div className="bg-linear-to-br from-amber-500/5 to-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                  <Megaphone className="w-4 h-4 text-amber-500" /> Promotions & Ads
                </h4>
                {promoResults?.promotions?.length > 0 ? (
                  <div className="space-y-3">
                    {promoResults.promotions.slice(0, 3).map((item: any, i: number) => (
                      <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" className="block group">
                        <p className="text-sm font-medium text-foreground group-hover:text-amber-500 transition-colors line-clamp-2 flex items-start gap-1">
                          {item.title}
                          <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.snippet}</p>
                      </a>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">No promotions found</p>}
              </div>

              <div className="bg-linear-to-br from-blue-500/5 to-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                  <Newspaper className="w-4 h-4 text-blue-500" /> Market News
                </h4>
                {promoResults?.news?.length > 0 ? (
                  <div className="space-y-3">
                    {promoResults.news.slice(0, 3).map((item: any, i: number) => (
                      <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" className="block group">
                        <p className="text-sm font-medium text-foreground group-hover:text-blue-500 transition-colors line-clamp-2 flex items-start gap-1">
                          {item.title}
                          <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.snippet}</p>
                      </a>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">No news found</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Risk Indicators — clear explanations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.stockoutRisk > 3 ? "bg-red-500/10" : s.stockoutRisk > 0 ? "bg-amber-500/10" : "bg-green-500/10"}`}>
            <Activity className={`w-5 h-5 ${s.stockoutRisk > 3 ? "text-red-500" : s.stockoutRisk > 0 ? "text-amber-500" : "text-green-500"}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("risk.stockoutTitle")}</p>
            <p className="text-lg font-bold text-foreground">{t("risk.products", { val: s.stockoutRisk || 0 })}</p>
            <p className="text-[10px] text-muted-foreground">{t("risk.stockoutDesc")}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.demandVolatility > 30 ? "bg-red-500/10" : s.demandVolatility > 15 ? "bg-amber-500/10" : "bg-green-500/10"}`}>
            <BarChart3 className={`w-5 h-5 ${s.demandVolatility > 30 ? "text-red-500" : s.demandVolatility > 15 ? "text-amber-500" : "text-green-500"}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("risk.volatilityTitle")}</p>
            <p className="text-lg font-bold text-foreground">{s.demandVolatility || 0}%</p>
            <p className="text-[10px] text-muted-foreground">{s.demandVolatility > 25 ? t("risk.volatilityHigh") : s.demandVolatility > 12 ? t("risk.volatilityMed") : t("risk.volatilityLow")}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-indigo-500/10">
            <TrendingUp className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("risk.trendTitle")}</p>
            <p className="text-lg font-bold text-foreground flex items-center gap-1">
              {s.demandTrend > 0 ? <ArrowUpRight className="w-4 h-4 text-green-500" /> : <ArrowDownRight className="w-4 h-4 text-red-500" />}
              {s.demandTrend > 0 ? "+" : ""}{s.demandTrend || 0}%
            </p>
            <p className="text-[10px] text-muted-foreground">{t("risk.trendDesc")}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.overstockItems > 3 ? "bg-blue-500/10" : "bg-green-500/10"}`}>
            <Package className={`w-5 h-5 ${s.overstockItems > 3 ? "text-blue-500" : "text-green-500"}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("risk.overstockTitle")}</p>
            <p className="text-lg font-bold text-foreground">{t("risk.products", { val: s.overstockItems || 0 })}</p>
            <p className="text-[10px] text-muted-foreground">{t("risk.overstockDesc")}</p>
          </div>
        </div>
      </div>

      {/* Forecast Chart + Category Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="flex items-start justify-between mb-1 flex-wrap gap-2">
            <div>
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-500" /> {selectedProduct ? `7-Day Forecast — ${selectedProduct}` : t("chart.forecastTitle", { count: s.forecastProductCount || 0 })}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedProduct
                  ? `Current: ${selectedProd?.currentStock || 0} ${selectedProd?.unit || "pcs"} | Min: ${selectedProd?.minStock || 0} | Max: ${selectedProd?.maxStock || 0}`
                  : t("chart.forecastDesc")}
              </p>
            </div>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              disabled={stockLoading}
              className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 max-w-55"
            >
              <option value="">{stockLoading ? "Loading stock levels..." : `All Products (${s.forecastProductCount || 0})`}</option>
              {stockLevels.map((p: any) => (
                <option key={p.name} value={p.name}>{p.name} ({p.currentStock} {p.unit})</option>
              ))}
            </select>
          </div>

          {/* Product info badges when a product is selected */}
          {selectedProd && (
            <div className="flex flex-wrap items-center gap-2 mb-3 mt-2">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-500">Current Stock: {selectedProd.currentStock} {selectedProd.unit}</span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-500">Min Stock: {selectedProd.minStock}</span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-green-500/10 text-green-500">Max Stock: {selectedProd.maxStock}</span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-secondary text-muted-foreground">{selectedProd.category}</span>
            </div>
          )}

          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gPred" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient>
                <linearGradient id="gActual" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} label={{ value: "units", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "var(--color-muted-foreground)" } }} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px" }}
                formatter={(v: any, name: any) => [
                  v + " units",
                  name === "predicted" ? "Forecast" : name === "actual" ? "Last Week" : name === "recommended" ? "Recommended" : name === "minStock" ? "Min Stock" : name === "maxStock" ? "Max Stock" : name === "currentStock" ? "Current Stock" : name,
                ]} />
              <Legend formatter={(v) => v === "predicted" ? "Forecast" : v === "actual" ? "Last Week" : v === "recommended" ? "Recommended" : v === "minStock" ? "Min Stock" : v === "maxStock" ? "Max Stock" : v === "currentStock" ? "Current Stock" : v} />
              <Area type="monotone" dataKey="predicted" name="predicted" stroke="#6366f1" fill="url(#gPred)" strokeWidth={2} />
              {!selectedProduct && <Area type="monotone" dataKey="actual" name="actual" stroke="#22c55e" fill="url(#gActual)" strokeWidth={2} strokeDasharray="5 5" />}
              <Area type="monotone" dataKey="recommended" name="recommended" stroke="#f59e0b" fill="none" strokeWidth={1.5} strokeDasharray="3 3" />
              {selectedProduct && <Area type="monotone" dataKey="minStock" name="minStock" stroke="#ef4444" fill="none" strokeWidth={1.5} strokeDasharray="6 3" />}
              {selectedProduct && <Area type="monotone" dataKey="maxStock" name="maxStock" stroke="#22c55e" fill="none" strokeWidth={1.5} strokeDasharray="6 3" />}
              {selectedProduct && <Area type="monotone" dataKey="currentStock" name="currentStock" stroke="#3b82f6" fill="none" strokeWidth={2} />}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground flex items-center gap-2 mb-1">
            <Tag className="w-4 h-4 text-purple-500" /> {t("chart.categoryTitle")}
          </h3>
          <p className="text-xs text-muted-foreground mb-3">{t("chart.categoryDesc")}</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categories} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis type="category" dataKey="category" width={90} stroke="var(--color-muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px" }}
                formatter={(v: any) => [v + " units", "Stock"]} />
              <Bar dataKey="stock" name="Units" radius={[0, 6, 6, 0]}>
                {categories.map((_: any, i: number) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Product Table with Filters */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-500" /> {t("table.productInsights")}
          </h3>
          <div className="flex gap-1 bg-secondary rounded-lg p-0.5">
            {(Object.keys(filterLabels) as FilterTab[]).map(tab => (
              <button key={tab} onClick={() => setActiveFilter(tab)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeFilter === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {filterLabels[tab]}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              <th className="text-left py-2 text-muted-foreground font-medium">Product</th>
              <th className="text-left py-2 text-muted-foreground font-medium">Category</th>
              {activeFilter === "topDemand" && <><th className="text-right py-2 text-muted-foreground font-medium">{t("table.dailyDemand")}</th><th className="text-right py-2 text-muted-foreground font-medium">Weekly</th><th className="text-right py-2 text-muted-foreground font-medium">Stock</th><th className="text-right py-2 text-muted-foreground font-medium">{t("table.daysLeft")}</th><th className="text-right py-2 text-muted-foreground font-medium">{t("table.needed")}</th></>}
              {activeFilter === "lowStock" && <><th className="text-right py-2 text-muted-foreground font-medium">Qty</th><th className="text-right py-2 text-muted-foreground font-medium">Price</th><th className="text-center py-2 text-muted-foreground font-medium">Status</th></>}
              {activeFilter === "highValue" && <><th className="text-right py-2 text-muted-foreground font-medium">Qty</th><th className="text-right py-2 text-muted-foreground font-medium">Price</th><th className="text-right py-2 text-muted-foreground font-medium">Total Value</th></>}
              {activeFilter === "recent" && <><th className="text-right py-2 text-muted-foreground font-medium">Qty</th><th className="text-right py-2 text-muted-foreground font-medium">Price</th><th className="text-center py-2 text-muted-foreground font-medium">Status</th></>}
            </tr></thead>
            <tbody>
              {(filterData[activeFilter] || []).map((item: any, i: number) => (
                <tr key={i} className="border-b border-border last:border-0 hover:bg-secondary/30">
                  <td className="py-2.5"><span className="font-medium text-foreground">{item.name}</span>{item.brand && item.brand !== "?" && <span className="text-xs text-muted-foreground ml-1">({item.brand})</span>}</td>
                  <td className="py-2.5 text-muted-foreground text-xs">{item.category}</td>
                  {activeFilter === "topDemand" && <>
                    <td className="py-2.5 text-right font-semibold text-foreground">{item.dailyDemand}/day</td>
                    <td className="py-2.5 text-right text-foreground">{item.weeklyDemand}/week</td>
                    <td className="py-2.5 text-right text-muted-foreground">{item.currentStock} {item.unit}</td>
                    <td className="py-2.5 text-right"><span className={item.daysOfStock < 3 ? "text-red-500 font-bold" : item.daysOfStock < 5 ? "text-amber-500" : "text-green-500"}>{item.daysOfStock} din</span></td>
                    <td className="py-2.5 text-right"><span className={item.gap > 0 ? "text-red-500 font-medium" : "text-green-500"}>{item.gap > 0 ? t("table.moreNeeded", { val: item.gap }) : "OK"}</span></td>
                  </>}
                  {activeFilter === "lowStock" && <>
                    <td className="py-2.5 text-right font-bold text-foreground">{item.quantity} {item.unit}</td>
                    <td className="py-2.5 text-right text-muted-foreground">₹{item.price}</td>
                    <td className="py-2.5 text-center"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status] || ""}`}>{item.status === "critical" ? t("status.critical") : item.status === "low" ? t("status.low") : "OK"}</span></td>
                  </>}
                  {activeFilter === "highValue" && <>
                    <td className="py-2.5 text-right text-foreground">{item.quantity} {item.unit}</td>
                    <td className="py-2.5 text-right text-muted-foreground">₹{item.price}</td>
                    <td className="py-2.5 text-right font-semibold text-foreground">₹{item.totalValue?.toLocaleString("en-IN")}</td>
                  </>}
                  {activeFilter === "recent" && <>
                    <td className="py-2.5 text-right font-bold text-foreground">{item.quantity} {item.unit}</td>
                    <td className="py-2.5 text-right text-muted-foreground">₹{item.price}</td>
                    <td className="py-2.5 text-center"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status] || ""}`}>{item.status === "critical" ? t("status.critical") : item.status === "low" ? t("status.low") : item.status === "overstock" ? t("status.overstock") : t("status.optimal")}</span></td>
                  </>}
                </tr>
              ))}
              {!(filterData[activeFilter]?.length) && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">{t("table.noData")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Business Insights Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Weather */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3"><Cloud className="w-4 h-4 text-blue-500" /> {t("biz.weatherTitle")}</h4>
          {weather?.current ? (
            <div>
              <p className="text-2xl font-bold text-foreground">{weather.current.temp}°C</p>
              <p className="text-sm text-muted-foreground capitalize">{weather.current.description}</p>
              <p className="text-xs text-muted-foreground mt-1">Humidity: {weather.current.humidity}%</p>
              <div className="mt-2 space-y-1 text-xs">
                {s.avgHotSales > 0 && <p className="flex items-center gap-1"><Sun className="w-3 h-3 text-orange-500" /> {t("biz.hotDays", { val: s.avgHotSales })}</p>}
                {s.avgColdSales > 0 && <p className="flex items-center gap-1"><Snowflake className="w-3 h-3 text-blue-400" /> {t("biz.coldDays", { val: s.avgColdSales })}</p>}
                {weatherImpact.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border">
                    {weatherImpact.slice(0, 3).map((w: any, i: number) => (
                      <p key={i} className="flex justify-between"><span className="text-muted-foreground">{w.condition}</span><span className="font-medium text-foreground">{w.avgSales}/day avg</span></p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : <p className="text-sm text-muted-foreground">Loading...</p>}
          {dbWeather.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">📊 DB Weather (Last 7 days)</p>
              {dbWeather.slice(0, 4).map((w: any, i: number) => (
                <p key={i} className="text-[10px] flex justify-between text-muted-foreground">
                  <span>{w.date?.slice(5)}</span>
                  <span>{w.avg_temp}°C {w.weather_condition}{w.rainfall_mm > 0 ? ` 🌧${w.rainfall_mm}mm` : ""}</span>
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Promotions */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3"><Zap className="w-4 h-4 text-amber-500" /> {t("biz.promoTitle")}</h4>
          {promoImpact.length > 0 ? (
            <div className="space-y-2">
              {promoImpact.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.type}</p>
                    <p className="text-[10px] text-muted-foreground">{t("biz.promosRan", { val: p.count })}</p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">avg -{p.avgDiscount}% off</span>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground pt-1 border-t border-border">{t("biz.last30")}</p>
            </div>
          ) : <p className="text-sm text-muted-foreground">{t("biz.noPromos")}</p>}
        </div>

        {/* Events */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3"><Calendar className="w-4 h-4 text-pink-500" /> {t("biz.eventsTitle")}</h4>
          {events.length > 0 ? (
            <div className="space-y-2">{events.slice(0, 4).map((e: any, i: number) => (
              <div key={i} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{e.event_name}</p>
                  <p className="text-[10px] text-muted-foreground">{e.start_date} • {e.event_type}</p>
                </div>
                <span className="text-xs font-semibold text-green-500">+{e.demand_impact_percent}% demand</span>
              </div>
            ))}</div>
          ) : <p className="text-sm text-muted-foreground">{t("biz.noEvents")}</p>}
        </div>

        {/* Sales Pattern */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3"><ThermometerSun className="w-4 h-4 text-cyan-500" /> {t("biz.patternsTitle")}</h4>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">{t("biz.weekend")}</span><span className="font-bold text-foreground">{s.avgWeekendSales || 0} avg/product</span></div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, (s.avgWeekendSales / Math.max(s.avgWeekendSales, s.avgWeekdaySales, 1)) * 100)}%` }} /></div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">{t("biz.weekday")}</span><span className="font-bold text-foreground">{s.avgWeekdaySales || 0} avg/product</span></div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-cyan-500 rounded-full" style={{ width: `${Math.min(100, (s.avgWeekdaySales / Math.max(s.avgWeekendSales, s.avgWeekdaySales, 1)) * 100)}%` }} /></div>
            </div>
            <div className="text-xs text-muted-foreground pt-1 border-t border-border">
              {s.avgWeekdaySales > 0 ? t("biz.weekendUplift", { val: Math.abs(Math.round(((s.avgWeekendSales - s.avgWeekdaySales) / s.avgWeekdaySales) * 100)), dir: s.avgWeekendSales > s.avgWeekdaySales ? t("biz.more") : t("biz.less") }) : "N/A"}
            </div>
            {signals.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-border">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1"><Radio className="w-3 h-3 text-cyan-500" /> {t("biz.liveSignals")}</p>
                {signals.slice(0, 2).map((sig: any, i: number) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${sig.strength > 0.7 ? "bg-red-500" : sig.strength > 0.4 ? "bg-amber-500" : "bg-green-500"}`} />
                    <p className="text-[10px] text-muted-foreground truncate">{sig.type.replace(/_/g, " ")}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Risk Indicators — Stockout Probability + Demand Volatility */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Stockout Probability */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-500" /> {t("risk.stockoutTableTitle")}
          </h3>
          <p className="text-xs text-muted-foreground mb-3">{t("risk.stockoutTableDesc")}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                <th className="text-left py-2 text-muted-foreground font-medium">Product</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Stock</th>
                <th className="text-right py-2 text-muted-foreground font-medium">{t("table.dailyDemand")}</th>
                <th className="text-right py-2 text-muted-foreground font-medium">{t("table.daysLeft")}</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Khatam Hone Ka %</th>
              </tr></thead>
              <tbody>
                {(data?.stockoutProducts || []).filter((p: any) => p.probability > 10).slice(0, 10).map((p: any, i: number) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-2">
                      <span className="font-medium text-foreground">{p.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-1">{p.category}</span>
                    </td>
                    <td className="py-2 text-right text-foreground">{p.currentStock} {p.unit}</td>
                    <td className="py-2 text-right text-muted-foreground">{p.dailyDemand}/day</td>
                    <td className="py-2 text-right">
                      <span className={`font-bold ${p.daysLeft <= 2 ? "text-red-500" : p.daysLeft <= 5 ? "text-amber-500" : "text-green-500"}`}>
                        {p.daysLeft} din
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${p.probability >= 70 ? "bg-red-500" : p.probability >= 40 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${p.probability}%` }} />
                        </div>
                        <span className={`text-xs font-bold min-w-[32px] text-right ${p.probability >= 70 ? "text-red-500" : p.probability >= 40 ? "text-amber-500" : "text-green-500"}`}>{p.probability}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {!(data?.stockoutProducts?.filter((p: any) => p.probability > 10)?.length) && (
                  <tr><td colSpan={5} className="py-6 text-center text-green-500">{t("risk.allSafe")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Demand Volatility */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-amber-500" /> {t("risk.volatilityTableTitle")}
          </h3>
          <p className="text-xs text-muted-foreground mb-3">{t("risk.volatilityTableDesc")}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                <th className="text-left py-2 text-muted-foreground font-medium">Product</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Avg Bikri/din</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Volatility</th>
                <th className="text-center py-2 text-muted-foreground font-medium">Level</th>
              </tr></thead>
              <tbody>
                {(data?.volatilityProducts || []).slice(0, 10).map((p: any, i: number) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-2">
                      <span className="font-medium text-foreground">{p.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-1">({p.dataPoints} records)</span>
                    </td>
                    <td className="py-2 text-right text-foreground">{p.avgSales}</td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${p.volatility > 40 ? "bg-red-500" : p.volatility > 20 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${Math.min(100, p.volatility)}%` }} />
                        </div>
                        <span className={`text-xs font-bold min-w-[32px] text-right ${p.volatility > 40 ? "text-red-500" : p.volatility > 20 ? "text-amber-500" : "text-green-500"}`}>{p.volatility}%</span>
                      </div>
                    </td>
                    <td className="py-2 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.level === "high" ? "bg-red-500/10 text-red-500" : p.level === "medium" ? "bg-amber-500/10 text-amber-500" : "bg-green-500/10 text-green-500"}`}>
                        {p.level === "high" ? t("risk.highChange") : p.level === "medium" ? t("risk.medChange") : t("risk.stable")}
                      </span>
                    </td>
                  </tr>
                ))}
                {!(data?.volatilityProducts?.length) && (
                  <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">{t("risk.noHistoric")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
