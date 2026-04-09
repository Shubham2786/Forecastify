"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
} from "recharts";
import {
  Search, Loader2, Tag, TrendingUp, TrendingDown, Minus,
  Package, MapPin, Cloud, CheckCircle2, AlertTriangle, ArrowUpRight,
  ShoppingBag, Star, FileText, Code, RefreshCw, Zap, Crown,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const CATEGORIES = [
  "Dairy", "Beverages", "Snacks", "Groceries", "Ice Cream", "Personal Care",
  "Household", "Biscuits", "Chocolates", "Instant Food", "Masala & Spices", "Oils",
];

const COLORS = ["#6366f1", "#a855f7", "#ec4899", "#f59e0b", "#22c55e", "#06b6d4", "#f43f5e", "#8b5cf6"];

const demandBadge = (level: string) => {
  if (level === "High") return "bg-red-500/10 text-red-600 dark:text-red-400";
  if (level === "Medium") return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  return "bg-green-500/10 text-green-600 dark:text-green-400";
};

const DemandIcon = ({ level }: { level: string }) => {
  if (level === "High") return <TrendingUp className="w-3 h-3" />;
  if (level === "Medium") return <Minus className="w-3 h-3" />;
  return <TrendingDown className="w-3 h-3" />;
};

export default function CategoryAnalysisPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [weather, setWeather] = useState<any>(null);
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const pos = await new Promise<GeolocationPosition>((r, j) => navigator.geolocation.getCurrentPosition(r, j, { timeout: 10000 }));
        const [wRes, lRes] = await Promise.all([
          fetch(`/api/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`),
          fetch(`/api/location?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`),
        ]);
        if (wRes.ok) { const d = await wRes.json(); setWeather(d.current); }
        if (lRes.ok) { const d = await lRes.json(); setLocation(d.formattedAddress || d.city || ""); }
      } catch {}
    })();
  }, []);

  const analyze = async (cat: string) => {
    if (!cat.trim() || !user) return;
    setLoading(true);
    setError("");
    setAnalysis(null);
    setQuery(cat);

    try {
      const res = await fetch("/api/category-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: cat.trim(), userId: user.id, weather, location }),
      });
      const data = await res.json();
      if (data.analysis) {
        setAnalysis(data.analysis);
        setGeneratedAt(data.generatedAt);
        if (data.location) setLocation(data.location);
      } else {
        setError(data.error || "Analysis failed");
      }
    } catch { setError("Something went wrong."); }
    finally { setLoading(false); }
  };

  // Charts
  const brandChartData = analysis?.topBrands?.map((b: any) => ({ name: b.brand, popularity: b.popularity })) || [];
  const productDemandData = analysis?.products?.slice(0, 8).map((p: any) => ({ name: p.name?.length > 15 ? p.name.slice(0, 15) + "..." : p.name, demand: p.weeklyDemand || p.dailyDemand * 7 })) || [];

  // PDF/HTML
  const buildReport = (forPrint: boolean) => {
    if (!analysis) return "";
    const a = analysis;
    const date = generatedAt ? new Date(generatedAt).toLocaleString("en-IN") : new Date().toLocaleString("en-IN");
    const brandRows = a.topBrands?.map((b: any) => `<tr><td><strong>${b.brand}</strong></td><td>${b.popularity}/100</td><td>${b.marketShare}</td><td>${b.priceRange}</td><td style="font-size:11px">${b.reason}</td></tr>`).join("") || "";
    const prodRows = a.products?.map((p: any) => `<tr><td><strong>${p.name}</strong></td><td>${p.brand}</td><td><span style="padding:2px 8px;border-radius:8px;font-size:10px;font-weight:600;background:${p.demandLevel === "High" ? "#fee2e2;color:#dc2626" : p.demandLevel === "Medium" ? "#fef3c7;color:#d97706" : "#dcfce7;color:#16a34a"}">${p.demandLevel}</span></td><td>${p.dailyDemand}/day</td><td>₹${p.suggestedPrice}</td><td>${p.inMyInventory ? "✅ " + p.myStock + " " + (p.myUnit || "") : "❌ Not stocked"}</td><td>${p.margin}</td></tr>`).join("") || "";

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Category Analysis - ${a.category}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:${forPrint ? "Georgia,serif" : "'Segoe UI',system-ui,sans-serif"};color:#1e293b;font-size:${forPrint ? "11px" : "13px"};line-height:1.5;padding:${forPrint ? "0" : "32px"};background:#fff}
.cover{background:linear-gradient(135deg,#6d28d9,#7c3aed,#a855f7);color:#fff;padding:${forPrint ? "20px 28px" : "28px 32px"};${forPrint ? "margin:-16mm -16mm 16px -16mm" : "border-radius:16px 16px 0 0"}}
.cover h1{font-size:${forPrint ? "20px" : "24px"};font-weight:700}.cover p{font-size:12px;opacity:.85;margin-top:2px}
.content{${!forPrint ? "max-width:900px;margin:0 auto;background:#fff;border-radius:0 0 16px 16px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:24px 32px" : ""}}
.summary{background:#f5f3ff;border-left:4px solid #7c3aed;padding:12px 16px;border-radius:8px;margin-bottom:16px}
table{width:100%;border-collapse:collapse;font-size:${forPrint ? "10px" : "12px"};margin-top:6px}th{background:#f1f5f9;color:#475569;font-size:9px;text-transform:uppercase;letter-spacing:.5px;padding:6px 8px;text-align:left;border-bottom:2px solid #cbd5e1}td{padding:6px 8px;border-bottom:1px solid #e2e8f0}tr:nth-child(even){background:#f8fafc}
.section{margin-bottom:16px;${forPrint ? "page-break-inside:avoid" : ""}}.section-title{font-size:${forPrint ? "13px" : "15px"};font-weight:700;color:#6d28d9;border-bottom:2px solid #e5e7eb;padding-bottom:4px;margin-bottom:8px}
.footer{text-align:center;padding:16px;border-top:2px solid #e5e7eb;color:#94a3b8;font-size:10px;margin-top:20px}
</style></head><body>
<div class="cover"><h1>Category Analysis: ${a.category}</h1><p>${location} | ${date}</p></div>
<div class="content">
<div class="summary"><strong>Summary:</strong> ${a.summary}</div>
<div class="section"><div class="section-title">Top Brands</div><table><thead><tr><th>Brand</th><th>Popularity</th><th>Market Share</th><th>Price Range</th><th>Why Popular</th></tr></thead><tbody>${brandRows}</tbody></table></div>
<div class="section"><div class="section-title">Product Analysis</div><table><thead><tr><th>Product</th><th>Brand</th><th>Demand</th><th>Daily</th><th>Price</th><th>My Stock</th><th>Margin</th></tr></thead><tbody>${prodRows}</tbody></table></div>
${a.missingProducts?.length ? `<div class="section"><div class="section-title">Products to Consider Adding</div><ul style="margin-left:18px">${a.missingProducts.map((m: string) => `<li>${m}</li>`).join("")}</ul></div>` : ""}
<div class="section"><div class="section-title">Recommendations</div><ul style="margin-left:18px">${a.recommendations?.map((r: string) => `<li>${r}</li>`).join("") || ""}</ul></div>
</div><div class="footer">Forecastify — Category Intelligence Report | ${date}</div></body></html>`;
  };

  const downloadPDF = () => { const w = window.open("", "_blank"); if (!w) return; w.document.write(buildReport(true)); w.document.close(); setTimeout(() => w.print(), 500); };
  const downloadHTML = () => {
    const blob = new Blob([buildReport(false)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `category-${(query || "report").replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.html`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Tag className="w-6 h-6 text-purple-500" /> Category Analysis</h1>
          <p className="text-muted-foreground mt-1">Explore top brands and product demand by category for your region</p>
        </div>
        {analysis && (
          <div className="flex gap-2">
            <button onClick={downloadPDF} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-500/20 text-sm font-medium"><FileText className="w-4 h-4" /> PDF</button>
            <button onClick={downloadHTML} className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-500/20 text-sm font-medium"><Code className="w-4 h-4" /> HTML</button>
          </div>
        )}
      </div>

      {/* Search + Category pills */}
      <div>
        <div className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && analyze(query)}
              placeholder="Search category — e.g. Dairy, Beverages, Snacks..."
              className="w-full pl-12 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
          </div>
          <button onClick={() => analyze(query)} disabled={loading || !query.trim()}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 disabled:opacity-50 font-semibold flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Analyze
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => { setQuery(c); analyze(c); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${query === c ? "bg-purple-500 text-white" : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"}`}>{c}</button>
          ))}
        </div>
      </div>

      {error && <div className="bg-danger/10 border border-danger/20 text-danger rounded-xl px-4 py-3 text-sm">{error}</div>}

      {/* Loading */}
      {loading && (
        <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center gap-4">
          <div className="relative"><div className="w-16 h-16 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" /><Tag className="w-6 h-6 text-purple-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" /></div>
          <p className="font-semibold text-foreground">Analyzing &quot;{query}&quot; category...</p>
          <p className="text-sm text-muted-foreground">Fetching regional brands, historic sales, and market data</p>
        </div>
      )}

      {/* Results */}
      {analysis && !loading && (
        <div className="space-y-6">
          {/* Summary header */}
          <div className="bg-gradient-to-r from-purple-500/10 via-violet-500/10 to-indigo-500/10 border border-purple-500/20 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2"><Tag className="w-5 h-5 text-purple-500" />{analysis.category}</h2>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  {location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-blue-500" />{location}</span>}
                  {weather && <span className="flex items-center gap-1"><Cloud className="w-3.5 h-3.5 text-orange-500" />{weather.temp}°C {weather.description}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${demandBadge(analysis.totalCategoryDemand)}`}>{analysis.totalCategoryDemand} Demand</span>
                <button onClick={() => analyze(query)} className="p-2 text-muted-foreground hover:text-foreground"><RefreshCw className="w-4 h-4" /></button>
              </div>
            </div>
            <p className="text-foreground/80 text-sm">{analysis.summary}</p>
            {analysis.seasonalTrend && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><Zap className="w-3 h-3 text-amber-500" />{analysis.seasonalTrend}</p>}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Brand popularity */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4"><Crown className="w-4 h-4 text-amber-500" /> Top Brands by Popularity</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={brandChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" domain={[0, 100]} stroke="var(--color-muted-foreground)" fontSize={11} />
                  <YAxis type="category" dataKey="name" width={80} stroke="var(--color-muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px" }} />
                  <Bar dataKey="popularity" name="Popularity" radius={[0, 6, 6, 0]}>
                    {brandChartData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Weekly demand by product */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4"><TrendingUp className="w-4 h-4 text-indigo-500" /> Weekly Demand by Product</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={productDemandData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={10} angle={-25} textAnchor="end" height={60} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px" }} />
                  <Bar dataKey="demand" name="Weekly Units" radius={[6, 6, 0, 0]}>
                    {productDemandData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Brands cards */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4"><Star className="w-4 h-4 text-amber-500" /> Brand Analysis — {analysis.category}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {analysis.topBrands?.map((b: any, i: number) => (
                <div key={i} className="border border-border rounded-xl p-4 hover:shadow-md transition-shadow relative overflow-hidden">
                  {i === 0 && <div className="absolute top-2 right-2 w-6 h-6 bg-amber-500/20 rounded-full flex items-center justify-center"><Crown className="w-3 h-3 text-amber-500" /></div>}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white" style={{ background: COLORS[i % COLORS.length] }}>
                      {b.brand?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">{b.brand}</p>
                      <p className="text-xs text-muted-foreground">{b.marketShare} market share</p>
                    </div>
                  </div>
                  <div className="mb-2">
                    <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Popularity</span><span className="font-medium text-foreground">{b.popularity}/100</span></div>
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${b.popularity}%`, background: COLORS[i % COLORS.length] }} /></div>
                  </div>
                  <p className="text-xs text-muted-foreground">{b.priceRange}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{b.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Products table */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4"><Package className="w-4 h-4 text-purple-500" /> Product-wise Demand Analysis</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium text-xs">Product</th>
                  <th className="text-left py-2 text-muted-foreground font-medium text-xs">Brand</th>
                  <th className="text-center py-2 text-muted-foreground font-medium text-xs">Demand</th>
                  <th className="text-center py-2 text-muted-foreground font-medium text-xs">Daily</th>
                  <th className="text-center py-2 text-muted-foreground font-medium text-xs">Weekly</th>
                  <th className="text-right py-2 text-muted-foreground font-medium text-xs">Price</th>
                  <th className="text-center py-2 text-muted-foreground font-medium text-xs">My Stock</th>
                  <th className="text-center py-2 text-muted-foreground font-medium text-xs">Status</th>
                  <th className="text-right py-2 text-muted-foreground font-medium text-xs">Margin</th>
                </tr></thead>
                <tbody>
                  {analysis.products?.map((p: any, i: number) => (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-secondary/30">
                      <td className="py-3"><p className="font-medium text-foreground">{p.name}</p><p className="text-[10px] text-muted-foreground">{p.reason}</p></td>
                      <td className="py-3 text-muted-foreground text-xs">{p.brand}</td>
                      <td className="py-3 text-center"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${demandBadge(p.demandLevel)}`}><DemandIcon level={p.demandLevel} />{p.demandLevel}</span></td>
                      <td className="py-3 text-center font-semibold text-foreground">{p.dailyDemand}</td>
                      <td className="py-3 text-center text-foreground">{p.weeklyDemand}</td>
                      <td className="py-3 text-right text-foreground">₹{p.suggestedPrice}</td>
                      <td className="py-3 text-center">{p.inMyInventory ? <span className="font-semibold text-foreground">{p.myStock} {p.myUnit}</span> : <span className="text-muted-foreground text-xs">—</span>}</td>
                      <td className="py-3 text-center">
                        {p.stockStatus === "Sufficient" && <span className="text-xs text-green-500 flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3" />OK</span>}
                        {p.stockStatus === "Low" && <span className="text-xs text-amber-500 flex items-center justify-center gap-1"><AlertTriangle className="w-3 h-3" />Low</span>}
                        {(p.stockStatus === "Out of Stock" || p.stockStatus === "Not Stocked") && <span className="text-xs text-red-500 flex items-center justify-center gap-1"><AlertTriangle className="w-3 h-3" />{p.inMyInventory ? "Out" : "Add"}</span>}
                      </td>
                      <td className="py-3 text-right text-foreground font-medium">{p.margin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Missing products + Recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {analysis.missingProducts?.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4"><ShoppingBag className="w-4 h-4 text-pink-500" /> Products to Consider Adding</h3>
                <ul className="space-y-2">
                  {analysis.missingProducts.map((m: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground/80"><ArrowUpRight className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />{m}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4"><Zap className="w-4 h-4 text-indigo-500" /> Recommendations</h3>
              <ul className="space-y-2">
                {analysis.recommendations?.map((r: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/80"><ArrowUpRight className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />{r}</li>
                ))}
              </ul>
              {analysis.competitorInsight && <p className="text-xs text-muted-foreground mt-4 border-t border-border pt-3"><strong>Competitor:</strong> {analysis.competitorInsight}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !analysis && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-purple-500/5 via-violet-500/5 to-indigo-500/5 border border-purple-500/20 rounded-2xl p-8 sm:p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20"><Tag className="w-8 h-8 text-white" /></div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Category Analysis</h2>
            <p className="text-muted-foreground max-w-lg mx-auto mb-6">Select a category to discover top brands in your region, compare product demand, find gaps in your inventory, and get restocking recommendations.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: Crown, color: "text-amber-500", bg: "bg-amber-500/10", title: "Top Regional Brands", desc: "Discover the most popular brands for each category in your city with market share data" },
              { icon: TrendingUp, color: "text-purple-500", bg: "bg-purple-500/10", title: "Product-wise Demand", desc: "See daily and weekly demand for every product with demand level scoring" },
              { icon: ShoppingBag, color: "text-pink-500", bg: "bg-pink-500/10", title: "Inventory Gap Analysis", desc: "Find out which products you should add to capture more sales in your area" },
              { icon: Star, color: "text-indigo-500", bg: "bg-indigo-500/10", title: "Competitor Insights", desc: "Know what other stores in your area stock and how to stay competitive" },
              { icon: Package, color: "text-green-500", bg: "bg-green-500/10", title: "Stock Recommendations", desc: "Exact restock quantities based on demand patterns and your current inventory" },
              { icon: FileText, color: "text-cyan-500", bg: "bg-cyan-500/10", title: "Export Reports", desc: "Download professional PDF or HTML reports to share with your team" },
            ].map(f => (
              <div key={f.title} className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center mb-3`}><f.icon className={`w-5 h-5 ${f.color}`} /></div>
                <h4 className="font-semibold text-foreground text-sm mb-1">{f.title}</h4>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
