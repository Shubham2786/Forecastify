"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  ShoppingCart, Clock, AlertTriangle, Package, Truck, Calendar, DollarSign, Loader2,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const urgencyConfig: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  immediate: { label: "Immediate", bg: "bg-red-500/10", text: "text-red-600", border: "border-red-500/30", dot: "bg-red-500" },
  soon:      { label: "Soon",      bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/30", dot: "bg-amber-500" },
  upcoming:  { label: "Upcoming",  bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-500/30", dot: "bg-blue-500" },
  planned:   { label: "Planned",   bg: "bg-green-500/10", text: "text-green-600", border: "border-green-500/30", dot: "bg-green-500" },
};

export default function ReorderPlannerPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({ reorderNow: 0, totalCost: 0, avgLeadTime: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/reorder-planner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        });
        const data = await res.json();
        if (data.error) { setError(data.error); return; }
        setItems(data.items || []);
        setSummary(data.summary || {});
      } catch { setError("Failed to load reorder data."); }
      finally { setLoading(false); }
    })();
  }, [user?.id]);

  const urgencyCounts = items.reduce((acc: Record<string, number>, i: any) => {
    acc[i.urgency] = (acc[i.urgency] || 0) + 1;
    return acc;
  }, {});

  const reorderSoonCount = (urgencyCounts["immediate"] || 0) + (urgencyCounts["soon"] || 0);
  const reorderItems = items.filter((i: any) => i.needsReorder);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="ml-3 text-gray-400 text-lg">Calculating reorder plan...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-red-400 max-w-md text-center">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ShoppingCart className="w-7 h-7 text-indigo-400" />
          Reorder Planner
        </h1>
        <p className="text-gray-400 mt-1">Smart reorder suggestions based on demand forecasts and lead times</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-linear-to-br from-red-500/10 to-red-900/10 border border-red-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-red-500/20"><AlertTriangle className="w-5 h-5 text-red-400" /></div>
            <span className="text-sm text-gray-400">Reorder Now</span>
          </div>
          <p className="text-3xl font-bold text-red-400">{urgencyCounts["immediate"] || 0}</p>
          <p className="text-xs text-gray-500 mt-1">products need immediate reorder</p>
        </div>
        <div className="bg-linear-to-br from-amber-500/10 to-amber-900/10 border border-amber-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-amber-500/20"><Clock className="w-5 h-5 text-amber-400" /></div>
            <span className="text-sm text-gray-400">Reorder Soon</span>
          </div>
          <p className="text-3xl font-bold text-amber-400">{reorderSoonCount}</p>
          <p className="text-xs text-gray-500 mt-1">products need reorder within 3 days</p>
        </div>
        <div className="bg-linear-to-br from-indigo-500/10 to-indigo-900/10 border border-indigo-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-indigo-500/20"><DollarSign className="w-5 h-5 text-indigo-400" /></div>
            <span className="text-sm text-gray-400">Total Reorder Cost</span>
          </div>
          <p className="text-3xl font-bold text-indigo-400">{"\u20B9"}{summary.totalCost?.toLocaleString("en-IN")}</p>
          <p className="text-xs text-gray-500 mt-1">estimated cost for all reorders</p>
        </div>
        <div className="bg-linear-to-br from-emerald-500/10 to-emerald-900/10 border border-emerald-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-emerald-500/20"><Truck className="w-5 h-5 text-emerald-400" /></div>
            <span className="text-sm text-gray-400">Avg Lead Time</span>
          </div>
          <p className="text-3xl font-bold text-emerald-400">{summary.avgLeadTime} <span className="text-lg font-normal">days</span></p>
          <p className="text-xs text-gray-500 mt-1">average supplier lead time</p>
        </div>
      </div>

      {/* Urgency Breakdown */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <h2 className="text-lg font-semibold text-white mb-3">Urgency Breakdown</h2>
        <div className="flex flex-wrap gap-3">
          {(["immediate", "soon", "upcoming", "planned"] as const).map((u) => {
            const cfg = urgencyConfig[u];
            return (
              <div key={u} className={`flex items-center gap-2 px-4 py-2 rounded-full ${cfg.bg} border ${cfg.border}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                <span className={`font-medium ${cfg.text}`}>{cfg.label}</span>
                <span className={`font-bold ${cfg.text}`}>{urgencyCounts[u] || 0}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reorder Timeline */}
      {reorderItems.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            Reorder Timeline
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {reorderItems.map((item: any, idx: number) => {
              const cfg = urgencyConfig[item.urgency] || urgencyConfig.planned;
              const stockPct = item.reorderPoint > 0 ? Math.min(100, Math.round((item.currentStock / item.reorderPoint) * 100)) : 100;
              return (
                <div key={idx} className={`bg-white/5 border ${cfg.border} rounded-2xl p-5 space-y-3`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-white font-semibold">{item.productName}</h3>
                      <p className="text-gray-400 text-sm">{item.category}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                      {cfg.label}
                    </span>
                  </div>
                  {/* Stock progress */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Current: {item.currentStock} {item.unit}</span>
                      <span>Reorder Point: {item.reorderPoint}</span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${stockPct <= 30 ? "bg-red-500" : stockPct <= 60 ? "bg-amber-500" : "bg-green-500"}`}
                        style={{ width: `${stockPct}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-white/5 rounded-xl px-3 py-2">
                      <p className="text-gray-500 text-xs">Order by</p>
                      <p className="text-white font-medium">{item.reorderDate}</p>
                    </div>
                    <div className="bg-white/5 rounded-xl px-3 py-2">
                      <p className="text-gray-500 text-xs">Suggested Qty</p>
                      <p className="text-white font-medium">{item.orderQuantity} {item.unit}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Est. Cost</span>
                    <span className="text-white font-semibold">{"\u20B9"}{item.estimatedCost.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Product Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-400" />
            All Products ({items.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 text-left">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium text-right">Current Stock</th>
                <th className="px-4 py-3 font-medium text-right">Daily Demand</th>
                <th className="px-4 py-3 font-medium text-right">Lead Time</th>
                <th className="px-4 py-3 font-medium text-right">Reorder Point</th>
                <th className="px-4 py-3 font-medium text-right">Safety Stock</th>
                <th className="px-4 py-3 font-medium text-right">Days Until</th>
                <th className="px-4 py-3 font-medium text-right">Order Qty</th>
                <th className="px-4 py-3 font-medium text-right">Est. Cost</th>
                <th className="px-4 py-3 font-medium text-center">Urgency</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, idx: number) => {
                const cfg = urgencyConfig[item.urgency] || urgencyConfig.planned;
                return (
                  <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{item.productName}</td>
                    <td className="px-4 py-3 text-gray-400">{item.category}</td>
                    <td className="px-4 py-3 text-right text-white">{item.currentStock}</td>
                    <td className="px-4 py-3 text-right text-white">{item.dailyDemand}</td>
                    <td className="px-4 py-3 text-right text-white">{item.leadTimeDays}d</td>
                    <td className="px-4 py-3 text-right text-white">{item.reorderPoint}</td>
                    <td className="px-4 py-3 text-right text-white">{item.safetyStock}</td>
                    <td className="px-4 py-3 text-right text-white">{item.daysUntilReorder}d</td>
                    <td className="px-4 py-3 text-right text-white font-medium">{item.orderQuantity}</td>
                    <td className="px-4 py-3 text-right text-white">{"\u20B9"}{item.estimatedCost.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
