"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  AlertTriangle, ShieldAlert, Package, CheckCircle2, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Loader2, RefreshCw, ArrowUpRight, Clock, Zap,
  Minus, Mail, Send,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Alert {
  productName: string;
  category: string;
  currentStock: number;
  unit: string;
  minStock: number;
  maxStock: number;
  severity: "critical" | "warning" | "info";
  alertType: string;
  title: string;
  message: string;
  daysUntilStockout: number;
  demandLevel: "High" | "Medium" | "Low";
  estimatedDailyDemand: number;
  suggestedRestock: number;
  recommendation: string;
  factors: string[];
}

const severityConfig = {
  critical: { label: "Critical", bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-500", icon: ShieldAlert, dotColor: "bg-red-500" },
  warning: { label: "Warning", bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-500", icon: AlertTriangle, dotColor: "bg-amber-500" },
  info: { label: "Info", bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-500", icon: Package, dotColor: "bg-blue-500" },
};

const demandConfig = {
  High: { color: "bg-red-500/10 text-red-600", icon: TrendingUp },
  Medium: { color: "bg-amber-500/10 text-amber-600", icon: Minus },
  Low: { color: "bg-green-500/10 text-green-600", icon: TrendingDown },
};

export default function AlertsPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState({ critical: 0, warning: 0, info: 0 });
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filter, setFilter] = useState("all");
  const [generatedAt, setGeneratedAt] = useState("");
  const [weather, setWeather] = useState<any>(null);
  const [weatherLoaded, setWeatherLoaded] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [location, setLocation] = useState("");

  // Fetch weather + location
  useEffect(() => {
    (async () => {
      try {
        const pos = await new Promise<GeolocationPosition>((r, j) => navigator.geolocation.getCurrentPosition(r, j, { timeout: 10000 }));
        const [wRes, lRes] = await Promise.all([
          fetch(`/api/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`),
          fetch(`/api/location?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`),
        ]);
        if (wRes.ok) { const d = await wRes.json(); setWeather(d.current); }
        if (lRes.ok) { const d = await lRes.json(); setLocation(d.formattedAddress || d.city || ""); }
      } catch {}
      setWeatherLoaded(true);
    })();
  }, []);

  const fetchAlerts = async () => {
    if (!user) return;
    setLoading(true);
    setEmailSent(false);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, weather }),
      });
      const data = await res.json();
      if (data.alerts) {
        setAlerts(data.alerts);
        setSummary(data.summary);
        setGeneratedAt(data.generatedAt);
      }
    } catch {} finally { setLoading(false); }
  };

  const sendAlertEmail = async () => {
    if (!alerts.length) return;
    setSending(true);
    try {
      const storeName = user?.user_metadata?.store_name || "Store";
      const res = await fetch("/api/send-alert-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alerts, storeName, location }),
      });
      const data = await res.json();
      if (data.sent) setEmailSent(true);
    } catch {} finally { setSending(false); }
  };

  // Fetch once after weather is loaded
  useEffect(() => {
    if (user && weatherLoaded && !hasFetched) {
      setHasFetched(true);
      fetchAlerts();
    }
  }, [user, weatherLoaded, hasFetched]);

  const filtered = filter === "all" ? alerts : alerts.filter(a => a.severity === filter);

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Critical Alerts", count: summary.critical, icon: ShieldAlert, color: "text-red-500", bg: "bg-red-500/10", desc: "Products at stockout risk" },
          { label: "Warnings", count: summary.warning, icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10", desc: "Low stock items" },
          { label: "Informational", count: summary.info, icon: Package, color: "text-blue-500", bg: "bg-blue-500/10", desc: "Overstock & demand spikes" },
        ].map((item) => (
          <div key={item.label} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
            <div className={`w-12 h-12 ${item.bg} rounded-xl flex items-center justify-center`}><item.icon className={`w-6 h-6 ${item.color}`} /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{item.count}</p>
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="text-[10px] text-muted-foreground">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter + Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["all", "critical", "warning", "info"].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}>
              {f === "all" ? `All (${alerts.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${alerts.filter(a => a.severity === f).length})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {generatedAt && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(generatedAt).toLocaleTimeString("en-IN")}</span>}
          {alerts.length > 0 && (
            <button onClick={sendAlertEmail} disabled={sending || emailSent}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                emailSent ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600 hover:bg-red-500/20"
              } disabled:opacity-50`}>
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : emailSent ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
              {sending ? "Sending..." : emailSent ? "Email Sent" : "Email Alerts"}
            </button>
          )}
          <button onClick={fetchAlerts} disabled={loading}
            className="p-2 rounded-lg bg-secondary hover:bg-muted text-muted-foreground">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && !alerts.length && (
        <div className="bg-card border border-border rounded-2xl p-12 flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin" />
          <p className="font-semibold text-foreground">Scanning inventory for alerts...</p>
          <p className="text-sm text-muted-foreground">Checking stock levels, demand patterns, and upcoming events</p>
        </div>
      )}

      {/* Alerts list */}
      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((alert, idx) => {
            const config = severityConfig[alert.severity];
            const demand = demandConfig[alert.demandLevel] || demandConfig.Medium;
            const DemandIcon = demand.icon;
            const isExpanded = expandedId === idx;
            const stockPercent = alert.maxStock > 0 ? Math.round((alert.currentStock / alert.maxStock) * 100) : 0;

            return (
              <div key={idx} className={`bg-card border rounded-2xl overflow-hidden transition-all ${config.border}`}>
                {/* Header */}
                <button onClick={() => setExpandedId(isExpanded ? null : idx)} className="w-full text-left p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 ${config.bg} rounded-xl flex items-center justify-center shrink-0 mt-0.5`}>
                      <config.icon className={`w-5 h-5 ${config.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config.bg} ${config.text}`}>{config.label}</span>
                        <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{alert.alertType.replace(/_/g, " ")}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${demand.color} flex items-center gap-1`}>
                          <DemandIcon className="w-3 h-3" />{alert.demandLevel} Demand
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-foreground mt-1.5">{alert.productName}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{alert.message}</p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {alert.daysUntilStockout > 0 && alert.daysUntilStockout < 30 && (
                        <span className={`text-xs font-bold ${alert.daysUntilStockout <= 2 ? "text-red-500" : alert.daysUntilStockout <= 5 ? "text-amber-500" : "text-foreground"}`}>
                          {alert.daysUntilStockout}d left
                        </span>
                      )}
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                    </div>
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-border">
                    <div className="pt-4 space-y-4">
                      {/* Stock bar */}
                      <div className="bg-secondary/50 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-muted-foreground">Stock Level</span>
                          <span className="text-xs font-semibold text-foreground">{alert.currentStock} / {alert.maxStock} {alert.unit}</span>
                        </div>
                        <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${
                            stockPercent <= 20 ? "bg-red-500" : stockPercent <= 50 ? "bg-amber-500" : stockPercent >= 90 ? "bg-blue-500" : "bg-green-500"
                          }`} style={{ width: `${Math.min(stockPercent, 100)}%` }} />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-[10px] text-muted-foreground">Min: {alert.minStock}</span>
                          <span className="text-[10px] text-muted-foreground">{stockPercent}%</span>
                          <span className="text-[10px] text-muted-foreground">Max: {alert.maxStock}</span>
                        </div>
                      </div>

                      {/* Stats grid */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-secondary/50 rounded-xl p-3 text-center">
                          <p className="text-lg font-bold text-foreground">{alert.estimatedDailyDemand}</p>
                          <p className="text-[10px] text-muted-foreground">{alert.unit}/day demand</p>
                        </div>
                        <div className="bg-secondary/50 rounded-xl p-3 text-center">
                          <p className={`text-lg font-bold ${alert.daysUntilStockout <= 2 ? "text-red-500" : alert.daysUntilStockout <= 5 ? "text-amber-500" : "text-green-500"}`}>
                            {alert.daysUntilStockout > 0 ? alert.daysUntilStockout : "N/A"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Days until stockout</p>
                        </div>
                        <div className="bg-secondary/50 rounded-xl p-3 text-center">
                          <p className="text-lg font-bold text-indigo-500">+{Math.max(0, alert.suggestedRestock)}</p>
                          <p className="text-[10px] text-muted-foreground">{alert.unit} to restock</p>
                        </div>
                      </div>

                      {/* Recommendation */}
                      <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <p className="text-sm font-semibold text-green-600 dark:text-green-400">Recommendation</p>
                        </div>
                        <p className="text-sm text-foreground">{alert.recommendation}</p>
                      </div>

                      {/* Factors */}
                      {alert.factors?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Contributing Factors</p>
                          <div className="flex flex-wrap gap-2">
                            {alert.factors.map((f, i) => (
                              <span key={i} className="inline-flex items-center gap-1.5 bg-secondary px-3 py-1.5 rounded-full text-xs font-medium text-foreground">
                                <ArrowUpRight className="w-3 h-3 text-indigo-500" />{f}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && alerts.length === 0 && (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-500/10 rounded-2xl flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">All Clear</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            No stock alerts right now. Your inventory levels look healthy. We check stock levels, demand patterns, and upcoming events to keep you ahead.
          </p>
        </div>
      )}

      {/* Demand legend */}
      {alerts.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-indigo-500" /> Demand Categories</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0"><TrendingUp className="w-4 h-4 text-red-500" /></div>
              <div>
                <p className="text-sm font-semibold text-foreground">High Demand</p>
                <p className="text-xs text-muted-foreground">10+ units sold daily. Restock immediately if below minimum. These products drive footfall.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0"><Minus className="w-4 h-4 text-amber-500" /></div>
              <div>
                <p className="text-sm font-semibold text-foreground">Medium Demand</p>
                <p className="text-xs text-muted-foreground">3-10 units daily. Monitor weekly. Restock when below 7-day supply threshold.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0"><TrendingDown className="w-4 h-4 text-green-500" /></div>
              <div>
                <p className="text-sm font-semibold text-foreground">Low Demand</p>
                <p className="text-xs text-muted-foreground">Under 3 units daily. Keep minimal stock. Risk of overstock and expiry if overstocked.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
