"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Upload, FileText, Camera, Loader2, Package, TrendingUp, ChevronDown,
  ChevronUp, AlertTriangle, CheckCircle2, ArrowUpRight, ShoppingCart,
  X, Zap, Code, Star, Clipboard, DollarSign, Clock,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const COLORS = ["#6366f1", "#a855f7", "#ec4899", "#f59e0b", "#22c55e", "#06b6d4", "#f43f5e", "#8b5cf6"];
const priorityStyle = { High: "bg-red-500/10 text-red-600", Medium: "bg-amber-500/10 text-amber-600", Low: "bg-green-500/10 text-green-600" };

export default function PurchaseListPage() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "review" | "analysis">("upload");
  const [extracting, setExtracting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [weather, setWeather] = useState<any>(null);
  const [fileName, setFileName] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const pos = await new Promise<GeolocationPosition>((r, j) => navigator.geolocation.getCurrentPosition(r, j, { timeout: 10000 }));
        const res = await fetch(`/api/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
        if (res.ok) { const d = await res.json(); setWeather(d.current); }
      } catch {}
    })();
  }, []);

  // Upload file or text
  const handleExtract = async (file?: File) => {
    setExtracting(true);
    setError("");
    try {
      const form = new FormData();
      if (file) { form.append("file", file); setFileName(file.name); }
      else { form.append("text", textInput); setFileName("Manual input"); }

      const res = await fetch("/api/extract-list", { method: "POST", body: form });
      const data = await res.json();
      if (data.products?.length) {
        setProducts(data.products);
        setStep("review");
      } else {
        setError(data.error || "No products found in the file.");
      }
    } catch { setError("Failed to extract products."); }
    finally { setExtracting(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleExtract(file);
  };

  // Remove product from review list
  const removeProduct = (idx: number) => setProducts(p => p.filter((_, i) => i !== idx));

  // Run bulk analysis
  const runAnalysis = async () => {
    if (!user || !products.length) return;
    setAnalyzing(true);
    setError("");
    try {
      const res = await fetch("/api/bulk-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products, userId: user.id, weather }),
      });
      const data = await res.json();
      if (data.analysis) {
        setAnalysis(data);
        setGeneratedAt(data.generatedAt);
        setStep("analysis");
      } else { setError(data.error || "Analysis failed."); }
    } catch { setError("Analysis failed."); }
    finally { setAnalyzing(false); }
  };

  // PDF / HTML export
  const buildReport = (forPrint: boolean) => {
    if (!analysis) return "";
    const a = analysis;
    const date = generatedAt ? new Date(generatedAt).toLocaleString("en-IN") : new Date().toLocaleString("en-IN");

    const rows = a.analysis?.map((p: any, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${p.name}</strong><br/><span style="font-size:10px;color:#888">${p.category}</span></td>
        <td style="text-align:center">${p.requestedQty} ${p.unit}</td>
        <td style="text-align:center">${p.currentInventory} ${p.unit}</td>
        <td style="text-align:center;font-weight:700">${p.weeklyDemand}</td>
        <td style="text-align:center;color:${p.recommendedQty > p.requestedQty ? "#dc2626" : "#16a34a"};font-weight:700">${p.recommendedQty} ${p.unit}</td>
        <td style="text-align:center"><span style="padding:2px 8px;border-radius:8px;font-size:10px;font-weight:600;background:${p.priority === "High" ? "#fee2e2;color:#dc2626" : p.priority === "Medium" ? "#fef3c7;color:#d97706" : "#dcfce7;color:#16a34a"}">${p.priority}</span></td>
        <td style="text-align:right">₹${p.estimatedCost}</td>
      </tr>`).join("") || "";

    const buyFirst = a.buyFirstList?.map((b: string, i: number) => `<li>${i + 1}. ${b}</li>`).join("") || "";

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Purchase Analysis</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:${forPrint ? "Georgia,serif" : "'Segoe UI',system-ui,sans-serif"};color:#1e293b;font-size:${forPrint ? "11px" : "13px"};line-height:1.5;background:#fff;padding:${forPrint ? "0" : "32px"}}
  ${!forPrint ? `.wrap{max-width:960px;margin:0 auto;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);overflow:hidden}` : ""}
  .cover{background:linear-gradient(135deg,#059669,#10b981,#34d399);color:#fff;padding:${forPrint ? "20px 28px;margin:-16mm -16mm 16px -16mm" : "28px 32px"}}
  .cover h1{font-size:${forPrint ? "20px" : "24px"};font-weight:700}
  .cover p{font-size:12px;opacity:.85;margin-top:2px}
  .content{${!forPrint ? "padding:24px 32px" : ""}}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
  .stat{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;text-align:center}
  .stat .val{font-size:${forPrint ? "16px" : "20px"};font-weight:700;color:#059669}
  .stat .lbl{font-size:10px;color:#64748b}
  .section{margin-bottom:16px;${forPrint ? "page-break-inside:avoid" : ""}}
  .section-title{font-size:${forPrint ? "13px" : "15px"};font-weight:700;color:#059669;border-bottom:2px solid #e5e7eb;padding-bottom:4px;margin-bottom:8px}
  table{width:100%;border-collapse:collapse;font-size:${forPrint ? "10px" : "12px"}}
  th{background:#f0fdf4;color:#047857;font-size:9px;text-transform:uppercase;letter-spacing:.5px;padding:6px 8px;text-align:left;border-bottom:2px solid #bbf7d0}
  td{padding:6px 8px;border-bottom:1px solid #e2e8f0}
  tr:nth-child(even){background:#f8fafc}
  .priority-list{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;margin-bottom:16px}
  .priority-list ol{margin-left:18px}
  .priority-list li{margin-bottom:4px}
  .footer{text-align:center;padding:16px;border-top:2px solid #e5e7eb;color:#94a3b8;font-size:10px;margin-top:20px}
</style></head><body>
${!forPrint ? '<div class="wrap">' : ""}
<div class="cover">
  <h1>Purchase List Analysis Report</h1>
  <p>Smart Restock Recommendations | ${date}</p>
</div>
<div class="content">
  <div class="stats">
    <div class="stat"><div class="val">${a.analysis?.length || 0}</div><div class="lbl">Products</div></div>
    <div class="stat"><div class="val">${a.analysis?.filter((p: any) => p.priority === "High").length || 0}</div><div class="lbl">High Priority</div></div>
    <div class="stat"><div class="val">₹${a.totalEstimatedCost || 0}</div><div class="lbl">Est. Total Cost</div></div>
    <div class="stat"><div class="val">${a.analysis?.filter((p: any) => p.recommendedQty > p.requestedQty).length || 0}</div><div class="lbl">Qty Increased</div></div>
  </div>

  <div class="section">
    <div class="section-title">🛒 Buy First — Priority Order</div>
    <div class="priority-list"><ol>${buyFirst}</ol></div>
  </div>

  <div class="section">
    <div class="section-title">📊 Detailed Product Analysis</div>
    <table><thead><tr><th>#</th><th>Product</th><th>Requested</th><th>In Stock</th><th>7-Day Need</th><th>Recommended</th><th>Priority</th><th>Cost</th></tr></thead><tbody>${rows}</tbody></table>
  </div>

  ${a.suggestions?.length ? `<div class="section"><div class="section-title">💡 Suggestions</div><ul style="margin-left:18px">${a.suggestions.map((s: string) => `<li>${s}</li>`).join("")}</ul></div>` : ""}
</div>
<div class="footer">Forecastify — Smart Purchase Analysis | ${date}</div>
${!forPrint ? "</div>" : ""}
</body></html>`;
  };

  const downloadPDF = () => { const w = window.open("", "_blank"); if (!w) return; w.document.write(buildReport(true)); w.document.close(); setTimeout(() => w.print(), 500); };
  const downloadHTML = () => {
    const blob = new Blob([buildReport(false)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `purchase-analysis-${new Date().toISOString().split("T")[0]}.html`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><ShoppingCart className="w-6 h-6 text-emerald-500" /> Smart Purchase List</h1>
          <p className="text-muted-foreground mt-1">Upload your purchase list — get demand-based restock recommendations</p>
        </div>
        {analysis && (
          <div className="flex gap-2">
            <button onClick={downloadPDF} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-500/20 text-sm font-medium"><FileText className="w-4 h-4" /> PDF</button>
            <button onClick={downloadHTML} className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-500/20 text-sm font-medium"><Code className="w-4 h-4" /> HTML</button>
          </div>
        )}
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {["Upload", "Review", "Analysis"].map((s, i) => {
          const stages = ["upload", "review", "analysis"];
          const current = stages.indexOf(step);
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${i <= current ? "bg-emerald-500 text-white" : "bg-secondary text-muted-foreground"}`}>{i + 1}</div>
              <span className={`text-sm font-medium ${i <= current ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
              {i < 2 && <div className={`w-12 h-0.5 ${i < current ? "bg-emerald-500" : "bg-border"}`} />}
            </div>
          );
        })}
      </div>

      {error && <div className="bg-danger/10 border border-danger/20 text-danger rounded-xl px-4 py-3 text-sm">{error}</div>}

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="space-y-4">
          {/* Upload zone */}
          <div className="bg-card border-2 border-dashed border-border rounded-2xl p-8 sm:p-12 text-center hover:border-emerald-500/50 transition-colors">
            <div className="w-16 h-16 mx-auto mb-4 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
              <Upload className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">Upload your purchase list</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Drop a photo of your handwritten list, a PDF, or type it below. We&apos;ll extract products and analyze demand.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mb-6">
              <button onClick={() => fileRef.current?.click()} disabled={extracting}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 disabled:opacity-50">
                {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                Photo / PDF
              </button>
              <button onClick={() => fileRef.current?.click()} disabled={extracting}
                className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-foreground rounded-xl font-semibold hover:bg-muted">
                <FileText className="w-4 h-4" /> Text File
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*,.pdf,.txt" onChange={handleFileChange} className="hidden" />
            <p className="text-xs text-muted-foreground">Supports: JPG, PNG, PDF, TXT</p>
          </div>

          {/* Or type manually */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h4 className="font-semibold text-foreground flex items-center gap-2 mb-3"><Clipboard className="w-4 h-4 text-emerald-500" /> Or type / paste your list</h4>
            <textarea value={textInput} onChange={(e) => setTextInput(e.target.value)}
              placeholder={"Maggi 50 packets ₹14 each\nAmul Butter 20 pcs ₹56\nBisleri 1L 100 bottles ₹20\nTata Salt 30 kg ₹28\nLays 40 packets ₹10"}
              rows={6} className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm font-mono resize-none" />
            <button onClick={() => handleExtract()} disabled={extracting || !textInput.trim()}
              className="mt-3 px-6 py-2.5 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2">
              {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Extract Products
            </button>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Camera, color: "text-emerald-500", bg: "bg-emerald-500/10", title: "OCR Recognition", desc: "Reads handwritten lists from photos using optical character recognition" },
              { icon: TrendingUp, color: "text-purple-500", bg: "bg-purple-500/10", title: "Demand Analysis", desc: "7-day forecast for each product using historic sales and weather data" },
              { icon: Star, color: "text-amber-500", bg: "bg-amber-500/10", title: "Smart Priority", desc: "Tells you what to buy first based on stock urgency and demand level" },
            ].map(f => (
              <div key={f.title} className="bg-card border border-border rounded-xl p-4">
                <div className={`w-9 h-9 rounded-lg ${f.bg} flex items-center justify-center mb-2`}><f.icon className={`w-4 h-4 ${f.color}`} /></div>
                <p className="text-sm font-semibold text-foreground">{f.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Review extracted products */}
      {step === "review" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2"><Package className="w-4 h-4 text-emerald-500" /> Extracted Products ({products.length})</h3>
              <span className="text-xs text-muted-foreground">From: {fileName}</span>
            </div>
            <div className="space-y-2">
              {products.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-xs font-bold text-emerald-600">{i + 1}</div>
                    <div>
                      <p className="font-medium text-foreground text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.category}{p.brand ? ` • ${p.brand}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-foreground">{p.quantity || "?"} {p.unit || "pcs"}</span>
                    {p.price > 0 && <span className="text-sm text-emerald-600 font-medium">₹{p.price}</span>}
                    <button onClick={() => removeProduct(i)} className="text-muted-foreground hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setStep("upload"); setProducts([]); }}
                className="px-4 py-2 bg-secondary text-foreground rounded-xl text-sm font-medium">Back</button>
              <button onClick={runAnalysis} disabled={analyzing || !products.length}
                className="flex-1 px-6 py-2.5 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2">
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                {analyzing ? "Analyzing..." : "Analyze Demand"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Analysis results */}
      {step === "analysis" && analysis && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <Package className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{analysis.analysis?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Products</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <AlertTriangle className="w-5 h-5 text-red-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-red-500">{analysis.analysis?.filter((p: any) => p.priority === "High").length || 0}</p>
              <p className="text-xs text-muted-foreground">High Priority</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <DollarSign className="w-5 h-5 text-green-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">₹{analysis.totalEstimatedCost || 0}</p>
              <p className="text-xs text-muted-foreground">Est. Total Cost</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <ArrowUpRight className="w-5 h-5 text-amber-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-amber-500">{analysis.analysis?.filter((p: any) => p.recommendedQty > p.requestedQty).length || 0}</p>
              <p className="text-xs text-muted-foreground">Qty Increased</p>
            </div>
          </div>

          {/* Buy first */}
          {analysis.buyFirstList?.length > 0 && (
            <div className="bg-gradient-to-r from-emerald-500/10 via-green-500/10 to-teal-500/10 border border-emerald-500/20 rounded-xl p-5">
              <h3 className="font-bold text-foreground flex items-center gap-2 mb-3"><Star className="w-4 h-4 text-amber-500" /> Buy These First</h3>
              <ol className="space-y-2">
                {analysis.buyFirstList.map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-foreground/80">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                    {item}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Product cards with expandable 7-day forecast */}
          <div className="space-y-3">
            {analysis.analysis?.map((p: any, idx: number) => {
              const isExpanded = expandedIdx === idx;
              const chartData = p.dailyForecast?.map((d: any) => ({ name: d.day?.slice(0, 3), sales: d.sales })) || [];
              return (
                <div key={idx} className="bg-card border border-border rounded-xl overflow-hidden">
                  <button onClick={() => setExpandedIdx(isExpanded ? null : idx)} className="w-full text-left p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white" style={{ background: COLORS[idx % COLORS.length] }}>{idx + 1}</div>
                        <div>
                          <p className="font-semibold text-foreground">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">{p.requestedQty}</span>
                            {p.recommendedQty !== p.requestedQty && (
                              <><span className="text-muted-foreground">→</span>
                              <span className={`text-sm font-bold ${p.recommendedQty > p.requestedQty ? "text-red-500" : "text-green-500"}`}>{p.recommendedQty}</span></>
                            )}
                            <span className="text-xs text-muted-foreground">{p.unit}</span>
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityStyle[p.priority as keyof typeof priorityStyle] || priorityStyle.Low}`}>{p.priority}</span>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-border pt-4 space-y-4">
                      {/* Stats row */}
                      <div className="grid grid-cols-4 gap-3">
                        <div className="bg-secondary/50 rounded-lg p-3 text-center">
                          <p className="text-lg font-bold text-foreground">{p.currentInventory}</p>
                          <p className="text-[10px] text-muted-foreground">In Stock</p>
                        </div>
                        <div className="bg-secondary/50 rounded-lg p-3 text-center">
                          <p className="text-lg font-bold text-foreground">{p.weeklyDemand}</p>
                          <p className="text-[10px] text-muted-foreground">7-Day Need</p>
                        </div>
                        <div className="bg-secondary/50 rounded-lg p-3 text-center">
                          <p className="text-lg font-bold text-emerald-500">{p.recommendedQty}</p>
                          <p className="text-[10px] text-muted-foreground">Recommended</p>
                        </div>
                        <div className="bg-secondary/50 rounded-lg p-3 text-center">
                          <p className="text-lg font-bold text-foreground">₹{p.estimatedCost}</p>
                          <p className="text-[10px] text-muted-foreground">Est. Cost</p>
                        </div>
                      </div>

                      {/* 7-day chart */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-2">7-Day Demand Forecast</p>
                        <ResponsiveContainer width="100%" height={160}>
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                            <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} />
                            <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                            <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px" }} />
                            <Bar dataKey="sales" name="Sales" radius={[4, 4, 0, 0]}>
                              {chartData.map((_: any, i: number) => <Cell key={i} fill={COLORS[idx % COLORS.length]} fillOpacity={0.6 + (i * 0.05)} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Adjustment reason */}
                      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-start gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {p.adjustmentReason}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Suggestions */}
          {analysis.suggestions?.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-3"><Zap className="w-4 h-4 text-indigo-500" /> Smart Suggestions</h3>
              <ul className="space-y-2">
                {analysis.suggestions.map((s: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/80"><ArrowUpRight className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />{s}</li>
                ))}
              </ul>
            </div>
          )}

          {/* New analysis button */}
          <div className="text-center">
            <button onClick={() => { setStep("upload"); setProducts([]); setAnalysis(null); setTextInput(""); setFileName(""); }}
              className="px-6 py-2.5 bg-secondary text-foreground rounded-xl font-medium hover:bg-muted flex items-center gap-2 mx-auto">
              <Upload className="w-4 h-4" /> Upload Another List
            </button>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {analyzing && (
        <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center gap-4">
          <div className="relative"><div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" /><ShoppingCart className="w-6 h-6 text-emerald-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" /></div>
          <p className="font-semibold text-foreground">Analyzing {products.length} products...</p>
          <p className="text-sm text-muted-foreground">Checking inventory, historic sales, weather, and upcoming events</p>
        </div>
      )}
    </div>
  );
}
