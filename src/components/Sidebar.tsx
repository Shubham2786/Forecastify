"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, LayoutDashboard, Package, TrendingUp, AlertTriangle, Settings, ChevronLeft, ChevronRight, LogOut, X, Zap, Bot, Box, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/jarvis", label: "Jarvis", icon: Bot },
  { href: "/dashboard/demand-analysis", label: "Demand Spikes", icon: Zap },
  { href: "/dashboard/product-analysis", label: "Product Analysis", icon: Box },
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

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const emptyForm = { product: "", category: "Groceries", quantity: "", unit: "pcs", price: "", brand: "", sku: "", expiryDate: "" };
  const [form, setForm] = useState(emptyForm);

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const { error } = await supabase.from("inventory").insert({
      store_id: user?.id,
      product_name: form.product,
      category: form.category,
      quantity: Number(form.quantity),
      unit: form.unit,
      price: Number(form.price),
      brand: form.brand || null,
      sku: form.sku || null,
      expiry_date: form.expiryDate || null,
    });
    setSaving(false);
    if (error) { setError(error.message); return; }
    window.dispatchEvent(new Event("products_updated"));
    setForm(emptyForm);
    setShowAddProduct(false);
  }

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

      <div className="px-3 pt-3 shrink-0">
        <button onClick={() => setShowAddProduct(true)}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-all">
          <Plus className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Add Product</span>}
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

  const inputCls = "w-full px-3 py-2 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

  return (
    <>
      {showAddProduct && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={() => setShowAddProduct(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-foreground">Add Product</h2>
              <button onClick={() => setShowAddProduct(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddProduct} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Product Name *</label>
                <input required placeholder="e.g. Tata Salt 1kg" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Brand</label>
                <input placeholder="e.g. Tata" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Category *</label>
                <select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>
                  {["Groceries", "Dairy", "Beverages", "Snacks", "Personal Care", "Household"].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Quantity *</label>
                  <input required type="number" min="0" placeholder="e.g. 100" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Unit *</label>
                  <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputCls}>
                    {["pcs", "kg", "g", "L", "ml", "box", "pack", "dozen"].map((u) => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Price (₹) *</label>
                <input required type="number" min="0" step="0.01" placeholder="e.g. 25.00" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">SKU <span className="text-muted-foreground/60">(unique product code)</span></label>
                <input placeholder="e.g. TS-001" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Expiry Date</label>
                <input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className={inputCls} />
              </div>
              {error && <p className="text-xs text-danger">{error}</p>}
              <button type="submit" disabled={saving} className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-50">
                {saving ? "Adding..." : "Add Product"}
              </button>
            </form>
          </div>
        </div>
      )}

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
