"use client";

import { useState } from "react";
import { Package, Search, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, ArrowUpDown } from "lucide-react";
import { inventoryData } from "@/lib/mock-data";

const statusConfig = {
  critical: { label: "Critical", color: "bg-danger/10 text-danger border-danger/20", icon: AlertTriangle },
  low: { label: "Low Stock", color: "bg-warning/10 text-warning border-warning/20", icon: AlertTriangle },
  optimal: { label: "Optimal", color: "bg-success/10 text-success border-success/20", icon: CheckCircle2 },
  overstock: { label: "Overstock", color: "bg-primary/10 text-primary border-primary/20", icon: Package },
};

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"daysOfStock" | "product">("daysOfStock");

  const filtered = inventoryData
    .filter((item) => {
      const matchesSearch = item.product.toLowerCase().includes(search.toLowerCase()) || item.sku.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => sortBy === "daysOfStock" ? a.daysOfStock - b.daysOfStock : a.product.localeCompare(b.product));

  const summary = {
    total: inventoryData.length,
    critical: inventoryData.filter((i) => i.status === "critical").length,
    low: inventoryData.filter((i) => i.status === "low").length,
    overstock: inventoryData.filter((i) => i.status === "overstock").length,
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Products", value: summary.total, color: "text-foreground" },
          { label: "Critical", value: summary.critical, color: "text-danger" },
          { label: "Low Stock", value: summary.low, color: "text-warning" },
          { label: "Overstock", value: summary.overstock, color: "text-primary" },
        ].map((item) => (
          <div key={item.label} className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className={`text-2xl font-bold ${item.color} mt-1`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Search products or SKU..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2.5 bg-secondary border border-border rounded-xl text-foreground text-sm">
            <option value="all">All Status</option>
            <option value="critical">Critical</option>
            <option value="low">Low Stock</option>
            <option value="optimal">Optimal</option>
            <option value="overstock">Overstock</option>
          </select>
          <button onClick={() => setSortBy(sortBy === "daysOfStock" ? "product" : "daysOfStock")}
            className="flex items-center gap-2 px-4 py-2.5 bg-secondary border border-border rounded-xl text-sm text-foreground hover:bg-muted">
            <ArrowUpDown className="w-4 h-4" />{sortBy === "daysOfStock" ? "Days of Stock" : "Name"}
          </button>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Product", "Category", "Current Stock", "Recommended", "Daily Demand", "Days Left", "Trend", "Status"].map((h) => (
                  <th key={h} className={`text-xs font-semibold text-muted-foreground uppercase px-5 py-3 ${["Current Stock", "Recommended", "Daily Demand", "Days Left"].includes(h) ? "text-right" : ["Trend", "Status"].includes(h) ? "text-center" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const config = statusConfig[item.status];
                const stockPercent = Math.min(100, (item.currentStock / item.recommendedStock) * 100);
                return (
                  <tr key={item.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                    <td className="px-5 py-4"><p className="text-sm font-medium text-card-foreground">{item.product}</p><p className="text-xs text-muted-foreground">{item.sku}</p></td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{item.category}</td>
                    <td className="px-5 py-4 text-right">
                      <p className="text-sm font-semibold text-card-foreground">{item.currentStock}</p>
                      <div className="w-full bg-secondary rounded-full h-1.5 mt-1">
                        <div className={`h-1.5 rounded-full ${item.status === "critical" ? "bg-danger" : item.status === "low" ? "bg-warning" : item.status === "overstock" ? "bg-primary" : "bg-success"}`} style={{ width: `${stockPercent}%` }} />
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right text-sm text-muted-foreground">{item.recommendedStock}</td>
                    <td className="px-5 py-4 text-right text-sm text-card-foreground font-medium">{item.dailyDemand}</td>
                    <td className="px-5 py-4 text-right"><span className={`text-sm font-bold ${item.daysOfStock <= 2 ? "text-danger" : item.daysOfStock <= 4 ? "text-warning" : "text-card-foreground"}`}>{item.daysOfStock}</span></td>
                    <td className="px-5 py-4 text-center">
                      {item.trend === "rising" ? <TrendingUp className="w-4 h-4 text-success mx-auto" /> : item.trend === "falling" ? <TrendingDown className="w-4 h-4 text-danger mx-auto" /> : <Minus className="w-4 h-4 text-muted-foreground mx-auto" />}
                    </td>
                    <td className="px-5 py-4 text-center"><span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.color}`}>{config.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((item) => {
          const config = statusConfig[item.status];
          const stockPercent = Math.min(100, (item.currentStock / item.recommendedStock) * 100);
          return (
            <div key={item.id} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div><p className="text-sm font-semibold text-card-foreground">{item.product}</p><p className="text-xs text-muted-foreground">{item.category} &bull; {item.sku}</p></div>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.color}`}>{config.label}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2 mb-3">
                <div className={`h-2 rounded-full ${item.status === "critical" ? "bg-danger" : item.status === "low" ? "bg-warning" : item.status === "overstock" ? "bg-primary" : "bg-success"}`} style={{ width: `${stockPercent}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-xs text-muted-foreground">Stock</p><p className="text-sm font-bold text-card-foreground">{item.currentStock}</p></div>
                <div><p className="text-xs text-muted-foreground">Demand/Day</p><p className="text-sm font-bold text-card-foreground">{item.dailyDemand}</p></div>
                <div><p className="text-xs text-muted-foreground">Days Left</p><p className={`text-sm font-bold ${item.daysOfStock <= 2 ? "text-danger" : "text-card-foreground"}`}>{item.daysOfStock}</p></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
