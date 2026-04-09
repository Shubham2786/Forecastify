"use client";

import { TrendingUp, Package, AlertTriangle, DollarSign, Cloud, Calendar, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import StatCard from "@/components/StatCard";
import { salesForecastData, categoryDemandData, weatherData, upcomingEvents, alertsData } from "@/lib/mock-data";

export default function DashboardPage() {
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Predicted Revenue" value="$48,520" change="+12.5% vs last week" changeType="positive" icon={DollarSign} color="bg-indigo-500" />
        <StatCard title="Total SKUs Tracked" value="1,247" change="8 new this week" changeType="neutral" icon={Package} color="bg-purple-500" />
        <StatCard title="Forecast Accuracy" value="94.2%" change="+2.1% improvement" changeType="positive" icon={TrendingUp} color="bg-emerald-500" />
        <StatCard title="Active Alerts" value="5" change="2 critical, 2 warning" changeType="negative" icon={AlertTriangle} color="bg-red-500" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-card-foreground">7-Day Sales Forecast</h3>
              <p className="text-sm text-muted-foreground">Actual vs predicted with confidence interval</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-indigo-500" />Actual</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-400" />Predicted</span>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesForecastData}>
                <defs>
                  <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--foreground)" }} />
                <Area type="monotone" dataKey="upper" stroke="none" fill="#a855f720" />
                <Area type="monotone" dataKey="lower" stroke="none" fill="var(--background)" />
                <Area type="monotone" dataKey="predicted" stroke="#818cf8" strokeWidth={2} fill="url(#colorPredicted)" strokeDasharray="5 5" />
                <Area type="monotone" dataKey="actual" stroke="#6366f1" strokeWidth={2.5} fill="none" connectNulls={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-lg font-semibold text-card-foreground mb-1">Category Demand</h3>
          <p className="text-sm text-muted-foreground mb-4">Units predicted this week</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryDemandData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="category" type="category" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={85} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--foreground)" }} />
                <Bar dataKey="demand" radius={[0, 6, 6, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-3"><Cloud className="w-5 h-5 text-primary" /><h3 className="font-semibold text-card-foreground">Weather Impact</h3></div>
            <div className="bg-secondary rounded-xl p-4 space-y-2">
              <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Current</span><span className="text-sm font-medium text-card-foreground">{weatherData.current}, {weatherData.temperature}C</span></div>
              <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Humidity</span><span className="text-sm font-medium text-card-foreground">{weatherData.humidity}%</span></div>
              <p className="text-xs text-warning font-medium pt-1 border-t border-border">{weatherData.forecast}</p>
              <p className="text-xs text-muted-foreground">{weatherData.impact}</p>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3"><Calendar className="w-5 h-5 text-primary" /><h3 className="font-semibold text-card-foreground">Upcoming Events</h3></div>
            <div className="space-y-2">
              {upcomingEvents.map((event) => (
                <div key={event.name} className="flex items-center justify-between bg-secondary rounded-xl px-4 py-3">
                  <div><p className="text-sm font-medium text-card-foreground">{event.name}</p><p className="text-xs text-muted-foreground">In {event.daysAway} days</p></div>
                  <span className="text-xs font-semibold text-success bg-success/10 px-2.5 py-1 rounded-full">{event.expectedImpact}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-warning" /><h3 className="font-semibold text-card-foreground">Recent Alerts</h3></div>
            <a href="/dashboard/alerts" className="text-sm text-primary hover:underline font-medium">View All</a>
          </div>
          <div className="space-y-3">
            {alertsData.slice(0, 4).map((alert) => (
              <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-xl border ${
                alert.severity === "critical" ? "border-danger/20 bg-danger/5" : alert.severity === "warning" ? "border-warning/20 bg-warning/5" : "border-border bg-secondary/50"
              }`}>
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${alert.severity === "critical" ? "bg-danger" : alert.severity === "warning" ? "bg-warning" : "bg-primary"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-card-foreground truncate">{alert.product}</p>
                    <span className="text-xs text-muted-foreground shrink-0">{alert.timestamp}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{alert.message}</p>
                </div>
                {alert.type === "demand_spike" ? <ArrowUpRight className="w-4 h-4 text-warning shrink-0 mt-1" /> : alert.type === "overstock" ? <ArrowDownRight className="w-4 h-4 text-primary shrink-0 mt-1" /> : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
