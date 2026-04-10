"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  FlaskConical, Zap, TrendingUp, TrendingDown, Package, AlertTriangle,
  ShieldCheck, Clock, DollarSign, BarChart3, Loader2,
  Sun, CloudRain, PartyPopper, Percent, Truck, ShoppingCart,
  ArrowRight, ChevronDown, ChevronUp, Target, Lightbulb, XCircle,
  CheckCircle2, Minus, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface SimResult {
  scenarioTitle: string;
  summary: string;
  overallImpact: "positive" | "negative" | "mixed";
  revenueChange: { before: number; after: number; changePercent: number };
  demandChange: { before: number; after: number; changePercent: number };
  riskLevel: string;
  confidence: number;
  affectedProducts: any[];
  timeline: any[];
  recommendations: string[];
  risks: string[];
  opportunities: string[];
}

const SCENARIO_TEMPLATES = [
  { id: "festival", icon: PartyPopper, label: "Festival / Holiday", color: "text-pink-500 bg-pink-500/10 border-pink-500/20", placeholder: "e.g. Diwali is in 5 days, how will demand change?", example: "Diwali festival starts in 5 days. How will it affect my store?" },
  { id: "price", icon: Percent, label: "Price Change", color: "text-green-500 bg-green-500/10 border-green-500/20", placeholder: "e.g. I increase milk price by 10%", example: "What if I increase prices of all dairy products by 15%?" },
  { id: "weather", icon: Sun, label: "Weather Change", color: "text-amber-500 bg-amber-500/10 border-amber-500/20", placeholder: "e.g. Heavy rain for next 3 days", example: "What if there is heavy rainfall for the next 5 days?" },
  { id: "supply", icon: Truck, label: "Supply Disruption", color: "text-red-500 bg-red-500/10 border-red-500/20", placeholder: "e.g. Supplier delays delivery by 4 days", example: "What if my main supplier delays delivery by 1 week?" },
  { id: "promo", icon: ShoppingCart, label: "Run a Promotion", color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20", placeholder: "e.g. Buy 1 Get 1 on snacks", example: "What if I run a Buy 2 Get 1 Free offer on all snacks for 3 days?" },
  { id: "competitor", icon: Target, label: "Competitor Action", color: "text-purple-500 bg-purple-500/10 border-purple-500/20", placeholder: "e.g. New store opens nearby", example: "What if a competitor opens a new store 500 meters away?" },
  { id: "heatwave", icon: CloudRain, label: "Extreme Weather", color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20", placeholder: "e.g. Temperature hits 45°C", example: "What if temperature goes above 45°C for the next week?" },
  { id: "custom", icon: FlaskConical, label: "Custom Scenario", color: "text-gray-500 bg-gray-500/10 border-gray-500/20", placeholder: "Describe any scenario...", example: "" },
];

export default function WhatIfPage() {
  const { user } = useAuth();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [scenario, setScenario] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [dataPoints, setDataPoints] = useState(0);
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (result) {
      setAnimateIn(false);
      requestAnimationFrame(() => setAnimateIn(true));
    }
  }, [result]);

  const runSimulation = async () => {
    if (!scenario.trim() || !user) return;
    setLoading(true);
    setResult(null);
    setExpandedProduct(null);
    setShowTimeline(false);
    try {
      const res = await fetch("/api/what-if", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, scenario: scenario.trim() }),
      });
      const data = await res.json();
      if (data.simulation && !data.simulation.error) {
        setResult(data.simulation);
        setDataPoints(data.dataPoints || 0);
      }
    } catch {} finally { setLoading(false); }
  };

  const selectTemplate = (t: typeof SCENARIO_TEMPLATES[0]) => {
    setSelectedTemplate(t.id);
    if (t.example) setScenario(t.example);
    else setScenario("");
  };

  const impactColor = (impact: string) =>
    impact === "positive" ? "text-green-500" : impact === "negative" ? "text-red-500" : "text-amber-500";
  const impactBg = (impact: string) =>
    impact === "positive" ? "from-green-500/5 to-emerald-500/10 border-green-500/20" : impact === "negative" ? "from-red-500/5 to-rose-500/10 border-red-500/20" : "from-amber-500/5 to-yellow-500/10 border-amber-500/20";
  const riskColor = (risk: string) =>
    risk === "critical" ? "bg-red-500" : risk === "high" ? "bg-orange-500" : risk === "medium" ? "bg-amber-500" : "bg-green-500";
  const stockoutColor = (risk: string) =>
    risk === "high" ? "text-red-500 bg-red-500/10" : risk === "medium" ? "text-amber-500 bg-amber-500/10" : risk === "low" ? "text-yellow-500 bg-yellow-500/10" : "text-green-500 bg-green-500/10";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-linear-to-br from-indigo-500/5 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <FlaskConical className="w-5 h-5 text-white" />
              </div>
              What-If Simulator
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
              Simulate real scenarios and see how they impact your store. Powered by your actual sales history and inventory data.
            </p>
          </div>
          {dataPoints > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-600 rounded-full text-xs font-medium">
              <BarChart3 className="w-3.5 h-3.5" /> {dataPoints} data points analyzed
            </div>
          )}
        </div>

        {/* How to use */}
        <div className="mt-4 flex items-start gap-3 bg-card/50 border border-border/50 rounded-xl p-3.5 text-xs text-muted-foreground">
          <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-foreground">How to use:</span> Pick a scenario type below, customize the details, and hit Simulate. The engine uses your <strong>real 30-day sales history</strong> to calculate impact on each product — no guesswork.
          </div>
        </div>
      </div>

      {/* Scenario Templates */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {SCENARIO_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => selectTemplate(t)}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-center group hover:scale-[1.02] ${
              selectedTemplate === t.id
                ? `${t.color} border-2 shadow-md`
                : "bg-card border-border hover:border-indigo-500/30"
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedTemplate === t.id ? "" : "bg-secondary"} transition-all`}>
              <t.icon className={`w-5 h-5 ${selectedTemplate === t.id ? "" : "text-muted-foreground group-hover:text-foreground"}`} />
            </div>
            <span className={`text-xs font-semibold ${selectedTemplate === t.id ? "" : "text-foreground"}`}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="bg-card border border-border rounded-xl p-5">
        <label className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-indigo-500" /> Describe Your Scenario
        </label>
        <div className="flex gap-3">
          <textarea
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runSimulation(); } }}
            placeholder={SCENARIO_TEMPLATES.find((t) => t.id === selectedTemplate)?.placeholder || "Describe a scenario to simulate..."}
            rows={3}
            className="flex-1 px-4 py-3 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
          />
          <button
            onClick={runSimulation}
            disabled={loading || !scenario.trim()}
            className="self-end px-6 py-3 rounded-xl bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
            {loading ? "Simulating..." : "Simulate"}
          </button>
        </div>
      </div>

      {/* Loading Animation */}
      {loading && (
        <div className="bg-card border border-border rounded-2xl p-12 flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
            <FlaskConical className="w-8 h-8 text-indigo-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">Running Simulation...</p>
            <p className="text-xs text-muted-foreground mt-1">Analyzing {dataPoints || "your"} historic sales records against this scenario</p>
          </div>
          <div className="flex gap-1.5 mt-2">
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className={`space-y-5 transition-all duration-500 ${animateIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>

          {/* Impact Banner */}
          <div className={`bg-linear-to-r ${impactBg(result.overallImpact)} border rounded-2xl p-6`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {result.overallImpact === "positive" ? <CheckCircle2 className="w-5 h-5 text-green-500" /> :
                   result.overallImpact === "negative" ? <XCircle className="w-5 h-5 text-red-500" /> :
                   <AlertTriangle className="w-5 h-5 text-amber-500" />}
                  <h3 className={`text-lg font-bold ${impactColor(result.overallImpact)}`}>
                    {result.overallImpact === "positive" ? "Positive Impact" : result.overallImpact === "negative" ? "Negative Impact" : "Mixed Impact"}
                  </h3>
                  <span className={`ml-2 px-2.5 py-0.5 rounded-full text-xs font-bold text-white ${riskColor(result.riskLevel)}`}>
                    {result.riskLevel?.toUpperCase()} RISK
                  </span>
                </div>
                <h4 className="text-base font-semibold text-foreground mb-1">{result.scenarioTitle}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{result.summary}</p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <div className="text-center px-4 py-2 bg-card/80 rounded-xl border border-border/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Confidence</p>
                  <p className={`text-2xl font-bold ${result.confidence >= 75 ? "text-green-500" : result.confidence >= 50 ? "text-amber-500" : "text-red-500"}`}>{result.confidence}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Revenue / Day</p>
                <DollarSign className="w-4 h-4 text-green-500" />
              </div>
              <p className="text-xl font-bold text-foreground">₹{(result.revenueChange?.after || 0).toLocaleString("en-IN")}</p>
              <div className="flex items-center gap-1 mt-1">
                {result.revenueChange?.changePercent >= 0
                  ? <ArrowUpRight className="w-3.5 h-3.5 text-green-500" />
                  : <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />}
                <span className={`text-xs font-semibold ${result.revenueChange?.changePercent >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {result.revenueChange?.changePercent >= 0 ? "+" : ""}{result.revenueChange?.changePercent || 0}%
                </span>
                <span className="text-xs text-muted-foreground ml-1">from ₹{(result.revenueChange?.before || 0).toLocaleString("en-IN")}</span>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Demand / Day</p>
                <TrendingUp className="w-4 h-4 text-indigo-500" />
              </div>
              <p className="text-xl font-bold text-foreground">{result.demandChange?.after || 0} units</p>
              <div className="flex items-center gap-1 mt-1">
                {result.demandChange?.changePercent >= 0
                  ? <ArrowUpRight className="w-3.5 h-3.5 text-green-500" />
                  : <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />}
                <span className={`text-xs font-semibold ${result.demandChange?.changePercent >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {result.demandChange?.changePercent >= 0 ? "+" : ""}{result.demandChange?.changePercent || 0}%
                </span>
                <span className="text-xs text-muted-foreground ml-1">from {result.demandChange?.before || 0}</span>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Products Affected</p>
                <Package className="w-4 h-4 text-purple-500" />
              </div>
              <p className="text-xl font-bold text-foreground">{result.affectedProducts?.length || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {result.affectedProducts?.filter((p: any) => p.stockoutRisk === "high").length || 0} at stockout risk
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Risk Level</p>
                <ShieldCheck className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-3 h-3 rounded-full ${riskColor(result.riskLevel)}`} />
                <p className="text-xl font-bold text-foreground capitalize">{result.riskLevel}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{result.confidence}% confidence</p>
            </div>
          </div>

          {/* Timeline */}
          {result.timeline?.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setShowTimeline(!showTimeline)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/30 transition-colors"
              >
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-500" /> Impact Timeline ({result.timeline.length} days)
                </h3>
                {showTimeline ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              {showTimeline && (
                <div className="px-5 pb-5">
                  <div className="relative">
                    <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-border" />
                    {result.timeline.map((t: any, i: number) => (
                      <div key={i} className="flex gap-4 mb-4 last:mb-0 relative">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 text-xs font-bold text-white ${
                          (t.demandMultiplier || 1) > 1.2 ? "bg-green-500" : (t.demandMultiplier || 1) < 0.9 ? "bg-red-500" : "bg-blue-500"
                        }`}>
                          {t.demandMultiplier ? `${t.demandMultiplier}x` : `D${i+1}`}
                        </div>
                        <div className="flex-1 bg-secondary/30 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-foreground">{t.day}</p>
                            {t.demandMultiplier && (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                t.demandMultiplier > 1 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                              }`}>
                                {t.demandMultiplier > 1 ? "+" : ""}{Math.round((t.demandMultiplier - 1) * 100)}% demand
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{t.event}</p>
                          {t.keyProducts?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {t.keyProducts.map((p: string, j: number) => (
                                <span key={j} className="px-2 py-0.5 bg-indigo-500/10 text-indigo-500 rounded-full text-[10px] font-medium">{p}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Affected Products */}
          {result.affectedProducts?.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                <Package className="w-4 h-4 text-purple-500" /> Affected Products Pipeline
              </h3>
              <div className="space-y-2">
                {result.affectedProducts.map((p: any, i: number) => (
                  <div key={i} className="border border-border rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedProduct(expandedProduct === i ? null : i)}
                      className="w-full flex items-center justify-between p-4 hover:bg-secondary/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                          p.changePercent > 0 ? "bg-green-500/10 text-green-500" : p.changePercent < 0 ? "bg-red-500/10 text-red-500" : "bg-gray-500/10 text-gray-500"
                        }`}>
                          {p.changePercent > 0 ? <TrendingUp className="w-4 h-4" /> : p.changePercent < 0 ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-foreground">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">{p.baselineDemand}/day</span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            <span className={`font-bold ${p.changePercent > 0 ? "text-green-500" : p.changePercent < 0 ? "text-red-500" : "text-foreground"}`}>
                              {p.projectedDemand}/day
                            </span>
                            <span className={`font-semibold ${p.changePercent > 0 ? "text-green-500" : p.changePercent < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                              ({p.changePercent > 0 ? "+" : ""}{p.changePercent}%)
                            </span>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${stockoutColor(p.stockoutRisk)}`}>
                          {p.stockoutRisk === "none" ? "SAFE" : `${p.stockoutRisk?.toUpperCase()} RISK`}
                        </span>
                        {expandedProduct === i ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {expandedProduct === i && (
                      <div className="px-4 pb-4 border-t border-border pt-3 bg-secondary/20">
                        <div className="grid grid-cols-4 gap-3 mb-3">
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase">Current Stock</p>
                            <p className="text-sm font-bold text-foreground">{p.currentStock} units</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase">Baseline Demand</p>
                            <p className="text-sm font-bold text-foreground">{p.baselineDemand}/day</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase">Projected Demand</p>
                            <p className={`text-sm font-bold ${p.changePercent > 0 ? "text-green-500" : p.changePercent < 0 ? "text-red-500" : "text-foreground"}`}>{p.projectedDemand}/day</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase">Days of Stock</p>
                            <p className={`text-sm font-bold ${p.daysOfStock <= 2 ? "text-red-500" : p.daysOfStock <= 5 ? "text-amber-500" : "text-green-500"}`}>{p.daysOfStock} days</p>
                          </div>
                        </div>
                        {/* Stock progress bar */}
                        <div className="mb-3">
                          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                            <span>Stock coverage at projected demand</span>
                            <span>{p.daysOfStock} / 7 days</span>
                          </div>
                          <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${p.daysOfStock <= 2 ? "bg-red-500" : p.daysOfStock <= 5 ? "bg-amber-500" : "bg-green-500"}`}
                              style={{ width: `${Math.min(100, (p.daysOfStock / 7) * 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="bg-card rounded-lg p-3 border border-border">
                          <p className="text-xs text-muted-foreground mb-1"><strong className="text-foreground">Reasoning:</strong> {p.reasoning}</p>
                          <p className="text-xs mt-2"><strong className="text-indigo-500">Action:</strong> <span className="text-foreground">{p.action}</span></p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations, Risks, Opportunities */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {result.recommendations?.length > 0 && (
              <div className="bg-linear-to-br from-indigo-500/5 to-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-indigo-500" /> Recommendations
                </h4>
                <div className="space-y-2">
                  {result.recommendations.map((r: string, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-foreground leading-relaxed">{r}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.risks?.length > 0 && (
              <div className="bg-linear-to-br from-red-500/5 to-red-500/10 border border-red-500/20 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-500" /> Risks
                </h4>
                <div className="space-y-2">
                  {result.risks.map((r: string, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-foreground leading-relaxed">{r}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.opportunities?.length > 0 && (
              <div className="bg-linear-to-br from-green-500/5 to-green-500/10 border border-green-500/20 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-green-500" /> Opportunities
                </h4>
                <div className="space-y-2">
                  {result.opportunities.map((r: string, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-foreground leading-relaxed">{r}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!result && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <div className="w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
            <FlaskConical className="w-10 h-10 opacity-30" />
          </div>
          <p className="text-sm font-medium">Pick a scenario and hit Simulate</p>
          <p className="text-xs mt-1">Results are backed by your real sales data</p>
        </div>
      )}
    </div>
  );
}
