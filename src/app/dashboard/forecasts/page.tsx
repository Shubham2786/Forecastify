"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Filter, Package, AlertTriangle, BarChart3 } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function ForecastsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [filterCategory, setFilterCategory] = useState("All");

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch("/api/forecasts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        });
        const d = await res.json();
        if (!d.error) {
          setData(d);
          if (d.productForecasts?.length) setSelectedProduct(d.productForecasts[0]);
        }
      } catch {} finally { setLoading(false); }
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const products = data?.productForecasts || [];
  const storeWide = data?.storeWideForecast || [];
  const categories = ["All", ...new Set(products.map((p: any) => p.category))] as string[];
  const filtered = filterCategory === "All" ? products : products.filter((p: any) => p.category === filterCategory);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Store-Wide Forecast Chart */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-500" /> Store-Wide 7-Day Demand Forecast
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Aggregated prediction vs last week actuals with confidence bounds
          {data?.totalProducts && <span className="ml-2">({data.totalProducts} products tracked)</span>}
        </p>
        <div className="h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={storeWide}>
              <defs>
                <linearGradient id="fGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "12px" }} />
              <Legend />
              <Area type="monotone" dataKey="upper" name="Upper Bound" stroke="none" fill="#a855f720" />
              <Area type="monotone" dataKey="lower" name="Lower Bound" stroke="none" fill="var(--color-background)" />
              <Area type="monotone" dataKey="predicted" name="Forecast" stroke="#818cf8" strokeWidth={2} fill="url(#fGrad)" strokeDasharray="5 5" />
              <Area type="monotone" dataKey="actual" name="Last Week Avg" stroke="#6366f1" strokeWidth={2.5} fill="none" />
              <Area type="monotone" dataKey="recommended" name="Recommended" stroke="#f59e0b" strokeWidth={1} fill="none" strokeDasharray="3 3" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground">Total Products</p>
          <p className="text-xl font-bold text-foreground">{data?.totalProducts || 0}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground">Critical Stock</p>
          <p className="text-xl font-bold text-red-500">{data?.criticalCount || 0}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground">Low Stock</p>
          <p className="text-xl font-bold text-amber-500">{data?.lowCount || 0}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground">Overstock</p>
          <p className="text-xl font-bold text-blue-500">{data?.overstockCount || 0}</p>
        </div>
        {data?.testInputs?.total > 0 && (
          <div className="bg-card border border-border rounded-xl p-3 text-center col-span-2 sm:col-span-4">
            <p className="text-xs text-muted-foreground">Test Inputs (test_input table)</p>
            <p className="text-sm font-bold text-foreground">{data.testInputs.total} predictions required — {data.testInputs.productIds?.length || 0} unique products</p>
          </div>
        )}
      </div>

      {/* Product List + Detail */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Product Forecasts</h3>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
                className="text-sm bg-secondary border border-border rounded-lg px-2 py-1 text-foreground">
                {categories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
              </select>
            </div>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {filtered.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No products found</p>}
            {filtered.map((product: any) => (
              <button key={product.productId} onClick={() => setSelectedProduct(product)}
                className={`w-full text-left p-3 rounded-xl transition-all ${selectedProduct?.productId === product.productId ? "bg-primary/10 border border-primary/20" : "hover:bg-secondary border border-transparent"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {product.product}
                      {product.isTestInput && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 font-medium">TEST</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{product.category} &bull; {product.brand}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {product.trend === "rising" ? <TrendingUp className="w-4 h-4 text-green-500" /> :
                     product.trend === "falling" ? <TrendingDown className="w-4 h-4 text-red-500" /> :
                     <Minus className="w-4 h-4 text-muted-foreground" />}
                    <span className="text-sm font-semibold text-foreground">{product.dailyDemand}/day</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="xl:col-span-2 bg-card border border-border rounded-2xl p-5">
          {selectedProduct ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{selectedProduct.product}</h3>
                  <p className="text-sm text-muted-foreground">
                    7-day forecast &bull; Avg {selectedProduct.dailyDemand} units/day &bull; MRP ₹{selectedProduct.mrp}
                  </p>
                </div>
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                  selectedProduct.status === "critical" ? "bg-red-500/10 text-red-500" :
                  selectedProduct.status === "low" ? "bg-amber-500/10 text-amber-500" :
                  selectedProduct.status === "overstock" ? "bg-blue-500/10 text-blue-500" :
                  "bg-green-500/10 text-green-500"
                }`}>
                  {selectedProduct.status === "critical" ? <AlertTriangle className="w-3.5 h-3.5" /> :
                   selectedProduct.status === "low" ? <AlertTriangle className="w-3.5 h-3.5" /> :
                   selectedProduct.status === "overstock" ? <Package className="w-3.5 h-3.5" /> : null}
                  {selectedProduct.status === "critical" ? "Critical" :
                   selectedProduct.status === "low" ? "Low Stock" :
                   selectedProduct.status === "overstock" ? "Overstock" : "Optimal"}
                </div>
              </div>

              <div className="h-64 sm:h-72 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={selectedProduct.dailyForecast}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "12px" }}
                      formatter={(value: any, name: any) => {
                        if (name === "predicted") return [value, "Forecast"];
                        if (name === "recommended") return [value, "Recommended"];
                        if (name === "confidence") return [`${value}%`, "Confidence"];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="predicted" name="Forecast" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: "#6366f1", r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="recommended" name="Recommended" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[
                  { label: "Current Stock", value: `${selectedProduct.currentStock} units`, color: "" },
                  { label: "Recommended", value: `${selectedProduct.recommendedStock} units`, color: "text-amber-600" },
                  { label: "Weekly Demand", value: `${selectedProduct.weeklyDemand} units`, color: "" },
                  { label: "Days of Stock", value: `${selectedProduct.daysOfStock} days`, color: selectedProduct.daysOfStock < 3 ? "text-red-500" : "" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-secondary rounded-xl px-3 py-2.5 text-center">
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className={`text-sm font-bold text-foreground mt-0.5 ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Detailed table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">Day</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Forecast</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Recommended</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Confidence</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Est. Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProduct.dailyForecast?.map((d: any, i: number) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="py-2">
                          <span className="font-medium text-foreground">{d.day}</span>
                          <span className="text-xs text-muted-foreground ml-1">{d.date}</span>
                        </td>
                        <td className="py-2 text-right font-semibold text-foreground">{d.predicted}</td>
                        <td className="py-2 text-right text-amber-600">{d.recommended}</td>
                        <td className="py-2 text-right">
                          <span className={`text-xs font-medium ${d.confidence >= 85 ? "text-green-500" : d.confidence >= 70 ? "text-amber-500" : "text-red-500"}`}>
                            {d.confidence}%
                          </span>
                        </td>
                        <td className="py-2 text-right text-muted-foreground">
                          ₹{(d.predicted * selectedProduct.mrp).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span>Historic Avg: {selectedProduct.historicAvg} units/day</span>
                <span>Confidence: {selectedProduct.confidence}%</span>
                <span>Trend: <span className={selectedProduct.trend === "rising" ? "text-green-500" : selectedProduct.trend === "falling" ? "text-red-500" : ""}>{selectedProduct.trend}</span></span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Select a product to view forecast
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
