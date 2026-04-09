"use client";

import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { TrendingUp, TrendingDown, Minus, Filter } from "lucide-react";
import { salesForecastData, inventoryData } from "@/lib/mock-data";

const productForecasts = inventoryData.map((item) => ({
  ...item,
  forecast: Array.from({ length: 7 }, (_, i) => ({
    day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
    demand: Math.round(item.dailyDemand * (0.8 + Math.random() * 0.5) * (i >= 5 ? 1.3 : 1)),
  })),
}));

export default function ForecastsPage() {
  const [selectedProduct, setSelectedProduct] = useState(productForecasts[0]);
  const [filterCategory, setFilterCategory] = useState("All");

  const categories = ["All", ...new Set(inventoryData.map((i) => i.category))];
  const filtered = filterCategory === "All" ? productForecasts : productForecasts.filter((p) => p.category === filterCategory);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-lg font-semibold text-card-foreground mb-1">Store-Wide 7-Day Revenue Forecast</h3>
        <p className="text-sm text-muted-foreground mb-4">Aggregated prediction with confidence bounds</p>
        <div className="h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={salesForecastData}>
              <defs><linearGradient id="fGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} /><stop offset="95%" stopColor="#818cf8" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--foreground)" }} />
              <Area type="monotone" dataKey="upper" stroke="none" fill="#a855f720" />
              <Area type="monotone" dataKey="lower" stroke="none" fill="var(--background)" />
              <Area type="monotone" dataKey="predicted" stroke="#818cf8" strokeWidth={2} fill="url(#fGrad)" strokeDasharray="5 5" />
              <Area type="monotone" dataKey="actual" stroke="#6366f1" strokeWidth={2.5} fill="none" connectNulls={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-card-foreground">Product Forecasts</h3>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="text-sm bg-secondary border border-border rounded-lg px-2 py-1 text-foreground">
                {categories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
              </select>
            </div>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {filtered.map((product) => (
              <button key={product.id} onClick={() => setSelectedProduct(product)}
                className={`w-full text-left p-3 rounded-xl transition-all ${selectedProduct.id === product.id ? "bg-primary/10 border border-primary/20" : "hover:bg-secondary border border-transparent"}`}>
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium text-card-foreground">{product.product}</p><p className="text-xs text-muted-foreground">{product.category} &bull; {product.sku}</p></div>
                  <div className="flex items-center gap-1">
                    {product.trend === "rising" ? <TrendingUp className="w-4 h-4 text-success" /> : product.trend === "falling" ? <TrendingDown className="w-4 h-4 text-danger" /> : <Minus className="w-4 h-4 text-muted-foreground" />}
                    <span className="text-sm font-semibold text-card-foreground">{product.dailyDemand}/day</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="xl:col-span-2 bg-card border border-border rounded-2xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
            <div>
              <h3 className="text-lg font-semibold text-card-foreground">{selectedProduct.product}</h3>
              <p className="text-sm text-muted-foreground">7-day demand forecast &bull; Avg {selectedProduct.dailyDemand} units/day</p>
            </div>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
              selectedProduct.status === "critical" ? "bg-danger/10 text-danger" : selectedProduct.status === "low" ? "bg-warning/10 text-warning" : selectedProduct.status === "overstock" ? "bg-primary/10 text-primary" : "bg-success/10 text-success"
            }`}>
              {selectedProduct.status === "critical" ? "Critical" : selectedProduct.status === "low" ? "Low Stock" : selectedProduct.status === "overstock" ? "Overstock" : "Optimal"}
            </div>
          </div>
          <div className="h-64 sm:h-72 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={selectedProduct.forecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--foreground)" }} />
                <Line type="monotone" dataKey="demand" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: "#6366f1", r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Current Stock", value: `${selectedProduct.currentStock} units` },
              { label: "Recommended", value: `${selectedProduct.recommendedStock} units` },
              { label: "Daily Demand", value: `${selectedProduct.dailyDemand} units` },
              { label: "Days of Stock", value: `${selectedProduct.daysOfStock} days` },
            ].map((stat) => (
              <div key={stat.label} className="bg-secondary rounded-xl px-3 py-2.5 text-center">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-sm font-bold text-card-foreground mt-0.5">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
