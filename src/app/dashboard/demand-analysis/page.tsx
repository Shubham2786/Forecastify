"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, Cell,
} from "recharts";
import {
  MapPin, Cloud, TrendingUp, AlertTriangle, ShoppingBag, Download,
  FileText, Code, Loader2, RefreshCw, Zap, Thermometer, Droplets,
  Wind, Calendar, Tag, Package, ShieldAlert, ArrowUpRight, ArrowDownRight,
  ChevronDown, ChevronUp, Star, Clock,
} from "lucide-react";

interface WeatherData {
  current: {
    temp: number; feelsLike: number; humidity: number;
    weather: string; description: string; windSpeed: number; city: string;
  };
  forecast: {
    date: string; avgTemp: number; maxTemp: number; minTemp: number;
    avgHumidity: number; weather: string;
  }[];
}

interface DemandSpike {
  day: string; dayName: string; spikeProbability: number;
  expectedIncrease: string; reason: string; topProducts: string[];
}

interface TrendingProduct {
  name: string; category: string; demandScore: number;
  reason: string; recommendedStock: string; priceRange: string;
}

interface Analysis {
  summary: string;
  demandSpikes: DemandSpike[];
  trendingProducts: TrendingProduct[];
  weatherImpact: {
    severity: string; description: string;
    affectedCategories: string[]; recommendations: string[];
  };
  upcomingOffers: {
    event: string; date: string; affectedCategories: string[];
    expectedDemandChange: string; recommendations: string[];
  }[];
  inventoryRecommendations: {
    product: string; action: string; currentAdvice: string; urgency: string;
  }[];
  riskAlerts: {
    type: string; severity: string; message: string; mitigation: string;
  }[];
}

interface NewsData {
  offers: { title: string; snippet: string; link: string }[];
  trending: { title: string; snippet: string; link: string }[];
  events: { title: string; snippet: string; link: string }[];
}

const SPIKE_COLORS = ["#6366f1", "#a855f7", "#ec4899", "#f59e0b", "#22c55e", "#06b6d4", "#f43f5e"];

export default function DemandAnalysisPage() {
  const { user } = useAuth();
  const reportRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("");
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [news, setNews] = useState<NewsData | null>(null);
  const [locationInfo, setLocationInfo] = useState<{
    formattedAddress: string; city: string; state: string;
  } | null>(null);
  const [storeProfile, setStoreProfile] = useState<{
    store_name: string; store_category: string; store_size: string;
    city: string; state: string; store_address: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");
  const [expandedSpike, setExpandedSpike] = useState<number | null>(null);
  const [showAllProducts, setShowAllProducts] = useState(false);

  // Fetch store profile from DB
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("store_name, store_category, store_size, city, state, store_address")
        .eq("id", user.id)
        .single();
      if (data) setStoreProfile(data);
    })();
  }, [user]);

  const runAnalysis = async () => {
    setLoading(true);
    setError("");
    setAnalysis(null);
    setWeather(null);
    setNews(null);

    try {
      // Step 1: Resolve store location from DB address via Google Maps
      setStep("Locating your store...");
      const storeAddress = [
        storeProfile?.store_address,
        storeProfile?.city || user?.user_metadata?.city,
        storeProfile?.state || user?.user_metadata?.state,
      ].filter(Boolean).join(", ");

      let lat: number | null = null;
      let lon: number | null = null;
      let locData: { formattedAddress?: string; city?: string; state?: string } = {};

      if (storeAddress) {
        // Forward geocode: use the store address from the database
        const locRes = await fetch(`/api/location?address=${encodeURIComponent(storeAddress)}`);
        const locJson = await locRes.json();
        if (locRes.ok) {
          locData = locJson;
          lat = locJson.lat;
          lon = locJson.lon;
          setLocationInfo(locJson);
        }
      }

      // Fallback to browser geolocation if store address didn't resolve
      if (!lat || !lon) {
        setStep("Using browser location as fallback...");
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
        );
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;

        const locRes = await fetch(`/api/location?lat=${lat}&lon=${lon}`);
        const locJson = await locRes.json();
        if (locRes.ok) {
          locData = locJson;
          setLocationInfo(locJson);
        }
      }

      // Step 2: Fetch weather for the resolved coordinates
      setStep("Fetching weather data...");
      const weatherRes = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
      const weatherData = await weatherRes.json();
      if (weatherRes.ok) setWeather(weatherData);

      // Step 3: Fetch news & offers
      setStep("Searching for offers & trends...");
      const category = storeProfile?.store_category || user?.user_metadata?.store_category || "Retail";
      const city = locData?.city || storeProfile?.city || "";
      const state = locData?.state || storeProfile?.state || "";

      const newsRes = await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeCategory: category, city, state }),
      });
      const newsData = await newsRes.json();
      if (newsRes.ok) setNews(newsData);

      // Step 4: Run AI analysis
      setStep("Running AI demand analysis with Groq...");
      const analysisRes = await fetch("/api/demand-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeCategory: category,
          storeSize: storeProfile?.store_size || user?.user_metadata?.store_size || "",
          city, state,
          weather: weatherData?.current,
          forecast: weatherData?.forecast,
          news: newsData,
          events: newsData?.events,
          location: locData?.formattedAddress || `${city}, ${state}`,
        }),
      });
      const analysisData = await analysisRes.json();

      if (analysisRes.ok && analysisData.analysis) {
        setAnalysis(analysisData.analysis);
        setGeneratedAt(analysisData.generatedAt);
      } else {
        setError(analysisData.error || "Analysis failed");
      }
    } catch (err) {
      console.error("Analysis error:", err);
      if (err instanceof GeolocationPositionError) {
        setError("Location access denied. Please enable location permissions and try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
      setStep("");
    }
  };

  const getReportData = () => {
    const storeName = storeProfile?.store_name || "Store";
    const storeCategory = storeProfile?.store_category || "";
    const loc = locationInfo?.formattedAddress || `${storeProfile?.city || ""}, ${storeProfile?.state || ""}`;
    const date = generatedAt ? new Date(generatedAt).toLocaleString("en-IN") : new Date().toLocaleString("en-IN");

    const spikesTable = analysis?.demandSpikes?.map(s => `
      <tr>
        <td><strong>${s.dayName}</strong><br/><span style="color:#888;font-size:11px">${s.day}</span></td>
        <td><div class="spike-bar" style="width:${Math.min(s.spikeProbability, 100)}px"></div>${s.spikeProbability}%</td>
        <td><span class="badge badge-increase">${s.expectedIncrease}</span></td>
        <td style="max-width:200px">${s.reason}</td>
        <td><div class="product-tags">${s.topProducts?.map(p => `<span class="product-tag">${p}</span>`).join("") || "-"}</div></td>
      </tr>
    `).join("") || "";

    const productsTable = analysis?.trendingProducts?.map(p => `
      <tr>
        <td><strong>${p.name}</strong></td>
        <td>${p.category}</td>
        <td><div class="spike-bar" style="width:${p.demandScore}px;max-width:80px"></div>${p.demandScore}</td>
        <td><span class="badge badge-${p.recommendedStock?.toLowerCase()}">${p.recommendedStock}</span></td>
        <td>${p.priceRange}</td>
        <td style="max-width:180px;font-size:11px;color:#666">${p.reason}</td>
      </tr>
    `).join("") || "";

    const inventoryCards = analysis?.inventoryRecommendations?.map(r => `
      <div class="card">
        <h4>${r.product}</h4>
        <p><strong>${r.action}</strong> · <span class="badge badge-${r.urgency?.toLowerCase()}">${r.urgency}</span></p>
        <p style="margin-top:4px">${r.currentAdvice}</p>
      </div>
    `).join("") || "";

    const riskCards = analysis?.riskAlerts?.map(r => `
      <div class="card risk-${r.severity}">
        <h4 style="display:flex;align-items:center;gap:6px">${r.severity === "critical" ? "🔴" : r.severity === "warning" ? "🟡" : "🔵"} ${r.type.replace(/_/g, " ").toUpperCase()} <span class="badge badge-${r.severity}">${r.severity}</span></h4>
        <p style="margin-top:4px">${r.message}</p>
        <p style="margin-top:4px;color:#16a34a;font-size:12px"><strong>Mitigation:</strong> ${r.mitigation}</p>
      </div>
    `).join("") || "";

    const offersSection = analysis?.upcomingOffers?.map(o => `
      <div class="card">
        <h4>${o.event}</h4>
        <p><strong>Date:</strong> ${o.date} · <span class="badge badge-increase">${o.expectedDemandChange}</span></p>
        <p><strong>Categories:</strong> ${o.affectedCategories?.join(", ")}</p>
        <p style="margin-top:4px"><strong>Stock up:</strong> ${o.recommendations?.join("; ")}</p>
      </div>
    `).join("") || "";

    const weatherForecastHTML = weather?.forecast?.map(d => `
      <div class="weather-day">
        <div class="label">${new Date(d.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric" })}</div>
        <div class="temp">${d.maxTemp}°</div>
        <div class="label">${d.minTemp}° · ${d.weather}</div>
        <div class="label">${d.avgHumidity}% humidity</div>
      </div>
    `).join("") || "";

    return { storeName, storeCategory, loc, date, spikesTable, productsTable, inventoryCards, riskCards, offersSection, weatherForecastHTML };
  };

  const buildPDFHTML = () => {
    const d = getReportData();
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Demand Spike Analysis - ${d.storeName}</title>
<style>
  @page { size: A4; margin: 18mm 16mm 16mm 16mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Georgia', 'Times New Roman', serif; color:#1e293b; font-size:11px; line-height:1.55; background:#fff; }

  /* Cover band */
  .cover-band { background: linear-gradient(135deg, #312e81, #6366f1, #7c3aed); color:#fff; padding:22px 28px; margin:-18mm -16mm 0 -16mm; margin-bottom: 18px; }
  .cover-top { display:flex; justify-content:space-between; align-items:center; }
  .cover-brand { display:flex; align-items:center; gap:12px; }
  .cover-logo { width:36px; height:36px; background:rgba(255,255,255,0.2); border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:18px; font-family:system-ui; }
  .cover-brand span { font-size:20px; font-weight:700; letter-spacing:-0.5px; font-family:system-ui; }
  .cover-badge { background:rgba(255,255,255,0.15); padding:4px 14px; border-radius:20px; font-size:10px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase; }
  .cover-title { font-size:24px; font-weight:700; margin-top:14px; line-height:1.2; font-family:system-ui; }
  .cover-sub { font-size:12px; opacity:0.85; margin-top:4px; }
  .cover-meta { display:flex; gap:20px; margin-top:12px; flex-wrap:wrap; }
  .cover-meta-item { font-size:10px; opacity:0.9; }
  .cover-meta-item strong { opacity:1; }
  .cover-line { height:3px; background:linear-gradient(90deg, rgba(255,255,255,0.6), transparent); margin-top:14px; border-radius:2px; }

  /* Executive Summary */
  .exec-summary { background:#f8fafc; border:1px solid #e2e8f0; border-left:4px solid #6366f1; padding:12px 16px; margin-bottom:16px; font-size:11.5px; color:#334155; }
  .exec-summary strong { color:#312e81; }

  /* Sections */
  .section { margin-bottom:14px; page-break-inside:avoid; }
  .section-head { font-size:13px; font-weight:700; color:#312e81; border-bottom:2px solid #312e81; padding-bottom:4px; margin-bottom:8px; font-family:system-ui; letter-spacing:-0.3px; }
  .section-head .num { display:inline-block; background:#312e81; color:#fff; width:20px; height:20px; border-radius:4px; text-align:center; line-height:20px; font-size:10px; margin-right:6px; vertical-align:middle; }

  /* Tables */
  table { width:100%; border-collapse:collapse; font-size:10.5px; }
  th { background:#f1f5f9; color:#475569; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.7px; padding:6px 8px; text-align:left; border-bottom:2px solid #cbd5e1; }
  td { padding:6px 8px; border-bottom:1px solid #e2e8f0; vertical-align:top; }
  tr:nth-child(even) { background:#f8fafc; }

  /* Cards */
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .grid-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; }
  .card { background:#f8fafc; padding:10px 12px; border-radius:6px; border:1px solid #e2e8f0; }
  .card h4 { font-size:11px; font-weight:700; color:#1e293b; margin-bottom:3px; font-family:system-ui; }
  .card p { font-size:10px; color:#64748b; line-height:1.45; }

  /* Badges */
  .badge { display:inline-block; padding:1px 8px; border-radius:10px; font-size:9px; font-weight:700; font-family:system-ui; }
  .badge-high, .badge-critical { background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; }
  .badge-medium, .badge-warning { background:#fffbeb; color:#b45309; border:1px solid #fed7aa; }
  .badge-low, .badge-info { background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; }
  .badge-increase { background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }

  /* Bars & Tags */
  .spike-bar { height:12px; border-radius:3px; background:linear-gradient(90deg, #4f46e5, #7c3aed); display:inline-block; vertical-align:middle; margin-right:5px; }
  .product-tags { display:flex; flex-wrap:wrap; gap:3px; margin-top:3px; }
  .product-tag { background:#eef2ff; color:#4338ca; padding:1px 7px; border-radius:4px; font-size:8.5px; font-weight:600; font-family:system-ui; }

  /* Risk borders */
  .risk-critical { border-left:3px solid #dc2626; }
  .risk-warning { border-left:3px solid #d97706; }
  .risk-info { border-left:3px solid #2563eb; }

  /* Weather */
  .weather-grid { display:grid; grid-template-columns:repeat(7, 1fr); gap:6px; }
  .weather-day { background:#f0f9ff; padding:8px 4px; border-radius:6px; text-align:center; border:1px solid #e0f2fe; }
  .weather-day .temp { font-size:15px; font-weight:700; color:#c2410c; font-family:system-ui; }
  .weather-day .label { font-size:9px; color:#64748b; }

  /* Footer */
  .footer { margin-top:20px; padding-top:10px; border-top:2px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; font-size:9px; color:#94a3b8; }
  .footer-left { font-weight:600; color:#64748b; }
</style></head><body>

<div class="cover-band">
  <div class="cover-top">
    <div class="cover-brand"><div class="cover-logo">F</div><span>Forecastify</span></div>
    <div class="cover-badge">Confidential Report</div>
  </div>
  <div class="cover-title">Demand Spike Analysis Report</div>
  <div class="cover-sub">AI-Powered Retail Intelligence &middot; ${d.storeCategory}</div>
  <div class="cover-meta">
    <div class="cover-meta-item"><strong>Store:</strong> ${d.storeName}</div>
    <div class="cover-meta-item"><strong>Location:</strong> ${d.loc}</div>
    <div class="cover-meta-item"><strong>Weather:</strong> ${weather?.current?.temp || "--"}°C, ${weather?.current?.description || "--"}</div>
    <div class="cover-meta-item"><strong>Generated:</strong> ${d.date}</div>
  </div>
  <div class="cover-line"></div>
</div>

<div class="exec-summary"><strong>Executive Summary:</strong> ${analysis?.summary || ""}</div>

${weather ? `<div class="section">
  <div class="section-head"><span class="num">1</span>7-Day Weather Forecast</div>
  <div class="weather-grid">${d.weatherForecastHTML}</div>
</div>` : ""}

<div class="section">
  <div class="section-head"><span class="num">2</span>Demand Spike Forecast</div>
  <table><thead><tr><th>Day</th><th>Probability</th><th>Increase</th><th>Reason</th><th>Top Products</th></tr></thead><tbody>${d.spikesTable}</tbody></table>
</div>

<div class="section">
  <div class="section-head"><span class="num">3</span>Trending Products</div>
  <table><thead><tr><th>Product</th><th>Category</th><th>Score</th><th>Stock</th><th>Price</th><th>Reason</th></tr></thead><tbody>${d.productsTable}</tbody></table>
</div>

${analysis?.weatherImpact ? `<div class="section">
  <div class="section-head"><span class="num">4</span>Weather Impact Analysis</div>
  <div class="card">
    <h4>Severity: <span class="badge badge-${analysis.weatherImpact.severity?.toLowerCase()}">${analysis.weatherImpact.severity}</span></h4>
    <p style="margin-top:4px;font-size:11px;color:#334155">${analysis.weatherImpact.description}</p>
    <p style="margin-top:6px"><strong>Affected:</strong> ${analysis.weatherImpact.affectedCategories?.join(", ")}</p>
    <ul style="margin:4px 0 0 16px;font-size:10px;color:#475569">${analysis.weatherImpact.recommendations?.map(r => `<li>${r}</li>`).join("") || ""}</ul>
  </div>
</div>` : ""}

${analysis?.upcomingOffers?.length ? `<div class="section">
  <div class="section-head"><span class="num">5</span>Upcoming Offers & Events</div>
  <div class="grid">${d.offersSection}</div>
</div>` : ""}

${analysis?.inventoryRecommendations?.length ? `<div class="section">
  <div class="section-head"><span class="num">6</span>Inventory Recommendations</div>
  <div class="grid-3">${d.inventoryCards}</div>
</div>` : ""}

${analysis?.riskAlerts?.length ? `<div class="section">
  <div class="section-head"><span class="num">7</span>Risk Alerts</div>
  <div class="grid">${d.riskCards}</div>
</div>` : ""}

<div class="footer">
  <div class="footer-left">Forecastify &middot; AI-Powered Demand Forecasting</div>
  <div>&copy; ${new Date().getFullYear()} Forecastify. Confidential to ${d.storeName}. Powered by Groq AI.</div>
</div>
</body></html>`;
  };

  const buildWebHTML = () => {
    const d = getReportData();
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Demand Analysis - ${d.storeName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',system-ui,sans-serif; color:#1a1a2e; padding:32px 40px; line-height:1.6; background:#f9fafb; }
  .report-wrap { max-width:960px; margin:0 auto; background:#fff; border-radius:16px; box-shadow:0 4px 24px rgba(0,0,0,0.08); overflow:hidden; }
  .header-band { background:linear-gradient(135deg, #6366f1, #a855f7, #ec4899); padding:28px 32px; color:#fff; }
  .header-brand { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
  .header-logo { width:40px; height:40px; background:rgba(255,255,255,0.2); border-radius:10px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:18px; }
  .header-brand span { font-size:18px; font-weight:700; }
  .header-band h1 { font-size:26px; font-weight:700; }
  .header-band p { font-size:13px; opacity:0.85; margin-top:4px; }
  .meta-row { display:flex; gap:12px; flex-wrap:wrap; padding:16px 32px; border-bottom:1px solid #e5e7eb; background:#fafafa; }
  .meta-item { display:flex; align-items:center; gap:6px; font-size:12px; color:#475569; background:#fff; padding:6px 14px; border-radius:20px; border:1px solid #e5e7eb; }
  .meta-item strong { color:#1e293b; }
  .content { padding:24px 32px; }
  .summary-box { background:linear-gradient(135deg,#eef2ff,#faf5ff); padding:16px 20px; border-radius:12px; border-left:4px solid #6366f1; margin-bottom:24px; font-size:14px; color:#334155; }
  .section { margin-bottom:24px; }
  .section-title { font-size:16px; font-weight:700; color:#6366f1; margin-bottom:12px; padding-bottom:6px; border-bottom:2px solid #e5e7eb; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th { background:#f1f5f9; color:#475569; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; padding:10px 12px; text-align:left; border-bottom:2px solid #e2e8f0; }
  td { padding:10px 12px; border-bottom:1px solid #f1f5f9; }
  tr:hover { background:#fafbff; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .grid-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }
  .card { background:#fff; padding:14px 16px; border-radius:10px; border:1px solid #e5e7eb; transition:box-shadow 0.2s; }
  .card:hover { box-shadow:0 2px 8px rgba(0,0,0,0.06); }
  .card h4 { font-size:14px; font-weight:600; color:#1e293b; margin-bottom:4px; }
  .card p { font-size:12px; color:#64748b; line-height:1.5; }
  .badge { display:inline-block; padding:2px 10px; border-radius:12px; font-size:11px; font-weight:600; }
  .badge-high,.badge-critical { background:#fee2e2; color:#dc2626; }
  .badge-medium,.badge-warning { background:#fef3c7; color:#d97706; }
  .badge-low,.badge-info { background:#dbeafe; color:#2563eb; }
  .badge-increase { background:#dcfce7; color:#16a34a; }
  .spike-bar { height:14px; border-radius:4px; background:linear-gradient(90deg,#6366f1,#a855f7); display:inline-block; vertical-align:middle; margin-right:6px; }
  .product-tags { display:flex; flex-wrap:wrap; gap:4px; margin-top:4px; }
  .product-tag { background:#eef2ff; color:#4f46e5; padding:2px 8px; border-radius:6px; font-size:10px; font-weight:500; }
  .risk-critical { border-left:4px solid #dc2626; }
  .risk-warning { border-left:4px solid #d97706; }
  .risk-info { border-left:4px solid #2563eb; }
  .weather-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(110px,1fr)); gap:8px; }
  .weather-day { background:#f0f9ff; padding:12px 8px; border-radius:10px; text-align:center; border:1px solid #e0f2fe; }
  .weather-day .temp { font-size:20px; font-weight:700; color:#ea580c; }
  .weather-day .label { font-size:11px; color:#64748b; }
  .footer { text-align:center; padding:20px 32px; border-top:1px solid #e5e7eb; color:#94a3b8; font-size:11px; background:#fafafa; }
  @media(max-width:700px) { body{padding:12px;} .content{padding:16px;} .grid,.grid-3{grid-template-columns:1fr;} .weather-grid{grid-template-columns:repeat(3,1fr);} }
</style></head><body>
<div class="report-wrap">
  <div class="header-band">
    <div class="header-brand"><div class="header-logo">F</div><span>Forecastify</span></div>
    <h1>Demand Spike Analysis</h1>
    <p>${d.storeName} &middot; ${d.storeCategory}</p>
  </div>
  <div class="meta-row">
    <div class="meta-item"><strong>Location:</strong> ${d.loc}</div>
    <div class="meta-item"><strong>Weather:</strong> ${weather?.current?.temp || "--"}°C, ${weather?.current?.description || "--"}</div>
    <div class="meta-item"><strong>Generated:</strong> ${d.date}</div>
  </div>
  <div class="content">
    <div class="summary-box"><strong>Summary:</strong> ${analysis?.summary || ""}</div>

    ${weather ? `<div class="section"><div class="section-title">7-Day Weather</div><div class="weather-grid">${d.weatherForecastHTML}</div></div>` : ""}
    <div class="section"><div class="section-title">Demand Spike Forecast</div><table><thead><tr><th>Day</th><th>Probability</th><th>Increase</th><th>Reason</th><th>Top Products</th></tr></thead><tbody>${d.spikesTable}</tbody></table></div>
    <div class="section"><div class="section-title">Trending Products</div><table><thead><tr><th>Product</th><th>Category</th><th>Score</th><th>Stock</th><th>Price</th><th>Reason</th></tr></thead><tbody>${d.productsTable}</tbody></table></div>
    ${analysis?.weatherImpact ? `<div class="section"><div class="section-title">Weather Impact</div><div class="card"><h4>Severity: <span class="badge badge-${analysis.weatherImpact.severity?.toLowerCase()}">${analysis.weatherImpact.severity}</span></h4><p style="margin-top:6px">${analysis.weatherImpact.description}</p><p style="margin-top:6px"><strong>Affected:</strong> ${analysis.weatherImpact.affectedCategories?.join(", ")}</p></div></div>` : ""}
    ${analysis?.upcomingOffers?.length ? `<div class="section"><div class="section-title">Offers & Events</div><div class="grid">${d.offersSection}</div></div>` : ""}
    ${analysis?.inventoryRecommendations?.length ? `<div class="section"><div class="section-title">Inventory Recommendations</div><div class="grid-3">${d.inventoryCards}</div></div>` : ""}
    ${analysis?.riskAlerts?.length ? `<div class="section"><div class="section-title">Risk Alerts</div><div class="grid">${d.riskCards}</div></div>` : ""}
  </div>
  <div class="footer">Forecastify &middot; AI-Powered Demand Forecasting &middot; &copy; ${new Date().getFullYear()} &middot; Powered by Groq AI</div>
</div>
</body></html>`;
  };

  const downloadPDF = () => {
    if (!analysis) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(buildPDFHTML());
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const downloadHTML = () => {
    if (!analysis) return;
    const storeName = storeProfile?.store_name || "Store";
    const blob = new Blob([buildWebHTML()], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `demand-analysis-${storeName.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const spikeChartData = analysis?.demandSpikes?.map((s) => ({
    name: s.dayName?.substring(0, 3),
    probability: s.spikeProbability,
    increase: parseInt(s.expectedIncrease?.replace(/[^0-9]/g, "")) || 0,
  })) || [];

  const productRadarData = analysis?.trendingProducts?.slice(0, 6).map((p) => ({
    name: p.name.length > 12 ? p.name.substring(0, 12) + "..." : p.name,
    score: p.demandScore,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-500" />
            Demand Spike Analysis
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered demand prediction using real-time weather, events, and market data
          </p>
        </div>
        <div className="flex gap-2">
          {analysis && (
            <>
              <button onClick={downloadPDF} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-500/20 text-sm font-medium">
                <FileText className="w-4 h-4" /> PDF
              </button>
              <button onClick={downloadHTML} className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-500/20 text-sm font-medium">
                <Code className="w-4 h-4" /> HTML
              </button>
            </>
          )}
          <button
            onClick={runAnalysis}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 disabled:opacity-50 text-sm font-semibold"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {loading ? step || "Analyzing..." : analysis ? "Re-analyze" : "Run Analysis"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 text-danger rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      {/* Store & Location Info */}
      {(storeProfile || locationInfo) && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <ShoppingBag className="w-4 h-4" /> Store
            </div>
            <p className="font-semibold text-foreground">{storeProfile?.store_name || "Not set"}</p>
            <p className="text-sm text-muted-foreground">{storeProfile?.store_category || ""}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <MapPin className="w-4 h-4" /> Location
            </div>
            <p className="font-semibold text-foreground text-sm">
              {locationInfo?.formattedAddress || storeProfile?.store_address || "Run analysis to detect"}
            </p>
          </div>
          {weather && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Cloud className="w-4 h-4" /> Current Weather
              </div>
              <p className="font-semibold text-foreground">{weather.current.temp}°C — {weather.current.description}</p>
              <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1"><Droplets className="w-3 h-3" />{weather.current.humidity}%</span>
                <span className="flex items-center gap-1"><Wind className="w-3 h-3" />{weather.current.windSpeed} m/s</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <Zap className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">{step}</p>
            <p className="text-sm text-muted-foreground mt-1">This may take a few seconds...</p>
          </div>
          <div className="flex gap-2 mt-2">
            {["Location", "Weather", "News", "AI Analysis"].map((s, i) => (
              <div key={s} className={`px-3 py-1 rounded-full text-xs font-medium ${
                step.toLowerCase().includes(s.toLowerCase().split(" ")[0].toLowerCase())
                  ? "bg-primary text-primary-foreground"
                  : i < ["location", "weather", "news", "ai"].findIndex(x => step.toLowerCase().includes(x))
                    ? "bg-green-500/20 text-green-600"
                    : "bg-secondary text-muted-foreground"
              }`}>
                {s}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report content */}
      {analysis && (
        <div ref={reportRef} className="space-y-6">
          {/* Summary */}
          <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 rounded-xl p-5">
            <h3 className="font-semibold text-foreground flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-yellow-500" /> Executive Summary
            </h3>
            <p className="text-foreground/80">{analysis.summary}</p>
            {generatedAt && (
              <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Generated: {new Date(generatedAt).toLocaleString("en-IN")}
              </p>
            )}
          </div>

          {/* Weather Forecast + Spike Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weather Forecast */}
            {weather && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                  <Thermometer className="w-4 h-4 text-orange-500" /> 7-Day Weather Forecast
                </h3>
                <div className="space-y-2">
                  {weather.forecast.map((d) => (
                    <div key={d.date} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <span className="font-medium text-sm text-foreground">{new Date(d.date).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })}</span>
                        <span className="text-xs text-muted-foreground ml-2">{d.weather}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-orange-500 font-medium">{d.maxTemp}°</span>
                        <span className="text-blue-500">{d.minTemp}°</span>
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Droplets className="w-3 h-3" />{d.avgHumidity}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Spike Probability Chart */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-indigo-500" /> Demand Spike Probability
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={spikeChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px" }}
                  />
                  <Bar dataKey="probability" name="Spike %" radius={[6, 6, 0, 0]}>
                    {spikeChartData.map((_, i) => (
                      <Cell key={i} fill={SPIKE_COLORS[i % SPIKE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Demand Spikes Table */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-yellow-500" /> 7-Day Demand Spike Forecast
            </h3>
            <div className="space-y-2">
              {analysis.demandSpikes?.map((spike, i) => (
                <div key={i} className="border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedSpike(expandedSpike === i ? null : i)}
                    className="w-full flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm text-white" style={{ background: SPIKE_COLORS[i % SPIKE_COLORS.length] }}>
                        {spike.dayName?.substring(0, 2)}
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-foreground">{spike.dayName} <span className="text-xs text-muted-foreground ml-1">{spike.day}</span></p>
                        <p className="text-xs text-muted-foreground">{spike.reason}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-green-500 font-semibold">
                          <ArrowUpRight className="w-4 h-4" />{spike.expectedIncrease}
                        </div>
                        <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden mt-1">
                          <div className="h-full rounded-full" style={{ width: `${spike.spikeProbability}%`, background: SPIKE_COLORS[i % SPIKE_COLORS.length] }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{spike.spikeProbability}% probability</span>
                      </div>
                      {expandedSpike === i ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </button>
                  {expandedSpike === i && (
                    <div className="px-4 pb-4 border-t border-border pt-3">
                      <p className="text-sm text-muted-foreground mb-2">Top products to stock:</p>
                      <div className="flex flex-wrap gap-2">
                        {spike.topProducts?.map((p, j) => (
                          <span key={j} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Trending Products + Radar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-purple-500" /> Trending Products
                </h3>
                <button onClick={() => setShowAllProducts(!showAllProducts)} className="text-xs text-primary hover:underline">
                  {showAllProducts ? "Show Less" : "Show All"}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">Product</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Category</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Demand</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Stock</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showAllProducts ? analysis.trendingProducts : analysis.trendingProducts?.slice(0, 6))?.map((p, i) => (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-secondary/30">
                        <td className="py-3">
                          <p className="font-medium text-foreground">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.reason}</p>
                        </td>
                        <td className="py-3 text-muted-foreground">{p.category}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-purple-500" style={{ width: `${p.demandScore}%` }} />
                            </div>
                            <span className="text-xs font-medium">{p.demandScore}</span>
                          </div>
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            p.recommendedStock === "High" ? "bg-red-500/10 text-red-500" :
                            p.recommendedStock === "Medium" ? "bg-yellow-500/10 text-yellow-600" :
                            "bg-green-500/10 text-green-500"
                          }`}>{p.recommendedStock}</span>
                        </td>
                        <td className="py-3 text-muted-foreground">{p.priceRange}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Radar Chart */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground text-sm mb-4">Product Demand Radar</h3>
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={productRadarData}>
                  <PolarGrid stroke="var(--color-border)" />
                  <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                  <PolarRadiusAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                  <Radar name="Demand" dataKey="score" stroke="#a855f7" fill="#a855f7" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Weather Impact */}
          {analysis.weatherImpact && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                <Cloud className="w-4 h-4 text-blue-500" /> Weather Impact Analysis
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      analysis.weatherImpact.severity === "High" ? "bg-red-500/10 text-red-500" :
                      analysis.weatherImpact.severity === "Medium" ? "bg-yellow-500/10 text-yellow-600" :
                      "bg-green-500/10 text-green-500"
                    }`}>{analysis.weatherImpact.severity} Impact</span>
                  </div>
                  <p className="text-sm text-foreground/80">{analysis.weatherImpact.description}</p>
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-1">Affected Categories:</p>
                    <div className="flex flex-wrap gap-1">
                      {analysis.weatherImpact.affectedCategories?.map((c, i) => (
                        <span key={i} className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded text-xs">{c}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Recommendations:</p>
                  <ul className="space-y-2">
                    {analysis.weatherImpact.recommendations?.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                        <ArrowUpRight className="w-4 h-4 text-green-500 shrink-0 mt-0.5" /> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Offers & Events */}
          {analysis.upcomingOffers?.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                <Tag className="w-4 h-4 text-pink-500" /> Upcoming Offers & Events
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysis.upcomingOffers.map((o, i) => (
                  <div key={i} className="border border-border rounded-lg p-4 hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-foreground flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-indigo-500" /> {o.event}
                      </h4>
                      <span className="text-green-500 font-bold text-sm">{o.expectedDemandChange}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{o.date}</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {o.affectedCategories?.map((c, j) => (
                        <span key={j} className="px-2 py-0.5 bg-pink-500/10 text-pink-600 dark:text-pink-400 rounded text-xs">{c}</span>
                      ))}
                    </div>
                    <ul className="space-y-1">
                      {o.recommendations?.map((r, j) => (
                        <li key={j} className="text-xs text-foreground/70 flex items-start gap-1">
                          <span className="text-green-500">+</span> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Inventory Recommendations */}
          {analysis.inventoryRecommendations?.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                <Package className="w-4 h-4 text-cyan-500" /> Inventory Recommendations
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {analysis.inventoryRecommendations.map((r, i) => (
                  <div key={i} className="border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-foreground text-sm">{r.product}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.urgency === "High" ? "bg-red-500/10 text-red-500" :
                        r.urgency === "Medium" ? "bg-yellow-500/10 text-yellow-600" :
                        "bg-green-500/10 text-green-500"
                      }`}>{r.urgency}</span>
                    </div>
                    <div className="flex items-center gap-1 mb-1">
                      {r.action === "Increase" ? (
                        <ArrowUpRight className="w-3 h-3 text-red-500" />
                      ) : r.action === "Decrease" ? (
                        <ArrowDownRight className="w-3 h-3 text-green-500" />
                      ) : null}
                      <span className="text-xs font-semibold text-foreground">{r.action}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{r.currentAdvice}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk Alerts */}
          {analysis.riskAlerts?.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                <ShieldAlert className="w-4 h-4 text-red-500" /> Risk Alerts
              </h3>
              <div className="space-y-3">
                {analysis.riskAlerts.map((r, i) => (
                  <div key={i} className={`border rounded-lg p-4 ${
                    r.severity === "critical" ? "border-red-500/30 bg-red-500/5" :
                    r.severity === "warning" ? "border-yellow-500/30 bg-yellow-500/5" :
                    "border-blue-500/30 bg-blue-500/5"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className={`w-4 h-4 ${
                        r.severity === "critical" ? "text-red-500" :
                        r.severity === "warning" ? "text-yellow-500" : "text-blue-500"
                      }`} />
                      <span className="font-semibold text-sm text-foreground capitalize">{r.type.replace(/_/g, " ")}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.severity === "critical" ? "bg-red-500/10 text-red-500" :
                        r.severity === "warning" ? "bg-yellow-500/10 text-yellow-600" :
                        "bg-blue-500/10 text-blue-500"
                      }`}>{r.severity}</span>
                    </div>
                    <p className="text-sm text-foreground/80">{r.message}</p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-start gap-1">
                      <ArrowUpRight className="w-3 h-3 mt-0.5 shrink-0" /> {r.mitigation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* News & Market Intel */}
          {news && (news.offers?.length > 0 || news.trending?.length > 0) && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                <Download className="w-4 h-4 text-green-500" /> Market Intelligence
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {news.offers?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Offers & Deals</p>
                    <ul className="space-y-2">
                      {news.offers.slice(0, 4).map((n, i) => (
                        <li key={i} className="text-sm">
                          <a href={n.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">{n.title}</a>
                          <p className="text-xs text-muted-foreground mt-0.5">{n.snippet}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {news.trending?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Trending</p>
                    <ul className="space-y-2">
                      {news.trending.slice(0, 4).map((n, i) => (
                        <li key={i} className="text-sm">
                          <a href={n.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">{n.title}</a>
                          <p className="text-xs text-muted-foreground mt-0.5">{n.snippet}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && !analysis && (
        <div className="bg-card border border-border rounded-xl p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center">
            <Zap className="w-10 h-10 text-indigo-500" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Ready to Analyze</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Click &quot;Run Analysis&quot; to detect your location, fetch real-time weather and market data, and generate AI-powered demand predictions.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
            {["Location Detection", "Weather Data", "Festival Calendar", "News & Offers", "AI Predictions"].map((f) => (
              <span key={f} className="px-3 py-1.5 bg-secondary rounded-full">{f}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
