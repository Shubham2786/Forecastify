"use client";

import { useState } from "react";
import { User, Store, Bell, Shield, Save } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [saved, setSaved] = useState(false);
  const meta = user?.user_metadata || {};

  const [profile, setProfile] = useState({ fullName: meta.full_name || "", email: user?.email || "", phone: meta.phone || "" });
  const [store, setStore] = useState({ storeName: meta.store_name || "", storeCategory: meta.store_category || "", storeSize: meta.store_size || "", address: meta.store_address || "", city: meta.city || "", state: meta.state || "", gstNumber: meta.gst_number || "" });
  const [notifications, setNotifications] = useState({ emailAlerts: true, criticalOnly: false, dailyDigest: true, weeklyReport: true });

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };
  const inputClass = "w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-sm";
  const tabs = [{ id: "profile", label: "Profile", icon: User }, { id: "store", label: "Store", icon: Store }, { id: "notifications", label: "Notifications", icon: Bell }];

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
            <div className="flex items-center gap-3 mb-2"><User className="w-5 h-5 text-primary" /><h3 className="text-lg font-semibold text-card-foreground">Profile Information</h3></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label><input type="text" value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-foreground mb-1.5">Phone</label><input type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className={inputClass} /></div>
            </div>
            <div><label className="block text-sm font-medium text-foreground mb-1.5">Email</label><input type="email" value={profile.email} disabled className={`${inputClass} opacity-60 cursor-not-allowed`} /><p className="text-xs text-muted-foreground mt-1">Email cannot be changed here</p></div>
            <div className="flex items-center gap-3 p-4 bg-secondary rounded-xl">
              <Shield className="w-5 h-5 text-primary" />
              <div><p className="text-sm font-medium text-card-foreground">Password & Security</p><p className="text-xs text-muted-foreground">Use Supabase dashboard to manage password and 2FA</p></div>
            </div>
          </div>
        )}

        {activeTab === "store" && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-2"><Store className="w-5 h-5 text-primary" /><h3 className="text-lg font-semibold text-card-foreground">Store Information</h3></div>
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
            <div className="flex items-center gap-3 mb-2"><Bell className="w-5 h-5 text-primary" /><h3 className="text-lg font-semibold text-card-foreground">Notification Preferences</h3></div>
            {([
              { key: "emailAlerts" as const, label: "Email Alerts", desc: "Receive alerts via email for inventory events" },
              { key: "criticalOnly" as const, label: "Critical Only", desc: "Only receive notifications for critical alerts" },
              { key: "dailyDigest" as const, label: "Daily Digest", desc: "Get a daily summary of inventory status" },
              { key: "weeklyReport" as const, label: "Weekly Report", desc: "Receive weekly forecast accuracy report" },
            ]).map((item) => (
              <div key={item.key} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <div><p className="text-sm font-medium text-card-foreground">{item.label}</p><p className="text-xs text-muted-foreground">{item.desc}</p></div>
                <button onClick={() => setNotifications({ ...notifications, [item.key]: !notifications[item.key] })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${notifications[item.key] ? "bg-primary" : "bg-muted"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${notifications[item.key] ? "translate-x-5" : ""}`} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-success font-medium">Settings saved!</span>}
          <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90">
            <Save className="w-4 h-4" />Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
