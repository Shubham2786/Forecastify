/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Clock,
  AlertTriangle,
  Trash2,
  DollarSign,
  Calendar,
  TrendingDown,
  Percent,
  Loader2,
} from "lucide-react";

interface RiskProduct {
  productName: string;
  category: string;
  quantity: number;
  expiryDate: string;
  daysUntilExpiry: number;
  dailyDemand: number;
  unitsSelledBeforeExpiry: number;
  wasteUnits: number;
  wastePercentage: number;
  riskLevel: string;
  suggestedMarkdown: number;
  potentialLoss: number;
  price: number;
}

interface Summary {
  totalAtRisk: number;
  totalPotentialLoss: number;
  avgWastePercent: number;
  expiringThisWeek: number;
  potentialSavings: number;
  totalProducts: number;
}

const RISK_COLORS: Record<string, { bg: string; text: string; dot: string; border: string; row: string }> = {
  critical: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    dot: "bg-red-500",
    border: "border-red-500/30",
    row: "bg-red-500/5",
  },
  high: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    dot: "bg-amber-500",
    border: "border-amber-500/30",
    row: "bg-amber-500/5",
  },
  medium: {
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    dot: "bg-yellow-500",
    border: "border-yellow-500/30",
    row: "bg-yellow-500/5",
  },
  low: {
    bg: "bg-green-500/10",
    text: "text-green-400",
    dot: "bg-green-500",
    border: "border-green-500/30",
    row: "bg-green-500/5",
  },
};

export default function ExpiryRiskPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<RiskProduct[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function fetchData() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/expiry-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setProducts(data.products || []);
      setSummary(data.summary || null);
    } catch (err: any) {
      setError(err.message || "Failed to load expiry risk data");
    } finally {
      setLoading(false);
    }
  }

  // Group products by week for timeline
  function getTimelineWeeks() {
    const weeks: { label: string; products: RiskProduct[] }[] = [];
    const weekLabels = ["This Week (0-7 days)", "Next Week (8-14 days)", "Week 3 (15-21 days)", "Week 4 (22-30 days)"];
    const weekRanges = [
      [0, 7],
      [8, 14],
      [15, 21],
      [22, 30],
    ];

    weekRanges.forEach(([min, max], i) => {
      const weekProducts = products.filter(
        (p) => p.daysUntilExpiry >= min && p.daysUntilExpiry <= max
      );
      if (weekProducts.length > 0) {
        weeks.push({ label: weekLabels[i], products: weekProducts });
      }
    });

    return weeks;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="text-muted-foreground text-sm">Analyzing expiry risk...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-card border border-border rounded-xl p-6 text-center max-w-md">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-400 font-medium">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const timelineWeeks = getTimelineWeeks();

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Clock className="w-7 h-7 text-indigo-400" />
          Expiry Risk Analysis
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track product expiry dates and minimize waste with smart markdown suggestions
        </p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <span className="text-sm text-muted-foreground">Products at Risk</span>
            </div>
            <p className="text-3xl font-bold">{summary.totalAtRisk}</p>
            <p className="text-xs text-muted-foreground mt-1">
              out of {summary.totalProducts} with expiry dates
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <DollarSign className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-sm text-muted-foreground">Potential Waste Loss</span>
            </div>
            <p className="text-3xl font-bold text-red-400">
              ₹{summary.totalPotentialLoss.toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">if no action is taken</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Percent className="w-5 h-5 text-yellow-400" />
              </div>
              <span className="text-sm text-muted-foreground">Average Waste %</span>
            </div>
            <p className="text-3xl font-bold">{summary.avgWastePercent}%</p>
            <p className="text-xs text-muted-foreground mt-1">across all tracked products</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-indigo-500/10">
                <Calendar className="w-5 h-5 text-indigo-400" />
              </div>
              <span className="text-sm text-muted-foreground">Expiring This Week</span>
            </div>
            <p className="text-3xl font-bold text-amber-400">{summary.expiringThisWeek}</p>
            <p className="text-xs text-muted-foreground mt-1">products in next 7 days</p>
          </div>
        </div>
      )}

      {/* Risk Timeline */}
      {timelineWeeks.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-indigo-400" />
            Risk Timeline (Next 30 Days)
          </h2>
          <div className="space-y-5">
            {timelineWeeks.map((week) => (
              <div key={week.label}>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  {week.label}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {week.products.map((product, idx) => {
                    const colors = RISK_COLORS[product.riskLevel] || RISK_COLORS.low;
                    return (
                      <div
                        key={`${product.productName}-${idx}`}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${colors.bg} ${colors.border}`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                        <span className="text-sm font-medium">{product.productName}</span>
                        <span className={`text-xs ${colors.text}`}>
                          {product.daysUntilExpiry}d
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-border">
            {Object.entries(RISK_COLORS).map(([level, colors]) => (
              <div key={level} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                <span className="text-xs text-muted-foreground capitalize">{level}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product Risk Table */}
      {products.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              Product Risk Details
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium text-right">Stock</th>
                  <th className="px-4 py-3 font-medium">Expiry Date</th>
                  <th className="px-4 py-3 font-medium text-right">Days Left</th>
                  <th className="px-4 py-3 font-medium text-right">Daily Demand</th>
                  <th className="px-4 py-3 font-medium text-right">Will Sell</th>
                  <th className="px-4 py-3 font-medium text-right">Waste Units</th>
                  <th className="px-4 py-3 font-medium text-right">Waste %</th>
                  <th className="px-4 py-3 font-medium text-center">Risk Level</th>
                  <th className="px-4 py-3 font-medium text-right">Suggested Action</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product, idx) => {
                  const colors = RISK_COLORS[product.riskLevel] || RISK_COLORS.low;
                  return (
                    <tr
                      key={`${product.productName}-${idx}`}
                      className={`border-b border-border/50 ${colors.row} hover:bg-white/5 transition-colors`}
                    >
                      <td className="px-4 py-3 font-medium">{product.productName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{product.category}</td>
                      <td className="px-4 py-3 text-right">{product.quantity} {product.unit || "pcs"}</td>
                      <td className="px-4 py-3">{formatDate(product.expiryDate)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={colors.text}>
                          {product.daysUntilExpiry < 0 ? "Expired" : `${product.daysUntilExpiry}d`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{product.dailyDemand}</td>
                      <td className="px-4 py-3 text-right">{product.unitsSelledBeforeExpiry}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={product.wasteUnits > 0 ? "text-red-400" : "text-green-400"}>
                          {product.wasteUnits}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={product.wastePercentage > 30 ? "text-red-400" : "text-muted-foreground"}>
                          {product.wastePercentage}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                          {product.riskLevel.charAt(0).toUpperCase() + product.riskLevel.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {product.suggestedMarkdown > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 text-xs font-medium">
                            <TrendingDown className="w-3 h-3" />
                            {product.suggestedMarkdown}% off
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">No action</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Waste Impact Summary */}
      {summary && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-green-400" />
            Waste Impact Summary
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                <div>
                  <p className="text-sm text-muted-foreground">Total Potential Loss</p>
                  <p className="text-2xl font-bold text-red-400">
                    ₹{summary.totalPotentialLoss.toLocaleString("en-IN")}
                  </p>
                </div>
                <Trash2 className="w-8 h-8 text-red-400/40" />
              </div>
              <p className="text-xs text-muted-foreground px-1">
                This is the estimated revenue loss if products expire unsold at current demand rates.
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                <div>
                  <p className="text-sm text-muted-foreground">Recoverable with Markdowns</p>
                  <p className="text-2xl font-bold text-green-400">
                    ₹{summary.potentialSavings.toLocaleString("en-IN")}
                  </p>
                </div>
                <TrendingDown className="w-8 h-8 text-green-400/40" />
              </div>
              <p className="text-xs text-muted-foreground px-1">
                Estimated revenue recoverable by applying suggested markdown discounts to at-risk products.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {products.length === 0 && !loading && (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium text-muted-foreground">No products with expiry dates found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add expiry dates to your inventory items to start tracking expiry risk.
          </p>
        </div>
      )}
    </div>
  );
}
