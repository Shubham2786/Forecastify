/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { Target, TrendingUp, Activity, CheckCircle, Loader2 } from "lucide-react";

const CAT_COLORS = ["#6366f1", "#a855f7", "#ec4899", "#f59e0b", "#22c55e", "#06b6d4", "#f43f5e", "#8b5cf6"];

function accuracyColor(acc: number) {
  if (acc >= 85) return "text-green-500";
  if (acc >= 70) return "text-amber-500";
  return "text-red-500";
}

function accuracyBg(acc: number) {
  if (acc >= 85) return "bg-green-500/10 border-green-500/20";
  if (acc >= 70) return "bg-amber-500/10 border-amber-500/20";
  return "bg-red-500/10 border-red-500/20";
}

function statBg(acc: number) {
  if (acc >= 85) return "from-green-500/10 to-green-500/5";
  if (acc >= 70) return "from-amber-500/10 to-amber-500/5";
  return "from-red-500/10 to-red-500/5";
}

function statIcon(acc: number) {
  if (acc >= 85) return "text-green-500";
  if (acc >= 70) return "text-amber-500";
  return "text-red-500";
}

export default function ModelAccuracyPage() {
  const { user } = useAuth();
  const { t } = useLang();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch("/api/model-accuracy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        });
        const d = await res.json();
        if (!d.error) setData(d);
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data || data.matchedCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Target className="w-10 h-10 mb-3 opacity-40" />
        <p className="text-lg font-medium">No accuracy data available</p>
        <p className="text-sm mt-1">Forecast data for past dates is needed to compute accuracy.</p>
      </div>
    );
  }

  const { mape, rmse, mae, accuracy, productAccuracy, dailyTrend, categoryAccuracy, matchedCount } = data;

  const stats = [
    {
      label: "MAPE",
      value: `${mape}%`,
      subtitle: "Mean Absolute % Error",
      icon: Activity,
      acc: 100 - mape,
    },
    {
      label: "RMSE",
      value: rmse.toFixed(1),
      subtitle: "Root Mean Square Error",
      icon: TrendingUp,
      acc: accuracy,
    },
    {
      label: "MAE",
      value: mae.toFixed(1),
      subtitle: "Mean Absolute Error",
      icon: Target,
      acc: accuracy,
    },
    {
      label: "Accuracy",
      value: `${accuracy}%`,
      subtitle: `Based on ${matchedCount} predictions`,
      icon: CheckCircle,
      acc: accuracy,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            {t("modelAccuracy") || "Model Accuracy"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            How well our demand forecasts match actual sales
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className={`bg-linear-to-br ${statBg(s.acc)} border border-border rounded-xl p-5`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">{s.label}</span>
                <Icon className={`w-5 h-5 ${statIcon(s.acc)}`} />
              </div>
              <p className={`text-2xl font-bold ${accuracyColor(s.acc)}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.subtitle}</p>
            </div>
          );
        })}
      </div>

      {/* Accuracy Trend Chart */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Daily Accuracy Trend (Last 14 Days)
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyTrend}>
              <defs>
                <linearGradient id="gAccuracy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
                formatter={(value: any) => [`${value}%`, "Accuracy"]}
              />
              <Area
                type="monotone"
                dataKey="accuracy"
                name="Accuracy"
                stroke="#6366f1"
                fill="url(#gAccuracy)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Per-Product Accuracy Table */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Per-Product Accuracy
          </h3>
          <div className="overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2 pr-3 font-medium">Product</th>
                  <th className="text-right py-2 px-2 font-medium">Predicted</th>
                  <th className="text-right py-2 px-2 font-medium">Actual</th>
                  <th className="text-right py-2 px-2 font-medium">Error%</th>
                  <th className="text-right py-2 pl-2 font-medium">Accuracy%</th>
                </tr>
              </thead>
              <tbody>
                {productAccuracy.map((p: any) => (
                  <tr key={p.product} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="py-2 pr-3 font-medium text-foreground">{p.product}</td>
                    <td className="py-2 px-2 text-right text-muted-foreground">{p.predicted}</td>
                    <td className="py-2 px-2 text-right text-muted-foreground">{p.actual}</td>
                    <td className="py-2 px-2 text-right text-muted-foreground">{p.errorPct}%</td>
                    <td className="py-2 pl-2 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${accuracyBg(p.accuracy)} ${accuracyColor(p.accuracy)}`}
                      >
                        {p.accuracy}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Per-Category Accuracy Bar Chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-primary" />
            Accuracy by Category
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryAccuracy} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                <YAxis
                  type="category"
                  dataKey="category"
                  tick={{ fontSize: 12 }}
                  stroke="var(--color-muted-foreground)"
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                  formatter={(value: any) => [`${value}%`, "Accuracy"]}
                />
                <Bar dataKey="accuracy" name="Accuracy" radius={[0, 6, 6, 0]}>
                  {categoryAccuracy.map((_: any, i: number) => (
                    <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
