"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  Search, Loader2, Package, TrendingUp, AlertTriangle, ShoppingBag,
  FileText, Code, ArrowUpRight, ArrowDownRight, Box, DollarSign,
  Calendar, Shield, Zap, RefreshCw, Cloud, MapPin,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const BAR_COLORS = ["#6366f1", "#818cf8", "#a78bfa", "#c084fc", "#e879f9", "#f472b6", "#fb7185"];

export default function ProductAnalysisPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [product, setProduct] = useState<any>(null);
  const [generatedAt, setGeneratedAt] = useState("");
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [weather, setWeather] = useState<any>(null);
  const [weatherForecast, setWeatherForecast] = useState<any[]>([]);
  const [location, setLocation] = useState("");
  const [storeProfile, setStoreProfile] = useState<any>(null);

  // Fetch store profile
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("store_name, store_category, store_size, city, state").eq("id", user.id).single();
      if (data) setStoreProfile(data);
    })();
  }, [user]);

  // Fetch weather on mount
  useEffect(() => {
    (async () => {
      try {
        const pos = await new Promise<GeolocationPosition>((r, j) => navigator.geolocation.getCurrentPosition(r, j, { timeout: 10000 }));
        const [wRes, lRes] = await Promise.all([
          fetch(`/api/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`),
          fetch(`/api/location?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`),
        ]);
        if (wRes.ok) { const d = await wRes.json(); setWeather(d.current); setWeatherForecast(d.forecast || []); }
        if (lRes.ok) { const d = await lRes.json(); setLocation(d.formattedAddress || d.city || ""); }
      } catch {}
    })();
  }, []);

  // Search inventory for suggestions
  const searchInventory = useCallback(async (q: string) => {
    if (!q.trim() || !user) { setSuggestions([]); return; }
    const { data } = await supabase.from("inventory").select("product_name, category, quantity, price, unit")
      .eq("store_id", user.id).ilike("product_name", `%${q}%`).limit(5);
    setSuggestions(data || []);
  }, [user]);

  useEffect(() => {
    const t = setTimeout(() => searchInventory(query), 300);
    return () => clearTimeout(t);
  }, [query, searchInventory]);

  const analyze = async (productName: string) => {
    if (!productName.trim() || !user) return;
    setLoading(true);
    setError("");
    setAnalysis(null);
    setQuery(productName);
    setSuggestions([]);

    try {
      const res = await fetch("/api/product-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: productName.trim(),
          userId: user.id,
          weather,
          weatherForecast,
          location,
          storeCategory: storeProfile?.store_category,
        }),
      });
      const data = await res.json();
      if (data.analysis) {
        setAnalysis(data.analysis);
        setProduct(data.product);
        setGeneratedAt(data.generatedAt);
        if (data.weather) setWeather(data.weather);
        if (data.location) setLocation(data.location);
      } else {
        setError(data.error || "Analysis failed");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); analyze(query); };

  // ---- PDF / HTML ----
  const buildReportHTML = (forPrint: boolean) => {
    if (!analysis) return "";
    const a = analysis;
    const storeName = storeProfile?.store_name || "Store";
    const date = generatedAt ? new Date(generatedAt).toLocaleString("en-IN") : new Date().toLocaleString("en-IN");
    const loc = location || `${storeProfile?.city || ""}, ${storeProfile?.state || ""}`;

    const forecastRows = a.dailyForecast?.map((d: any, i: number) => `
      <tr>
        <td><strong>${d.day}</strong><br/><span style="color:#888;font-size:10px">${d.date || ""}</span></td>
        <td style="text-align:center"><div style="background:linear-gradient(90deg,#6366f1,#a78bfa);height:14px;width:${Math.min(d.predictedSales * 2, 120)}px;border-radius:3px;display:inline-block;vertical-align:middle;margin-right:6px"></div>${d.predictedSales} ${a.unit || "pcs"}</td>
        <td style="text-align:center">${d.confidence}%</td>
        <td style="font-size:11px;color:#555">${d.reason}</td>
      </tr>
    `).join("") || "";

    const riskRows = a.riskFactors?.map((r: any) => `
      <tr>
        <td>${r.risk}</td>
        <td><span class="badge badge-${r.severity?.toLowerCase()}">${r.severity}</span></td>
        <td style="color:#16a34a">${r.mitigation}</td>
      </tr>
    `).join("") || "";

    const recommendations = a.recommendations?.map((r: string) => `<li>${r}</li>`).join("") || "";

    const styles = `<style>
      @page { size: A4; margin: ${forPrint ? "16mm" : "0"}; }
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: ${forPrint ? "'Georgia',serif" : "'Segoe UI',system-ui,sans-serif"}; color:#1e293b; font-size:${forPrint ? "11px" : "13px"}; line-height:1.55; background:#fff; padding:${forPrint ? "0" : "32px 40px"}; }
      ${!forPrint ? `.report-wrap { max-width:900px; margin:0 auto; background:#fff; border-radius:16px; box-shadow:0 4px 24px rgba(0,0,0,0.08); overflow:hidden; }` : ""}
      .cover { background:linear-gradient(135deg,#312e81,#6366f1,#7c3aed); color:#fff; padding:${forPrint ? "20px 28px" : "28px 32px"}; ${forPrint ? "margin:-16mm -16mm 0 -16mm; margin-bottom:16px;" : ""} }
      .cover h1 { font-size:${forPrint ? "20px" : "24px"}; font-weight:700; }
      .cover p { font-size:12px; opacity:0.85; margin-top:2px; }
      .cover-meta { display:flex; gap:16px; margin-top:10px; flex-wrap:wrap; font-size:10px; opacity:0.9; }
      .content { padding:${forPrint ? "0" : "24px 32px"}; }
      .summary { background:#f0f0ff; border-left:4px solid #6366f1; padding:12px 16px; border-radius:8px; margin-bottom:16px; font-size:${forPrint ? "11px" : "13px"}; }
      .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:16px; }
      .stat { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; text-align:center; }
      .stat .val { font-size:${forPrint ? "18px" : "22px"}; font-weight:700; color:#312e81; }
      .stat .lbl { font-size:10px; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-top:2px; }
      .section { margin-bottom:16px; ${forPrint ? "page-break-inside:avoid;" : ""} }
      .section-title { font-size:${forPrint ? "13px" : "15px"}; font-weight:700; color:#312e81; border-bottom:2px solid #e5e7eb; padding-bottom:4px; margin-bottom:8px; }
      table { width:100%; border-collapse:collapse; font-size:${forPrint ? "10.5px" : "12px"}; }
      th { background:#f1f5f9; color:#475569; font-size:${forPrint ? "9px" : "10px"}; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; padding:6px 8px; text-align:left; border-bottom:2px solid #cbd5e1; }
      td { padding:6px 8px; border-bottom:1px solid #e2e8f0; }
      tr:nth-child(even) { background:#f8fafc; }
      .badge { display:inline-block; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:600; }
      .badge-high, .badge-critical { background:#fee2e2; color:#dc2626; }
      .badge-medium, .badge-warning { background:#fef3c7; color:#d97706; }
      .badge-low { background:#dbeafe; color:#2563eb; }
      .badge-none { background:#dcfce7; color:#16a34a; }
      .badge-sufficient { background:#dcfce7; color:#16a34a; }
      .badge-insufficient { background:#fef3c7; color:#d97706; }
      .badge-overstocked { background:#dbeafe; color:#2563eb; }
      .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
      .card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; }
      .card h4 { font-size:12px; font-weight:700; margin-bottom:4px; }
      .card p { font-size:11px; color:#555; }
      ul { margin-left:18px; }
      li { margin-bottom:4px; font-size:${forPrint ? "10.5px" : "12px"}; }
      .footer { text-align:center; padding:16px; border-top:2px solid #e5e7eb; color:#94a3b8; font-size:10px; margin-top:20px; }
    </style>`;

    const urgencyBadge = `<span class="badge badge-${(a.restockUrgency || "none").toLowerCase()}">${a.restockUrgency || "None"}</span>`;
    const statusBadge = `<span class="badge badge-${(a.currentStockStatus || "sufficient").toLowerCase().replace(/ /g,"")}">${a.currentStockStatus}</span>`;

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Product Analysis - ${a.productName}</title>${styles}</head><body>
${!forPrint ? '<div class="report-wrap">' : ""}
<div class="cover">
  <h1>Product Analysis: ${a.productName}</h1>
  <p>${storeName} — 7-Day Demand Forecast Report</p>
  <div class="cover-meta">
    <span>Store: ${storeName}</span>
    <span>Location: ${loc}</span>
    ${weather ? `<span>Weather: ${weather.temp}°C, ${weather.description}</span>` : ""}
    <span>Generated: ${date}</span>
  </div>
</div>
<div class="content">
  <div class="summary"><strong>Summary:</strong> ${a.summary}</div>

  <div class="stats">
    <div class="stat"><div class="val">${a.currentStock} ${a.unit}</div><div class="lbl">Current Stock</div></div>
    <div class="stat"><div class="val">${a.totalPredictedSales} ${a.unit}</div><div class="lbl">7-Day Predicted Sales</div></div>
    <div class="stat"><div class="val">${a.stockRequired} ${a.unit}</div><div class="lbl">Stock Required</div></div>
    <div class="stat"><div class="val" style="color:${a.additionalStockNeeded > 0 ? "#dc2626" : "#16a34a"}">${a.additionalStockNeeded > 0 ? "+" + a.additionalStockNeeded : "0"} ${a.unit}</div><div class="lbl">Additional Needed</div></div>
  </div>

  <div class="grid2" style="margin-bottom:16px">
    <div class="card"><h4>Stock Status</h4><p>${statusBadge} — Urgency: ${urgencyBadge}</p></div>
    <div class="card"><h4>Pricing</h4><p>Current: ₹${a.pricingAdvice?.currentPrice || a.currentPrice} → Suggested: ₹${a.pricingAdvice?.suggestedPrice || a.currentPrice}<br/><span style="font-size:10px;color:#888">${a.pricingAdvice?.reason || ""}</span></p></div>
  </div>

  <div class="section">
    <div class="section-title">7-Day Sales Forecast</div>
    <table><thead><tr><th>Day</th><th style="text-align:center">Predicted Sales</th><th style="text-align:center">Confidence</th><th>Reason</th></tr></thead><tbody>${forecastRows}</tbody></table>
  </div>

  <div class="grid2">
    <div class="section">
      <div class="section-title">Profit Analysis</div>
      <div class="card">
        <p><strong>Est. Revenue:</strong> ₹${a.profitAnalysis?.estimatedRevenue || 0}</p>
        <p><strong>Est. Profit:</strong> ₹${a.profitAnalysis?.estimatedProfit || 0}</p>
        <p><strong>Margin:</strong> ${a.profitAnalysis?.margin || "N/A"}</p>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Competitor Insight</div>
      <div class="card"><p>${a.competitorInsight || "No data"}</p></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Recommendations</div>
    <ul>${recommendations}</ul>
  </div>

  <div class="grid2">
    <div class="section">
      <div class="section-title">Demand Drivers</div>
      <div class="card"><ul>${a.demandDrivers?.map((d: string) => `<li>${d}</li>`).join("") || ""}</ul></div>
    </div>
    <div class="section">
      <div class="section-title">Seasonal Factors</div>
      <div class="card"><ul>${a.seasonalFactors?.map((f: string) => `<li>${f}</li>`).join("") || ""}</ul></div>
    </div>
  </div>

  ${a.riskFactors?.length ? `<div class="section">
    <div class="section-title">Risk Assessment</div>
    <table><thead><tr><th>Risk</th><th>Severity</th><th>Mitigation</th></tr></thead><tbody>${riskRows}</tbody></table>
  </div>` : ""}
</div>
<div class="footer">Forecastify — Product Demand Analysis | &copy; ${new Date().getFullYear()}</div>
${!forPrint ? "</div>" : ""}
</body></html>`;
  };

  const downloadPDF = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(buildReportHTML(true));
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const downloadHTML = () => {
    const blob = new Blob([buildReportHTML(false)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `product-analysis-${(analysis?.productName || "product").replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Chart data
  const chartData = analysis?.dailyForecast?.map((d: any) => ({
    name: d.day?.substring(0, 3),
    sales: d.predictedSales,
    confidence: d.confidence,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Box className="w-6 h-6 text-purple-500" /> Product Analysis
          </h1>
          <p className="text-muted-foreground mt-1">7-day demand forecast for any product</p>
        </div>
        {analysis && (
          <div className="flex gap-2">
            <button onClick={downloadPDF} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-500/20 text-sm font-medium">
              <FileText className="w-4 h-4" /> PDF
            </button>
            <button onClick={downloadHTML} className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-500/20 text-sm font-medium">
              <Code className="w-4 h-4" /> HTML
            </button>
          </div>
        )}
      </div>

      {/* Search */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter product name — e.g. Maggi Noodles, Amul Butter, Coca Cola..."
              className="w-full pl-12 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
          </div>
          <button type="submit" disabled={loading || !query.trim()}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 disabled:opacity-50 font-semibold flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Analyze
          </button>
        </div>

        {/* Suggestions dropdown */}
        {suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-20 overflow-hidden">
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => { setQuery(s.product_name); setSuggestions([]); analyze(s.product_name); }}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 text-left border-b border-border last:border-0">
                <div>
                  <p className="font-medium text-foreground">{s.product_name}</p>
                  <p className="text-xs text-muted-foreground">{s.category}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold text-foreground">{s.quantity} {s.unit}</p>
                  <p className="text-xs text-muted-foreground">₹{s.price}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </form>

      {error && <div className="bg-danger/10 border border-danger/20 text-danger rounded-xl px-4 py-3 text-sm">{error}</div>}

      {/* Loading */}
      {loading && (
        <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
            <Box className="w-6 h-6 text-purple-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="font-semibold text-foreground">Analyzing &quot;{query}&quot;...</p>
          <p className="text-sm text-muted-foreground">Fetching inventory, weather, and generating predictions</p>
        </div>
      )}

      {/* Results */}
      {analysis && !loading && (
        <div className="space-y-6">
          {/* Product header + stats */}
          <div className="bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xl font-bold text-foreground">{analysis.productName}</h2>
                <p className="text-sm text-muted-foreground">{analysis.inInventory ? `In inventory — ${product?.category || ""}` : "Not in inventory"}</p>
              </div>
              <button onClick={() => analyze(query)} className="p-2 text-muted-foreground hover:text-foreground"><RefreshCw className="w-4 h-4" /></button>
            </div>
            <p className="text-foreground/80 text-sm">{analysis.summary}</p>
          </div>

          {/* Weather + Location + Context */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {weather && (
              <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                  <Cloud className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Current Weather</p>
                  <p className="font-semibold text-foreground text-sm">{weather.temp}°C — {weather.description}</p>
                  <p className="text-xs text-muted-foreground">Humidity: {weather.humidity}%</p>
                </div>
              </div>
            )}
            {location && (
              <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Store Location</p>
                  <p className="font-semibold text-foreground text-sm truncate max-w-[220px]">{location}</p>
                  {analysis.locationContext && <p className="text-xs text-muted-foreground">{analysis.locationContext}</p>}
                </div>
              </div>
            )}
            {analysis.weatherSummary && (
              <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 text-cyan-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Weather Impact</p>
                  <p className="font-semibold text-foreground text-sm">{analysis.weatherSummary}</p>
                </div>
              </div>
            )}
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <Package className="w-5 h-5 text-blue-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{analysis.currentStock} <span className="text-sm font-normal text-muted-foreground">{analysis.unit}</span></p>
              <p className="text-xs text-muted-foreground">Current Stock</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <TrendingUp className="w-5 h-5 text-purple-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{analysis.totalPredictedSales} <span className="text-sm font-normal text-muted-foreground">{analysis.unit}</span></p>
              <p className="text-xs text-muted-foreground">7-Day Predicted Sales</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <ShoppingBag className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{analysis.stockRequired} <span className="text-sm font-normal text-muted-foreground">{analysis.unit}</span></p>
              <p className="text-xs text-muted-foreground">Stock Required</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              {analysis.additionalStockNeeded > 0
                ? <ArrowUpRight className="w-5 h-5 text-red-500 mx-auto mb-1" />
                : <ArrowDownRight className="w-5 h-5 text-green-500 mx-auto mb-1" />}
              <p className={`text-2xl font-bold ${analysis.additionalStockNeeded > 0 ? "text-red-500" : "text-green-500"}`}>
                {analysis.additionalStockNeeded > 0 ? "+" : ""}{analysis.additionalStockNeeded} <span className="text-sm font-normal text-muted-foreground">{analysis.unit}</span>
              </p>
              <p className="text-xs text-muted-foreground">Additional Needed</p>
            </div>
          </div>

          {/* Status + Urgency */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Stock Status</p>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                analysis.currentStockStatus === "Sufficient" ? "bg-green-500/10 text-green-600" :
                analysis.currentStockStatus === "Overstocked" ? "bg-blue-500/10 text-blue-600" :
                analysis.currentStockStatus === "Critical" ? "bg-red-500/10 text-red-600" :
                "bg-yellow-500/10 text-yellow-600"
              }`}>{analysis.currentStockStatus}</span>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Restock Urgency</p>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                analysis.restockUrgency === "High" ? "bg-red-500/10 text-red-600" :
                analysis.restockUrgency === "Medium" ? "bg-yellow-500/10 text-yellow-600" :
                analysis.restockUrgency === "None" ? "bg-green-500/10 text-green-600" :
                "bg-blue-500/10 text-blue-600"
              }`}>{analysis.restockUrgency}</span>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Pricing Advice</p>
              <p className="font-semibold text-foreground">
                ₹{analysis.pricingAdvice?.currentPrice} → ₹{analysis.pricingAdvice?.suggestedPrice}
              </p>
              <p className="text-xs text-muted-foreground">{analysis.pricingAdvice?.reason}</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4 text-purple-500" /> Daily Sales Forecast
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px" }} />
                  <Bar dataKey="sales" name="Predicted Sales" radius={[6, 6, 0, 0]}>
                    {chartData.map((_: any, i: number) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-indigo-500" /> Confidence Level
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis domain={[0, 100]} stroke="var(--color-muted-foreground)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px" }} />
                  <Line type="monotone" dataKey="confidence" name="Confidence %" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Forecast table */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-purple-500" /> Detailed 7-Day Forecast
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Day</th>
                  <th className="text-center py-2 text-muted-foreground font-medium">Predicted Sales</th>
                  <th className="text-center py-2 text-muted-foreground font-medium">Confidence</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">Reason</th>
                </tr></thead>
                <tbody>
                  {analysis.dailyForecast?.map((d: any, i: number) => (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-secondary/30">
                      <td className="py-3"><p className="font-medium text-foreground">{d.day}</p><p className="text-xs text-muted-foreground">{d.date}</p></td>
                      <td className="py-3 text-center">
                        <span className="font-bold text-foreground">{d.predictedSales}</span>
                        <span className="text-muted-foreground ml-1">{analysis.unit}</span>
                      </td>
                      <td className="py-3 text-center">
                        <div className="inline-flex items-center gap-2">
                          <div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${d.confidence}%` }} />
                          </div>
                          <span className="text-xs font-medium">{d.confidence}%</span>
                        </div>
                      </td>
                      <td className="py-3 text-sm text-muted-foreground">{d.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Profit + Competitor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                <DollarSign className="w-4 h-4 text-green-500" /> Profit Analysis
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-muted-foreground">Est. Revenue</span><span className="font-bold text-foreground">₹{analysis.profitAnalysis?.estimatedRevenue || 0}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Est. Profit</span><span className="font-bold text-green-500">₹{analysis.profitAnalysis?.estimatedProfit || 0}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Margin</span><span className="font-bold text-foreground">{analysis.profitAnalysis?.margin || "N/A"}</span></div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                <ShoppingBag className="w-4 h-4 text-orange-500" /> Competitor Insight
              </h3>
              <p className="text-sm text-foreground/80">{analysis.competitorInsight || "No data available"}</p>
            </div>
          </div>

          {/* Recommendations + Drivers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-indigo-500" /> Recommendations
              </h3>
              <ul className="space-y-2">
                {analysis.recommendations?.map((r: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                    <ArrowUpRight className="w-4 h-4 text-green-500 shrink-0 mt-0.5" /> {r}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-cyan-500" /> Demand Drivers & Seasonal
              </h3>
              <div className="mb-3">
                <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase">Demand Drivers</p>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.demandDrivers?.map((d: string, i: number) => (
                    <span key={i} className="px-2.5 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full text-xs">{d}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase">Seasonal Factors</p>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.seasonalFactors?.map((f: string, i: number) => (
                    <span key={i} className="px-2.5 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full text-xs">{f}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Risks */}
          {analysis.riskFactors?.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-red-500" /> Risk Assessment
              </h3>
              <div className="space-y-3">
                {analysis.riskFactors.map((r: any, i: number) => (
                  <div key={i} className={`border rounded-lg p-3 ${
                    r.severity === "High" ? "border-red-500/30 bg-red-500/5" :
                    r.severity === "Medium" ? "border-yellow-500/30 bg-yellow-500/5" :
                    "border-blue-500/30 bg-blue-500/5"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className={`w-4 h-4 ${r.severity === "High" ? "text-red-500" : r.severity === "Medium" ? "text-yellow-500" : "text-blue-500"}`} />
                      <span className="font-semibold text-sm text-foreground">{r.risk}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.severity === "High" ? "bg-red-500/10 text-red-500" : r.severity === "Medium" ? "bg-yellow-500/10 text-yellow-600" : "bg-blue-500/10 text-blue-500"
                      }`}>{r.severity}</span>
                    </div>
                    <p className="text-xs text-green-600 dark:text-green-400 flex items-start gap-1">
                      <ArrowUpRight className="w-3 h-3 mt-0.5 shrink-0" /> {r.mitigation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && !analysis && (
        <div className="space-y-6">
          {/* Hero */}
          <div className="bg-gradient-to-br from-purple-500/5 via-indigo-500/5 to-blue-500/5 border border-purple-500/20 rounded-2xl p-8 sm:p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Box className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Product Analysis</h2>
            <p className="text-muted-foreground max-w-lg mx-auto mb-6">
              Enter any product to get a detailed 7-day sales forecast, stock recommendations, pricing strategy, and risk assessment — all based on your real inventory data.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {["Maggi Noodles", "Amul Butter", "Coca Cola", "Tata Salt", "Parle G"].map(p => (
                <button key={p} onClick={() => { setQuery(p); analyze(p); }}
                  className="px-4 py-2 bg-card border border-border hover:border-purple-500/40 hover:shadow-md rounded-xl text-sm text-foreground transition-all">{p}</button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Click any product above or type your own in the search bar</p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-3">
                <TrendingUp className="w-5 h-5 text-purple-500" />
              </div>
              <h4 className="font-semibold text-foreground text-sm mb-1">7-Day Sales Prediction</h4>
              <p className="text-xs text-muted-foreground">Daily predicted sales with confidence percentage, visualized in charts and detailed tables</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-3">
                <Package className="w-5 h-5 text-blue-500" />
              </div>
              <h4 className="font-semibold text-foreground text-sm mb-1">Inventory Gap Analysis</h4>
              <p className="text-xs text-muted-foreground">Compares your current stock against predicted demand — tells you exactly how many units to reorder</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center mb-3">
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <h4 className="font-semibold text-foreground text-sm mb-1">Pricing & Profit</h4>
              <p className="text-xs text-muted-foreground">Smart pricing suggestions with estimated revenue, profit margins, and competitor pricing insights</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center mb-3">
                <Calendar className="w-5 h-5 text-orange-500" />
              </div>
              <h4 className="font-semibold text-foreground text-sm mb-1">Seasonal & Event Impact</h4>
              <p className="text-xs text-muted-foreground">Factors in weather, festivals, weekends, and local events that affect this product&apos;s demand</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center mb-3">
                <Shield className="w-5 h-5 text-red-500" />
              </div>
              <h4 className="font-semibold text-foreground text-sm mb-1">Risk Assessment</h4>
              <p className="text-xs text-muted-foreground">Identifies stockout risks, spoilage concerns, and competition threats with mitigation plans</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-3">
                <FileText className="w-5 h-5 text-cyan-500" />
              </div>
              <h4 className="font-semibold text-foreground text-sm mb-1">Export Reports</h4>
              <p className="text-xs text-muted-foreground">Download your analysis as a professional PDF report or a styled HTML document to share</p>
            </div>
          </div>

          {/* How it works */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-bold text-foreground mb-4">How it works</h3>
            <div className="flex flex-col sm:flex-row gap-4">
              {[
                { step: "1", title: "Search Product", desc: "Type a product name — auto-suggests from your inventory" },
                { step: "2", title: "Fetch Data", desc: "Pulls your inventory stock, weather, and market conditions" },
                { step: "3", title: "Generate Report", desc: "Creates a full 7-day forecast with charts and recommendations" },
              ].map(s => (
                <div key={s.step} className="flex-1 flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-sm shrink-0">{s.step}</div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
