"use client";

import { useState } from "react";
import { AlertTriangle, ShieldAlert, TrendingUp, Package, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { alertsData } from "@/lib/mock-data";

const severityConfig = {
  critical: { label: "Critical", bgColor: "bg-danger/10", borderColor: "border-danger/20", textColor: "text-danger", icon: ShieldAlert },
  warning: { label: "Warning", bgColor: "bg-warning/10", borderColor: "border-warning/20", textColor: "text-warning", icon: AlertTriangle },
  info: { label: "Info", bgColor: "bg-primary/10", borderColor: "border-primary/20", textColor: "text-primary", icon: Package },
};

const typeLabels = { stockout: "Stockout Risk", low_stock: "Low Stock", overstock: "Overstock", demand_spike: "Demand Spike" };

export default function AlertsPage() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? alertsData : alertsData.filter((a) => a.severity === filter);

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Critical Alerts", count: alertsData.filter((a) => a.severity === "critical").length, icon: ShieldAlert, color: "text-danger", bg: "bg-danger/10" },
          { label: "Warnings", count: alertsData.filter((a) => a.severity === "warning").length, icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10" },
          { label: "Informational", count: alertsData.filter((a) => a.severity === "info").length, icon: Package, color: "text-primary", bg: "bg-primary/10" },
        ].map((item) => (
          <div key={item.label} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
            <div className={`w-12 h-12 ${item.bg} rounded-xl flex items-center justify-center`}><item.icon className={`w-6 h-6 ${item.color}`} /></div>
            <div><p className="text-2xl font-bold text-card-foreground">{item.count}</p><p className="text-sm text-muted-foreground">{item.label}</p></div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {["all", "critical", "warning", "info"].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}>
            {f === "all" ? `All Alerts (${alertsData.length})` : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((alert) => {
          const config = severityConfig[alert.severity];
          const isExpanded = expandedId === alert.id;
          return (
            <div key={alert.id} className={`bg-card border rounded-2xl overflow-hidden transition-all ${config.borderColor}`}>
              <button onClick={() => setExpandedId(isExpanded ? null : alert.id)} className="w-full text-left p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 ${config.bgColor} rounded-xl flex items-center justify-center shrink-0 mt-0.5`}><config.icon className={`w-5 h-5 ${config.textColor}`} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config.bgColor} ${config.textColor}`}>{config.label}</span>
                      <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{typeLabels[alert.type]}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{alert.timestamp}</span>
                    </div>
                    <p className="text-sm font-semibold text-card-foreground mt-1.5">{alert.product}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{alert.message}</p>
                  </div>
                  <div className="shrink-0 text-muted-foreground">{isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}</div>
                </div>
              </button>
              {isExpanded && (
                <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-border">
                  <div className="pt-4 space-y-4">
                    <div className="bg-success/5 border border-success/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="w-4 h-4 text-success" /><p className="text-sm font-semibold text-success">Recommendation</p></div>
                      <p className="text-sm text-card-foreground">{alert.recommendation}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-card-foreground mb-2">Contributing Factors</p>
                      <div className="flex flex-wrap gap-2">
                        {alert.factors.map((factor) => (
                          <span key={factor} className="inline-flex items-center gap-1.5 bg-secondary px-3 py-1.5 rounded-full text-xs font-medium text-secondary-foreground">
                            <TrendingUp className="w-3 h-3" />{factor}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
