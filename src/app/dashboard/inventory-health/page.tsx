/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  Heart, Shield, TrendingUp, Activity, BarChart3, Package, Loader2,
} from "lucide-react";

const GRADE_COLORS: Record<string, string> = {
  A: "#22c55e",
  B: "#3b82f6",
  C: "#f59e0b",
  D: "#f97316",
  F: "#ef4444",
};

const GRADE_BG: Record<string, string> = {
  A: "bg-green-500/10 text-green-600 dark:text-green-400",
  B: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  C: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  D: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  F: "bg-red-500/10 text-red-600 dark:text-red-400",
};

function getScoreColor(score: number): string {
  if (score > 80) return "#22c55e";
  if (score > 60) return "#f59e0b";
  return "#ef4444";
}

function getScoreColorClass(score: number): string {
  if (score > 80) return "text-green-500";
  if (score > 60) return "text-amber-500";
  return "text-red-500";
}

function getCategoryBarColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

export default function InventoryHealthPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [sortKey, setSortKey] = useState<string>("healthScore");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/inventory-health", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        });
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error("Failed to fetch inventory health:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const sortedProducts = data?.products?.slice().sort((a: any, b: any) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (typeof aVal === "string") return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    return sortAsc ? aVal - bVal : bVal - aVal;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="ml-3 text-gray-400">Analyzing inventory health...</span>
      </div>
    );
  }

  if (!data || !data.products?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
        <Package className="w-12 h-12 mb-3" />
        <p>No inventory data found.</p>
      </div>
    );
  }

  const { overallScore, factorAverages, distribution, categoryScores } = data;
  const scoreColor = getScoreColor(overallScore);
  const circumference = 2 * Math.PI * 70;
  const offset = circumference - (overallScore / 100) * circumference;

  const factors = [
    { label: "Stock Level", value: factorAverages.stockLevel, max: 25, icon: Package, color: "#6366f1" },
    { label: "Demand Alignment", value: factorAverages.demandAlignment, max: 25, icon: TrendingUp, color: "#a855f7" },
    { label: "Volatility", value: factorAverages.volatility, max: 25, icon: Activity, color: "#06b6d4" },
    { label: "Trend Direction", value: factorAverages.trend, max: 25, icon: BarChart3, color: "#22c55e" },
  ];

  const gradeOrder = ["A", "B", "C", "D", "F"];
  const totalProducts = data.products.length;
  const gradeData = gradeOrder.map(g => ({ grade: g, count: distribution[g] || 0 }));

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-linear-to-br from-rose-500 to-pink-600 rounded-xl">
          <Heart className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory Health</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Comprehensive health analysis of your inventory</p>
        </div>
      </div>

      {/* Top Row: Overall Score + Factor Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Big Circular Score */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center justify-center">
          <div className="relative w-44 h-44">
            <svg className="w-44 h-44 -rotate-90" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="70" fill="none" stroke="#e5e7eb" strokeWidth="10" className="dark:stroke-gray-700" />
              <circle
                cx="80" cy="80" r="70" fill="none"
                stroke={scoreColor} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={circumference} strokeDashoffset={offset}
                style={{ transition: "stroke-dashoffset 1s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl font-bold ${getScoreColorClass(overallScore)}`}>{overallScore}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">/ 100</span>
            </div>
          </div>
          <p className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-300">Store Health Score</p>
          <div className={`mt-1 px-3 py-1 rounded-full text-xs font-semibold ${overallScore > 80 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : overallScore > 60 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
            {overallScore > 80 ? "Healthy" : overallScore > 60 ? "Needs Attention" : "Critical"}
          </div>
        </div>

        {/* 4 Factor Cards */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          {factors.map((f) => (
            <div key={f.label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg" style={{ backgroundColor: f.color + "20" }}>
                  <f.icon className="w-4 h-4" style={{ color: f.color }} />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{f.label}</span>
              </div>
              <div className="flex items-end gap-1 mb-2">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{f.value}</span>
                <span className="text-sm text-gray-400 mb-0.5">/ {f.max}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-700"
                  style={{ width: `${(f.value / f.max) * 100}%`, backgroundColor: f.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grade Distribution + Category Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grade Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Grade Distribution</h2>
          </div>
          <div className="space-y-3">
            {gradeData.map((g) => (
              <div key={g.grade} className="flex items-center gap-3">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                  style={{ backgroundColor: GRADE_COLORS[g.grade] }}
                >
                  {g.grade}
                </span>
                <div className="flex-1">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-5 relative overflow-hidden">
                    <div
                      className="h-5 rounded-full flex items-center transition-all duration-700"
                      style={{
                        width: totalProducts > 0 ? `${Math.max((g.count / totalProducts) * 100, g.count > 0 ? 8 : 0)}%` : "0%",
                        backgroundColor: GRADE_COLORS[g.grade] + "40",
                      }}
                    />
                    <span className="absolute inset-0 flex items-center pl-3 text-xs font-medium text-gray-700 dark:text-gray-300">
                      {g.count} product{g.count !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Per-Category Health Bar Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-purple-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Category Health</h2>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(categoryScores.length * 40, 200)}>
            <BarChart data={categoryScores} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#374151" opacity={0.3} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#6b7280" />
              <YAxis type="category" dataKey="category" width={100} tick={{ fontSize: 11 }} stroke="#6b7280" />
              <Tooltip
                contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 12, fontSize: 13 }}
                formatter={(value: any) => [`${value}`, "Health Score"]}
              />
              <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={20}>
                {categoryScores.map((entry: any, idx: number) => (
                  <Cell key={idx} fill={getCategoryBarColor(entry.score)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Product Health Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-cyan-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Product Health Details</h2>
          <span className="text-sm text-gray-400 ml-auto">{data.products.length} products</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {[
                  { key: "productName", label: "Product" },
                  { key: "category", label: "Category" },
                  { key: "healthScore", label: "Health Score" },
                  { key: "stockLevel", label: "Stock Level" },
                  { key: "demandAlignment", label: "Demand Fit" },
                  { key: "volatility", label: "Volatility" },
                  { key: "trend", label: "Trend" },
                  { key: "grade", label: "Grade" },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="text-left py-3 px-2 text-gray-500 dark:text-gray-400 font-medium cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors select-none"
                  >
                    {col.label}
                    {sortKey === col.key && (
                      <span className="ml-1 text-xs">{sortAsc ? "▲" : "▼"}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedProducts?.map((p: any, i: number) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="py-3 px-2 font-medium text-gray-900 dark:text-white">{p.productName}</td>
                  <td className="py-3 px-2 text-gray-500 dark:text-gray-400">{p.category}</td>
                  <td className="py-3 px-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${p.healthScore > 80 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : p.healthScore > 60 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                      {p.healthScore}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-gray-600 dark:text-gray-300">{p.stockLevel}/25</td>
                  <td className="py-3 px-2 text-gray-600 dark:text-gray-300">{p.demandAlignment}/25</td>
                  <td className="py-3 px-2 text-gray-600 dark:text-gray-300">{p.volatility}/25</td>
                  <td className="py-3 px-2 text-gray-600 dark:text-gray-300">{p.trend}/25</td>
                  <td className="py-3 px-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${GRADE_BG[p.grade]}`}>
                      {p.grade}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
