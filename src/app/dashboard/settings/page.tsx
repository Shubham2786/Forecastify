"use client";

import { useState, useEffect } from "react";
import { User, Store, Bell, Shield, Save, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [profile, setProfile] = useState({ fullName: "", email: "", phone: "" });
  const [store, setStore] = useState({ storeName: "", storeCategory: "", storeSize: "", address: "", city: "", state: "", gstNumber: "" });
  const [notifications, setNotifications] = useState({ emailAlerts: true, criticalOnly: false, dailyDigest: true, weeklyReport: true });

  // Load profile from Supabase on mount
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data } = await supabase.from("profiles")
          .select("full_name, phone, store_name, store_category, store_size, store_address, city, state, gst_number")
          .eq("id", user.id).single();

        if (data) {
          setProfile({
            fullName: data.full_name || user.user_metadata?.full_name || "",
            email: user.email || "",
            phone: data.phone || user.user_metadata?.phone || "",
          });
          setStore({
            storeName: data.store_name || "",
            storeCategory: data.store_category || "",
            storeSize: data.store_size || "",
            address: data.store_address || "",
            city: data.city || "",
            state: data.state || "",
            gstNumber: data.gst_number || "",
          });
        } else {
          // Fallback to user_metadata
          const meta = user.user_metadata || {};
          setProfile({ fullName: meta.full_name || "", email: user.email || "", phone: meta.phone || "" });
          setStore({
            storeName: meta.store_name || "", storeCategory: meta.store_category || "",
            storeSize: meta.store_size || "", address: meta.store_address || "",
            city: meta.city || "", state: meta.state || "", gstNumber: meta.gst_number || "",
          });
        }
      } catch {} finally { setLoadingProfile(false); }
    })();
  }, [user]);

  const handleSave = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      // Upsert into profiles table
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: profile.fullName,
        phone: profile.phone,
        store_name: store.storeName,
        store_category: store.storeCategory,
        store_size: store.storeSize,
        store_address: store.address,
        city: store.city,
        state: store.state,
        gst_number: store.gstNumber,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert("Failed to save: " + (err.message || "Unknown error"));
    } finally { setSaving(false); }
  };

  const inputClass = "w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-sm";
  const tabs = [{ id: "profile", label: "Profile", icon: User }, { id: "store", label: "Store", icon: Store }, { id: "notifications", label: "Notifications", icon: Bell }];

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex gap-1 bg-secondary rounded-xl p-1">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <tab.icon className="w-4 h-4" /><span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6">
        {activeTab === "profile" && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-2"><User className="w-5 h-5 text-primary" /><h3 className="text-lg font-semibold text-foreground">Profile Information</h3></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label><input type="text" value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-foreground mb-1.5">Phone</label><input type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className={inputClass} /></div>
            </div>
            <div><label className="block text-sm font-medium text-foreground mb-1.5">Email</label><input type="email" value={profile.email} disabled className={`${inputClass} opacity-60 cursor-not-allowed`} /><p className="text-xs text-muted-foreground mt-1">Email cannot be changed here</p></div>
            <div className="flex items-center gap-3 p-4 bg-secondary rounded-xl">
              <Shield className="w-5 h-5 text-primary" />
              <div><p className="text-sm font-medium text-foreground">Password & Security</p><p className="text-xs text-muted-foreground">Use Supabase dashboard to manage password and 2FA</p></div>
            </div>
          </div>
        )}

        {activeTab === "store" && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-2"><Store className="w-5 h-5 text-primary" /><h3 className="text-lg font-semibold text-foreground">Store Information</h3></div>
            <div><label className="block text-sm font-medium text-foreground mb-1.5">Store Name</label><input type="text" value={store.storeName} onChange={(e) => setStore({ ...store, storeName: e.target.value })} className={inputClass} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-foreground mb-1.5">Category</label><input type="text" value={store.storeCategory} onChange={(e) => setStore({ ...store, storeCategory: e.target.value })} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-foreground mb-1.5">Size</label><input type="text" value={store.storeSize} onChange={(e) => setStore({ ...store, storeSize: e.target.value })} className={inputClass} /></div>
            </div>
            <div><label className="block text-sm font-medium text-foreground mb-1.5">Address</label><input type="text" value={store.address} onChange={(e) => setStore({ ...store, address: e.target.value })} className={inputClass} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-foreground mb-1.5">City</label><input type="text" value={store.city} onChange={(e) => setStore({ ...store, city: e.target.value })} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-foreground mb-1.5">State</label><input type="text" value={store.state} onChange={(e) => setStore({ ...store, state: e.target.value })} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-foreground mb-1.5">GST Number</label><input type="text" value={store.gstNumber} onChange={(e) => setStore({ ...store, gstNumber: e.target.value })} className={inputClass} /></div>
            </div>
          </div>
        )}

        {activeTab === "notifications" && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-2"><Bell className="w-5 h-5 text-primary" /><h3 className="text-lg font-semibold text-foreground">Notification Preferences</h3></div>
            {([
              { key: "emailAlerts" as const, label: "Email Alerts", desc: "Receive alerts via email for inventory events" },
              { key: "criticalOnly" as const, label: "Critical Only", desc: "Only receive notifications for critical alerts" },
              { key: "dailyDigest" as const, label: "Daily Digest", desc: "Get a daily summary of inventory status" },
              { key: "weeklyReport" as const, label: "Weekly Report", desc: "Receive weekly forecast accuracy report" },
            ]).map((item) => (
              <div key={item.key} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <div><p className="text-sm font-medium text-foreground">{item.label}</p><p className="text-xs text-muted-foreground">{item.desc}</p></div>
                <button onClick={() => setNotifications({ ...notifications, [item.key]: !notifications[item.key] })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${notifications[item.key] ? "bg-primary" : "bg-muted"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${notifications[item.key] ? "translate-x-5" : ""}`} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-green-500 font-medium">Settings saved to database!</span>}
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
