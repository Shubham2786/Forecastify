"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, LayoutDashboard, Package, TrendingUp, AlertTriangle, Settings, ChevronLeft, ChevronRight, LogOut, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/forecasts", label: "Forecasts", icon: TrendingUp },
  { href: "/dashboard/inventory", label: "Inventory", icon: Package },
  { href: "/dashboard/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const storeName = user?.user_metadata?.store_name || "My Store";
  const userName = user?.user_metadata?.full_name || user?.email || "User";

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 h-16 border-b border-border shrink-0">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && <span className="text-lg font-bold gradient-text whitespace-nowrap">Forecastify</span>}
        </Link>
        <button onClick={onMobileClose} className="lg:hidden text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex text-muted-foreground hover:text-foreground">
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} onClick={onMobileClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                isActive ? "bg-primary/10 text-primary" : "text-sidebar-foreground hover:bg-secondary"
              }`}>
              <item.icon className={`w-5 h-5 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
              {!collapsed && <span>{item.label}</span>}
              {isActive && item.href === "/dashboard/alerts" && (
                <span className="ml-auto bg-danger text-white text-xs font-bold px-2 py-0.5 rounded-full">3</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-3 py-4 shrink-0">
        {!collapsed && (
          <div className="px-3 mb-3">
            <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
            <p className="text-xs text-muted-foreground truncate">{storeName}</p>
          </div>
        )}
        <button onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-danger hover:bg-danger/10 w-full transition-all">
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onMobileClose} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-border transform transition-transform lg:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {sidebarContent}
      </aside>
      <aside className={`hidden lg:flex flex-col bg-sidebar border-r border-border shrink-0 transition-all ${collapsed ? "w-[72px]" : "w-64"}`}>
        {sidebarContent}
      </aside>
    </>
  );
}
