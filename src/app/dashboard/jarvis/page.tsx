"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import { useRouter } from "next/navigation";
import {
  Mic, Volume2, VolumeX, Bot, Globe, X, Package,
  Cloud, MapPin, Zap, AlertTriangle, ExternalLink,
  PauseCircle, PlayCircle, TrendingUp, BarChart3, Tag, ShoppingCart, Loader2,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Message { role: "user" | "assistant"; content: string }
interface PopupData { title: string; content: string; loading?: boolean }
interface ActionResult { type: string; result: any }
type JarvisState = "sleeping" | "listening" | "thinking" | "speaking" | "idle" | "paused";

export default function JarvisPage() {
  const { user } = useAuth();
  const { lang: appLang } = useLang();
  const router = useRouter();

  const [state, setState] = useState<JarvisState>("sleeping");
  const [transcript, setTranscript] = useState("");
  const [jarvisText, setJarvisText] = useState("");
  const [displayedText, setDisplayedText] = useState("");
  const [history, setHistory] = useState<Message[]>([]);
  const [weather, setWeather] = useState<any>(null);
  const [locationName, setLocationName] = useState("");
  const [newsData, setNewsData] = useState<any>(null);
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [inventoryPopup, setInventoryPopup] = useState<any[] | null>(null);
  const [popupHovered, setPopupHovered] = useState(false);
  const [invHovered, setInvHovered] = useState(false);
  const popupTimerRef = useRef<NodeJS.Timeout | null>(null);
  const invTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [lang, setLang] = useState<"en-IN" | "hi-IN">("en-IN");
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [micAllowed, setMicAllowed] = useState<boolean | null>(null); // null=unknown, true=granted, false=denied
  const micStreamRef = useRef<MediaStream | null>(null); // keep mic stream alive to prevent Chrome from re-prompting

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const isListeningRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stateRef = useRef<JarvisState>("sleeping");
  const weatherRef = useRef<any>(null);
  const locationRef = useRef("");
  const historyRef = useRef<Message[]>([]);
  const newsRef = useRef<any>(null);
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const latRef = useRef(0);
  const lonRef = useRef(0);
  const clapStreamRef = useRef<MediaStream | null>(null);
  const clapCtxRef = useRef<AudioContext | null>(null);
  const clapAnimRef = useRef<number>(0);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { weatherRef.current = weather; }, [weather]);
  useEffect(() => { locationRef.current = locationName; }, [locationName]);
  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { newsRef.current = newsData; }, [newsData]);

  // Typewriter
  useEffect(() => {
    if (!jarvisText) { setDisplayedText(""); return; }
    let i = 0;
    setDisplayedText("");
    const t = setInterval(() => { setDisplayedText(jarvisText.slice(0, i + 1)); i++; if (i >= jarvisText.length) clearInterval(t); }, 20);
    return () => clearInterval(t);
  }, [jarvisText]);

  // Init speech + voices
  useEffect(() => {
    if (typeof window === "undefined") return;
    synthRef.current = window.speechSynthesis;
    const load = () => synthRef.current?.getVoices();
    load();
    speechSynthesis.onvoiceschanged = load;
  }, []);

  // Unlock audio
  const unlockAudio = useCallback(() => {
    if (audioUnlocked || !synthRef.current) return;
    const utt = new SpeechSynthesisUtterance(" ");
    utt.volume = 0.01;
    synthRef.current.speak(utt);
    setAudioUnlocked(true);
  }, [audioUnlocked]);

  // Fetch weather + news on mount
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
        );
        const { latitude: lat, longitude: lon } = pos.coords;
        latRef.current = lat;
        lonRef.current = lon;
        const [wRes, lRes] = await Promise.all([
          fetch(`/api/weather?lat=${lat}&lon=${lon}`),
          fetch(`/api/location?lat=${lat}&lon=${lon}`),
        ]);
        let city = "", st = "";
        if (wRes.ok) { const d = await wRes.json(); setWeather(d.current); }
        if (lRes.ok) { const d = await lRes.json(); setLocationName(d.formattedAddress || d.city || ""); city = d.city || ""; st = d.state || ""; }
        try {
          const nRes = await fetch("/api/news", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeCategory: "Retail", city, state: st }) });
          if (nRes.ok) { const nd = await nRes.json(); setNewsData(nd); }
        } catch {}
      } catch {}
    })();
  }, [user]);

  // ---- SPEECH OUTPUT ----
  const speak = useCallback((text: string, onDone?: () => void) => {
    if (!voiceEnabled || !synthRef.current) { onDone?.(); return; }
    synthRef.current.cancel();

    const clean = text.replace(/[*#_`~]/g, "").replace(/\n+/g, ". ").replace(/https?:\/\/\S+/g, "link").replace(/\s+/g, " ").trim();
    if (!clean) { onDone?.(); return; }

    setState("speaking");
    isSpeakingRef.current = true;

    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang = lang;
    utt.rate = 1.0;
    utt.pitch = 1.0;
    utt.volume = 1.0;

    const voices = synthRef.current.getVoices();
    const voice = lang === "hi-IN"
      ? voices.find(v => v.lang.startsWith("hi"))
      : voices.find(v => v.name.includes("Samantha")) || voices.find(v => v.name.includes("Daniel")) ||
        voices.find(v => v.name.includes("Google") && v.lang.startsWith("en")) ||
        voices.find(v => v.lang === "en-IN") || voices.find(v => v.lang.startsWith("en"));
    if (voice) utt.voice = voice;

    utt.onend = () => { isSpeakingRef.current = false; setState("idle"); onDone?.(); };
    utt.onerror = () => { isSpeakingRef.current = false; setState("idle"); onDone?.(); };

    synthRef.current.speak(utt);

    // Chrome bug fix: pause/resume to prevent cutoff
    const keepAlive = setInterval(() => {
      if (!synthRef.current?.speaking) { clearInterval(keepAlive); return; }
      synthRef.current.pause();
      synthRef.current.resume();
    }, 5000);
    const origEnd = utt.onend;
    utt.onend = (e) => { clearInterval(keepAlive); (origEnd as any)?.(e); };
    utt.onerror = () => { clearInterval(keepAlive); isSpeakingRef.current = false; setState("idle"); onDone?.(); };
  }, [voiceEnabled, lang]);

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    isSpeakingRef.current = false;
    if (stateRef.current === "speaking") setState("idle");
  }, []);

  // ---- PAUSE JARVIS ----
  const pauseJarvis = useCallback(() => {
    stopSpeaking();
    isListeningRef.current = false;
    try { recognitionRef.current?.stop(); } catch {}
    setState("paused");
    setJarvisText("Jarvis paused. Click resume when ready, Sir.");
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(() => resumeJarvis(), 60000);
  }, [stopSpeaking]);

  const startRecognitionRef = useRef<() => void>(() => {});

  const resumeJarvis = useCallback(() => {
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    setState("idle");
    setJarvisText("Back online, Sir.");
    // Full restart of recognition to ensure clean state
    startRecognitionRef.current();
    speak("Back online, Sir.");
  }, [speak]);

  // ---- FEATURE API CALLS ----
  // Fetch inventory once for reuse
  const fetchInventory = useCallback(async () => {
    if (!user) return [];
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await sb.from("inventory").select("product_name, category, quantity, unit, price, min_stock, max_stock, brand, sku").eq("store_id", user.id);
    return data || [];
  }, [user]);

  const fetchStoreProfile = useCallback(async () => {
    if (!user) return null;
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await sb.from("profiles").select("store_name, store_category, store_size, city, state, store_address").eq("id", user.id).single();
    return data;
  }, [user]);

  const fetchWeatherFull = useCallback(async () => {
    if (!latRef.current) return null;
    try {
      const res = await fetch(`/api/weather?lat=${latRef.current}&lon=${lonRef.current}`);
      if (res.ok) return await res.json();
    } catch {}
    return null;
  }, []);

  const callFeatureAPI = useCallback(async (actionType: string, params: any) => {
    if (!user) return;

    const showLoading = (title: string) => {
      setPopup({ title, content: "<div style='text-align:center;padding:20px;color:#94a3b8;'>Analyzing data...</div>", loading: true });
    };

    try {
      switch (actionType) {
        case "product_analysis": {
          const productName = params.product || "Milk";
          showLoading(`Product Analysis: ${productName}`);

          // Fetch weather data for the API
          const weatherFull = await fetchWeatherFull();

          const res = await fetch("/api/product-analysis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productName,
              userId: user.id,
              weather: weatherFull?.current || weatherRef.current,
              weatherForecast: weatherFull?.forecast,
              location: locationRef.current,
            }),
          });
          const data = await res.json();

          if (data.error) {
            setPopup({ title: `Product Analysis: ${productName}`, content: `<p style="color:#ef4444;">Error: ${data.error}</p>` });
            return;
          }

          // Response: { analysis: { productName, dailyForecast, summary, totalPredictedSales, stockRequired, ... }, product, weather }
          const a = data.analysis || data;
          const forecast = a.dailyForecast || [];
          let html = `<div style="margin-bottom:10px;">
            <strong style="font-size:14px;">${a.productName || productName}</strong>
            ${a.inInventory ? `<span style="margin-left:8px;color:#22c55e;font-size:11px;">In Stock: ${a.currentStock || 0} ${a.unit || "pcs"}</span>` : `<span style="margin-left:8px;color:#f59e0b;font-size:11px;">Not in inventory</span>`}
          </div>`;

          if (a.summary) html += `<p style="margin-bottom:10px;color:#94a3b8;font-size:12px;">${a.summary}</p>`;

          if (forecast.length) {
            html += `<table style="width:100%;border-collapse:collapse;font-size:12px;">
              <tr style="border-bottom:1px solid #333;"><th style="text-align:left;padding:5px;">Day</th><th style="text-align:right;padding:5px;">Sales</th><th style="text-align:right;padding:5px;">Conf.</th><th style="text-align:left;padding:5px;font-size:11px;">Reason</th></tr>`;
            forecast.forEach((d: any) => {
              html += `<tr style="border-bottom:1px solid #222;"><td style="padding:5px;">${d.day}</td><td style="text-align:right;padding:5px;font-weight:bold;">${d.predictedSales || 0}</td><td style="text-align:right;padding:5px;color:${(d.confidence || 0) >= 80 ? "#22c55e" : "#f59e0b"};">${d.confidence || 0}%</td><td style="padding:5px;color:#666;font-size:10px;">${(d.reason || "").slice(0, 40)}</td></tr>`;
            });
            html += `</table>`;
          }

          html += `<div style="margin-top:8px;display:flex;gap:12px;font-size:11px;">
            <span style="color:#22c55e;">Weekly: ${a.totalPredictedSales || 0} units</span>
            <span style="color:#f59e0b;">Need: ${a.stockRequired || 0}</span>
            <span style="color:${a.restockUrgency === "High" ? "#ef4444" : "#888"};">Urgency: ${a.restockUrgency || "Low"}</span>
          </div>`;

          if (a.recommendations?.length) {
            html += `<div style="margin-top:8px;border-top:1px solid #333;padding-top:6px;"><strong style="font-size:11px;">Recommendations:</strong>`;
            a.recommendations.slice(0, 3).forEach((r: string) => { html += `<p style="color:#888;font-size:11px;margin:2px 0;">• ${r}</p>`; });
            html += `</div>`;
          }

          setPopup({ title: `Product Analysis: ${a.productName || productName}`, content: html });
          break;
        }

        case "demand_analysis": {
          showLoading("Demand Spike Analysis");

          // Demand analysis needs: storeCategory, storeSize, city, state, weather, forecast, news, events, location, inventory
          const [inv, store, weatherFull] = await Promise.all([
            fetchInventory(),
            fetchStoreProfile(),
            fetchWeatherFull(),
          ]);

          const res = await fetch("/api/demand-analysis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              storeCategory: store?.store_category || "Retail",
              storeSize: store?.store_size || "Small",
              city: store?.city || "Pune",
              state: store?.state || "Maharashtra",
              weather: weatherFull?.current || weatherRef.current,
              forecast: weatherFull?.forecast,
              news: newsRef.current,
              events: newsRef.current?.events,
              location: locationRef.current || store?.store_address || `${store?.city}, ${store?.state}`,
              inventory: inv,
            }),
          });
          const data = await res.json();

          if (data.error) {
            setPopup({ title: "Demand Spike Analysis", content: `<p style="color:#ef4444;">Error: ${data.error}</p>` });
            return;
          }

          // Response: { analysis: { summary, demandSpikes, trendingProducts, weatherImpact, inventoryRecommendations, riskAlerts } }
          const a = data.analysis || {};
          let html = "";

          if (a.summary) html += `<p style="margin-bottom:10px;color:#94a3b8;font-size:12px;">${a.summary}</p>`;

          // Weather impact
          if (a.weatherImpact) {
            const sev = a.weatherImpact.severity;
            html += `<div style="margin-bottom:10px;padding:6px 10px;background:${sev === "High" ? "#7f1d1d" : "#1e293b"};border-radius:8px;font-size:12px;">
              <strong>Weather Impact (${sev}):</strong> ${a.weatherImpact.description || ""}
            </div>`;
          }

          // Demand spikes table
          const spikes = a.demandSpikes || [];
          if (spikes.length) {
            html += `<table style="width:100%;border-collapse:collapse;font-size:12px;">
              <tr style="border-bottom:1px solid #333;"><th style="text-align:left;padding:5px;">Day</th><th style="text-align:right;padding:5px;">Spike %</th><th style="text-align:right;padding:5px;">Prob.</th><th style="text-align:left;padding:5px;">Reason</th></tr>`;
            spikes.slice(0, 7).forEach((s: any) => {
              html += `<tr style="border-bottom:1px solid #222;"><td style="padding:5px;">${s.dayName || s.day || "?"}</td><td style="text-align:right;padding:5px;color:#22c55e;font-weight:bold;">${s.expectedIncrease || "?"}</td><td style="text-align:right;padding:5px;">${s.spikeProbability || 0}%</td><td style="padding:5px;color:#888;font-size:10px;">${(s.reason || "").slice(0, 50)}</td></tr>`;
            });
            html += `</table>`;
          }

          // Risk alerts
          if (a.riskAlerts?.length) {
            html += `<div style="margin-top:8px;border-top:1px solid #333;padding-top:6px;"><strong style="font-size:11px;">Risk Alerts:</strong>`;
            a.riskAlerts.slice(0, 3).forEach((r: any) => {
              const color = r.severity === "critical" ? "#ef4444" : r.severity === "warning" ? "#f59e0b" : "#3b82f6";
              html += `<p style="color:${color};font-size:11px;margin:3px 0;">⚠ ${r.message || r.type}</p>`;
            });
            html += `</div>`;
          }

          // Inventory recommendations
          if (a.inventoryRecommendations?.length) {
            html += `<div style="margin-top:8px;border-top:1px solid #333;padding-top:6px;"><strong style="font-size:11px;">Stock Actions:</strong>`;
            a.inventoryRecommendations.filter((r: any) => r.action !== "Maintain").slice(0, 5).forEach((r: any) => {
              const color = r.urgency === "High" ? "#ef4444" : r.urgency === "Medium" ? "#f59e0b" : "#22c55e";
              html += `<p style="font-size:11px;margin:2px 0;"><span style="color:${color};font-weight:bold;">${r.action}</span> ${r.product}: ${r.currentAdvice || ""}</p>`;
            });
            html += `</div>`;
          }

          setPopup({ title: "Demand Spike Analysis", content: html || "<p>No significant spikes detected.</p>" });
          break;
        }

        case "category_analysis": {
          const categoryName = params.category || "";
          showLoading(`Category Analysis${categoryName ? `: ${categoryName}` : ""}`);

          const res = await fetch("/api/category-analysis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              category: categoryName,
              userId: user.id,
              weather: weatherRef.current,
              location: locationRef.current,
            }),
          });
          const data = await res.json();

          if (data.error) {
            setPopup({ title: "Category Analysis", content: `<p style="color:#ef4444;">Error: ${data.error}</p>` });
            return;
          }

          // Response: { analysis: { category, summary, topBrands, products, missingProducts, recommendations }, myProducts }
          const a = data.analysis || {};
          let html = "";

          html += `<div style="margin-bottom:8px;"><strong style="font-size:14px;">${a.category || categoryName || "All"}</strong>
            <span style="margin-left:8px;color:#888;font-size:11px;">Demand: ${a.totalCategoryDemand || "?"} | Weekly: ~${a.weeklyEstimate || "?"} units</span></div>`;

          if (a.summary) html += `<p style="margin-bottom:10px;color:#94a3b8;font-size:12px;">${a.summary}</p>`;

          // Top brands
          if (a.topBrands?.length) {
            html += `<div style="margin-bottom:8px;"><strong style="font-size:11px;">Top Brands:</strong><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">`;
            a.topBrands.slice(0, 6).forEach((b: any) => {
              html += `<span style="display:inline-block;background:#6366f1;color:white;padding:2px 8px;border-radius:12px;font-size:10px;">${b.brand} (${b.popularity || "?"}%)</span>`;
            });
            html += `</div></div>`;
          }

          // Products table
          if (a.products?.length) {
            html += `<table style="width:100%;border-collapse:collapse;font-size:11px;">
              <tr style="border-bottom:1px solid #333;"><th style="text-align:left;padding:4px;">Product</th><th style="text-align:right;padding:4px;">Daily</th><th style="text-align:center;padding:4px;">Status</th><th style="text-align:right;padding:4px;">Stock</th></tr>`;
            a.products.slice(0, 10).forEach((p: any) => {
              const statusColor = p.stockStatus === "Low" || p.stockStatus === "Out of Stock" ? "#ef4444" : p.stockStatus === "Sufficient" ? "#22c55e" : "#f59e0b";
              html += `<tr style="border-bottom:1px solid #222;"><td style="padding:4px;">${p.name}<br/><span style="color:#666;font-size:9px;">${p.brand || ""}</span></td><td style="text-align:right;padding:4px;font-weight:bold;">${p.dailyDemand || 0}</td><td style="text-align:center;padding:4px;color:${statusColor};font-size:10px;">${p.stockStatus || "?"}</td><td style="text-align:right;padding:4px;">${p.inMyInventory ? `${p.myStock || 0}${p.myUnit || ""}` : "—"}</td></tr>`;
            });
            html += `</table>`;
          }

          // Missing products
          if (a.missingProducts?.length) {
            html += `<div style="margin-top:6px;"><strong style="font-size:11px;color:#f59e0b;">Should Stock:</strong> <span style="font-size:11px;color:#888;">${a.missingProducts.slice(0, 5).join(", ")}</span></div>`;
          }

          // Recommendations
          if (a.recommendations?.length) {
            html += `<div style="margin-top:6px;border-top:1px solid #333;padding-top:4px;">`;
            a.recommendations.slice(0, 3).forEach((r: string) => { html += `<p style="color:#888;font-size:11px;margin:2px 0;">• ${r}</p>`; });
            html += `</div>`;
          }

          setPopup({ title: `Category: ${a.category || categoryName || "Analysis"}`, content: html });
          break;
        }

        case "alerts": {
          showLoading("Stock Alerts");

          const res = await fetch("/api/alerts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user.id,
              weather: weatherRef.current,
            }),
          });
          const data = await res.json();

          // Response: { alerts: [...], summary: {critical, warning, info} } or just array
          const alerts = data.alerts || (Array.isArray(data) ? data : []);
          const summary = data.summary;

          if (!alerts.length) {
            setPopup({ title: "Stock Alerts", content: "<p style='color:#22c55e;text-align:center;padding:20px;'>All clear! No alerts, Sir.</p>" });
            return;
          }

          let html = "";
          if (summary) {
            html += `<div style="display:flex;gap:12px;margin-bottom:10px;font-size:12px;">
              <span style="color:#ef4444;">Critical: ${summary.critical || 0}</span>
              <span style="color:#f59e0b;">Warning: ${summary.warning || 0}</span>
              <span style="color:#3b82f6;">Info: ${summary.info || 0}</span>
            </div>`;
          }

          html += `<table style="width:100%;border-collapse:collapse;font-size:12px;">
            <tr style="border-bottom:1px solid #333;"><th style="text-align:left;padding:5px;">Product</th><th style="text-align:center;padding:5px;">Type</th><th style="text-align:left;padding:5px;">Action</th></tr>`;
          alerts.forEach((a: any) => {
            const color = a.type === "stockout" || a.severity === "critical" ? "#ef4444" : a.type === "overstock" ? "#3b82f6" : "#f59e0b";
            html += `<tr style="border-bottom:1px solid #222;"><td style="padding:5px;">${a.product || a.product_name || "?"}</td><td style="text-align:center;padding:5px;"><span style="color:${color};font-weight:bold;font-size:10px;text-transform:uppercase;">${a.type || a.severity || "alert"}</span></td><td style="padding:5px;color:#888;font-size:11px;">${a.action || a.recommendation || a.message || ""}</td></tr>`;
          });
          html += `</table>`;

          setPopup({ title: `Stock Alerts (${alerts.length})`, content: html });
          break;
        }
      }
    } catch (err: any) {
      setPopup({ title: "Error", content: `<p style="color:#ef4444;">Failed: ${err.message || "Unknown error"}</p>` });
    }
  }, [user, fetchInventory, fetchStoreProfile, fetchWeatherFull]);

  // ---- JARVIS CORE ----
  const sendToJarvis = useCallback(async (text: string) => {
    if (!text.trim() || !user || stateRef.current === "paused") return;

    unlockAudio();
    setState("thinking");
    setTranscript("");
    setJarvisText("");

    const userMsg: Message = { role: "user", content: text.trim() };
    const newHistory = [...historyRef.current, userMsg].slice(-8);
    setHistory(newHistory);

    try {
      const res = await fetch("/api/jarvis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          userId: user.id,
          conversationHistory: newHistory.slice(-2),
          weather: weatherRef.current,
          location: locationRef.current,
          news: newsRef.current,
          lang: appLang,
        }),
      });
      const data = await res.json();
      const rawResponse = data.response || "Brief interruption, Sir.";
      const cleanResponse = rawResponse
        .replace(/[<\[]action[>\]][\s\S]*?[<\[]\/?action[>\]]/gi, "")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim() || "Done, Sir.";

      setHistory(prev => [...prev, { role: "assistant" as const, content: cleanResponse }].slice(-8));
      setJarvisText(cleanResponse);

      // Handle actions
      if (data.actions?.length) {
        for (const action of data.actions as ActionResult[]) {
          if (action.type === "open_url" && action.result?.url) window.open(action.result.url, "_blank");

          if (action.type === "popup" && action.result) {
            setPopup({ title: action.result.title, content: action.result.content });
            setPopupHovered(false);
            if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
            popupTimerRef.current = setTimeout(() => { setPopup(p => popupHovered ? p : null); }, 8000);
          }

          if ((action.type === "list" || action.type === "search") && action.result?.data?.length) {
            setInventoryPopup(action.result.data);
            setInvHovered(false);
            if (invTimerRef.current) clearTimeout(invTimerRef.current);
            invTimerRef.current = setTimeout(() => { setInventoryPopup(p => invHovered ? p : null); }, 8000);
          }

          if ((action.type === "add" || action.type === "reduce" || action.type === "update" || action.type === "duplicate") && action.result?.data) {
            setInventoryPopup([action.result.data]);
            setInvHovered(false);
            if (invTimerRef.current) clearTimeout(invTimerRef.current);
            invTimerRef.current = setTimeout(() => { setInventoryPopup(p => invHovered ? p : null); }, 8000);
          }

          // Feature actions — call actual APIs and show in popup
          if (["product_analysis", "demand_analysis", "category_analysis", "alerts"].includes(action.type)) {
            callFeatureAPI(action.type, action.result);
          }

          // Navigation actions
          if (action.type === "navigate" && action.result?.path) {
            router.push(action.result.path);
          }
        }
      }

      speak(cleanResponse);
    } catch {
      setJarvisText("Connection lost briefly, Sir.");
      speak("Connection lost briefly, Sir.");
    }
  }, [user, speak, unlockAudio, popupHovered, invHovered, callFeatureAPI, router]);

  // ---- REQUEST MIC PERMISSION (must be from user gesture) ----
  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    // If already have a live stream, we're good
    if (micStreamRef.current && micStreamRef.current.active) {
      setMicAllowed(true);
      return true;
    }
    try {
      // Keep the stream alive — Chrome revokes mic permission if all streams are stopped
      // SpeechRecognition needs an active mic permission grant to work
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setMicAllowed(true);
      return true;
    } catch {
      setMicAllowed(false);
      setJarvisText("Microphone blocked. Click the lock icon in Chrome's address bar → allow Microphone → reload.");
      return false;
    }
  }, []);

  // ---- ALWAYS-ON RECOGNITION ----
  const restartCountRef = useRef(0);

  const startRecognition = useCallback(() => {
    const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechAPI) return;

    // Abort any existing recognition cleanly
    if (recognitionRef.current) {
      try { recognitionRef.current.onend = null; recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }

    const recognition = new SpeechAPI();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    isListeningRef.current = true;

    let finalTranscript = "";
    let wakeWordCooldown = false;

    recognition.onresult = (event: any) => {
      // Reset restart counter on any successful result — recognition is working
      restartCountRef.current = 0;

      if (stateRef.current === "paused") return;

      let interim = "", newFinal = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) newFinal += t; else interim += t;
      }

      // Wake word check — check every result (interim + final)
      if (stateRef.current === "sleeping") {
        const check = (newFinal + interim).toLowerCase();
        if (!wakeWordCooldown && (check.includes("jarvis") || check.includes("jarv") || check.includes("wake up"))) {
          wakeWordCooldown = true;
          finalTranscript = "";
          setTranscript("");
          sendToJarvis("Hey Jarvis, wake up.");
          setTimeout(() => { wakeWordCooldown = false; }, 3000);
          return;
        }
        if (interim) setTranscript(interim);
        return;
      }

      if (newFinal) {
        finalTranscript += newFinal;
        if (isSpeakingRef.current) stopSpeaking();
        setTranscript(finalTranscript);
        setState("listening");

        // 1.2s silence = send (fast response)
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (finalTranscript.trim()) {
            const t = finalTranscript.trim();
            finalTranscript = "";
            sendToJarvis(t);
          }
        }, 1200);
      }

      if (interim) {
        if (isSpeakingRef.current) stopSpeaking();
        if (stateRef.current !== "thinking") setState("listening");
        setTranscript(finalTranscript + interim);
      }
    };

    recognition.onerror = (event: any) => {
      const err = event.error;
      if (err === "not-allowed" || err === "service-not-allowed") {
        isListeningRef.current = false;
        setMicAllowed(false);
        setJarvisText("Microphone blocked. Click the lock icon in Chrome's address bar → allow Microphone → reload.");
        return;
      }
      // For "no-speech", "audio-capture", "network" — let onend handle restart
      // "aborted" means we intentionally stopped — ignore
    };

    recognition.onend = () => {
      if (!isListeningRef.current || stateRef.current === "paused") return;

      // Exponential backoff restart to avoid rapid loops
      restartCountRef.current++;
      const delay = Math.min(100 * Math.pow(2, restartCountRef.current - 1), 5000);

      setTimeout(() => {
        if (!isListeningRef.current || stateRef.current === "paused") return;
        try {
          recognition.start();
          // If start succeeds, reset counter after a beat
          setTimeout(() => { if (recognitionRef.current === recognition) restartCountRef.current = Math.max(0, restartCountRef.current - 1); }, 1000);
        } catch {
          // If start fails, do a full restart with fresh instance
          startRecognition();
        }
      }, delay);
    };

    try {
      recognition.start();
      restartCountRef.current = 0;
    } catch {
      // If start fails immediately, retry with backoff
      setTimeout(() => startRecognition(), 500);
    }
  }, [lang, stopSpeaking, sendToJarvis]);

  // Keep the ref in sync so resumeJarvis can call startRecognition without circular deps
  useEffect(() => { startRecognitionRef.current = startRecognition; }, [startRecognition]);

  // On mount: check if mic permission is already granted (no prompt), then auto-start
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        // navigator.permissions.query doesn't prompt — it just checks current state
        const result = await navigator.permissions.query({ name: "microphone" as PermissionName });
        if (cancelled) return;

        if (result.state === "granted") {
          // Already granted — get a stream to keep permission alive, then start recognition
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
            micStreamRef.current = stream;
            setMicAllowed(true);
            startRecognition();
          } catch {
            setMicAllowed(false);
          }
        } else if (result.state === "denied") {
          setMicAllowed(false);
          setJarvisText("Microphone blocked. Click the lock icon in Chrome's address bar → allow Microphone → reload.");
        } else {
          // "prompt" state — don't auto-request, wait for user gesture (click "Initialize Jarvis")
          setMicAllowed(null);
        }

        // Listen for permission changes (user toggles in browser settings)
        result.onchange = () => {
          if (result.state === "granted" && !cancelled) {
            setMicAllowed(true);
            if (!isListeningRef.current) startRecognition();
          } else if (result.state === "denied") {
            setMicAllowed(false);
            isListeningRef.current = false;
            try { recognitionRef.current?.abort(); } catch {}
          }
        };
      } catch {
        // permissions.query not supported — wait for user gesture
        setMicAllowed(null);
      }
    })();

    return () => {
      cancelled = true;
      isListeningRef.current = false;
      try { if (recognitionRef.current) { recognitionRef.current.onend = null; recognitionRef.current.abort(); } } catch {}
      // Clean up mic stream on unmount
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    };
  }, [user, startRecognition]);

  // ---- CLAP DETECTION (double clap to wake) ----
  // Only start clap detection once mic is already allowed (reuse the existing stream)
  useEffect(() => {
    if (!user || micAllowed !== true) return;
    let cancelled = false;
    let retryCount = 0;

    async function startClapDetection() {
      try {
        // Reuse existing mic stream if available, otherwise request a new one
        let stream = micStreamRef.current;
        if (!stream || !stream.active) {
          stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
          if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        }
        clapStreamRef.current = stream;

        const audioCtx = new AudioContext();
        clapCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.1; // fast response for sharp sounds
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let lastClapTime = 0;
        let clapCount = 0;
        let cooldown = false;
        let baselineRms = 0;
        let sampleCount = 0;

        function detect() {
          if (cancelled) return;
          clapAnimRef.current = requestAnimationFrame(detect);

          // Only detect claps when sleeping
          if (stateRef.current !== "sleeping") {
            clapCount = 0;
            return;
          }

          analyser.getByteTimeDomainData(dataArray);
          // Calculate RMS from time domain (better for transient detection like claps)
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const v = (dataArray[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / dataArray.length) * 100;

          // Build baseline from first 60 frames (~1 second)
          if (sampleCount < 60) {
            baselineRms = (baselineRms * sampleCount + rms) / (sampleCount + 1);
            sampleCount++;
            return;
          }

          // Clap = sudden spike 3x above baseline (works for soft claps too)
          const threshold = Math.max(8, baselineRms * 3);
          const now = Date.now();

          if (rms > threshold && !cooldown) {
            cooldown = true;
            clapCount++;

            if (clapCount === 1) {
              lastClapTime = now;
            } else if (clapCount >= 2 && now - lastClapTime < 1200) {
              // Double clap detected!
              clapCount = 0;
              window.dispatchEvent(new CustomEvent("jarvis-clap-wake"));
            }

            // Reset if gap too long
            if (now - lastClapTime > 1500) {
              clapCount = 1;
              lastClapTime = now;
            }

            setTimeout(() => { cooldown = false; }, 200);
          }

          // Slowly adapt baseline to ambient noise
          baselineRms = baselineRms * 0.995 + rms * 0.005;
        }

        detect();
      } catch {
        // Retry after delay if mic not ready yet
        if (!cancelled && retryCount < 3) {
          retryCount++;
          setTimeout(startClapDetection, 3000);
        }
      }
    }

    const timer = setTimeout(startClapDetection, 1500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (clapAnimRef.current) cancelAnimationFrame(clapAnimRef.current);
      // Don't stop the shared mic stream — only stop clap-specific resources
      clapCtxRef.current?.close().catch(() => {});
    };
  }, [user, micAllowed]);

  // Listen for clap wake event
  useEffect(() => {
    function handleClapWake() {
      if (stateRef.current === "sleeping") {
        unlockAudio();
        sendToJarvis("Hey Jarvis, wake up.");
      }
    }
    window.addEventListener("jarvis-clap-wake", handleClapWake);
    return () => window.removeEventListener("jarvis-clap-wake", handleClapWake);
  }, [sendToJarvis, unlockAudio]);

  const wakeUp = useCallback(async () => {
    unlockAudio();
    // Request mic permission on first click (user gesture required by Chrome)
    if (micAllowed !== true) {
      const granted = await requestMicPermission();
      if (!granted) return;
      // Start recognition now that we have permission from user gesture
      startRecognition();
      // Small delay to let recognition initialize before sending wake command
      await new Promise(r => setTimeout(r, 300));
    }
    if (state === "sleeping" || state === "paused") {
      if (state === "paused") resumeJarvis();
      sendToJarvis("Hey Jarvis, wake up.");
    }
  }, [state, sendToJarvis, unlockAudio, resumeJarvis, micAllowed, requestMicPermission, startRecognition]);

  // ---- RENDER ----
  const stateColor: Record<JarvisState, string> = {
    sleeping: "from-gray-600 to-gray-800", listening: "from-cyan-500 to-blue-600",
    thinking: "from-amber-500 to-orange-600", speaking: "from-cyan-400 to-indigo-600",
    idle: "from-cyan-600 to-blue-700", paused: "from-gray-500 to-gray-600",
  };
  const stateGlow: Record<JarvisState, string> = {
    sleeping: "shadow-gray-500/20", listening: "shadow-cyan-500/40",
    thinking: "shadow-amber-500/40", speaking: "shadow-cyan-500/60",
    idle: "shadow-cyan-500/20", paused: "shadow-gray-500/20",
  };
  const stateLabel: Record<JarvisState, string> = {
    sleeping: "STANDBY", listening: "LISTENING", thinking: "PROCESSING",
    speaking: "SPEAKING", idle: "ONLINE", paused: "PAUSED",
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col items-center justify-center relative overflow-hidden" onClick={() => {
      unlockAudio();
      // On any click, try to get mic permission if not yet granted (user gesture context)
      if (micAllowed === null) requestMicPermission().then(ok => { if (ok && !isListeningRef.current) startRecognition(); });
    }}>
      {/* Background */}
      <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)", backgroundSize: "40px 40px" }} />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-3 z-10">
        <div className="flex items-center gap-3">
          {weather && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <Cloud className="w-3.5 h-3.5 text-cyan-500" />{weather.temp}°C, {weather.description}
            </div>
          )}
          {locationName && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <MapPin className="w-3.5 h-3.5 text-cyan-500" /><span className="max-w-[200px] truncate">{locationName}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {state !== "sleeping" && (
            <button
              onClick={state === "paused" ? resumeJarvis : pauseJarvis}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                state === "paused" ? "bg-green-500/20 text-green-500" : "bg-orange-500/20 text-orange-500"
              }`}
            >
              {state === "paused" ? <><PlayCircle className="w-3.5 h-3.5" /> Resume</> : <><PauseCircle className="w-3.5 h-3.5" /> Pause</>}
            </button>
          )}
          <button onClick={() => setLang(l => l === "en-IN" ? "hi-IN" : "en-IN")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/50 backdrop-blur-sm rounded-full text-xs text-muted-foreground hover:text-foreground">
            <Globe className="w-3.5 h-3.5" />{lang === "en-IN" ? "EN" : "HI"}
          </button>
          <button onClick={() => { setVoiceEnabled(!voiceEnabled); if (isSpeakingRef.current) stopSpeaking(); }}
            className={`p-1.5 rounded-full ${voiceEnabled ? "bg-cyan-500/20 text-cyan-500" : "bg-secondary/50 text-muted-foreground"}`}>
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Central orb */}
      <div className="flex flex-col items-center gap-8 z-10">
        <button onClick={state === "sleeping" || state === "paused" ? wakeUp : stopSpeaking} className="relative group"
          aria-label={state === "sleeping" ? "Wake up Jarvis" : "Jarvis"}>
          <div className={`absolute inset-[-20px] rounded-full border border-cyan-500/10 ${!["sleeping","paused"].includes(state) ? "animate-spin" : ""}`} style={{ animationDuration: "8s" }} />
          <div className={`absolute inset-[-35px] rounded-full border border-cyan-500/5 ${!["sleeping","paused"].includes(state) ? "animate-spin" : ""}`} style={{ animationDuration: "12s", animationDirection: "reverse" }} />
          {(state === "listening" || state === "speaking") && (
            <><div className="absolute inset-[-12px] rounded-full bg-cyan-500/10 animate-ping" style={{ animationDuration: "2s" }} />
            <div className="absolute inset-[-6px] rounded-full bg-cyan-500/15 animate-pulse" /></>
          )}
          {state === "thinking" && <div className="absolute inset-[-8px] rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />}
          <div className={`w-32 h-32 rounded-full bg-gradient-to-br ${stateColor[state]} flex items-center justify-center shadow-2xl ${stateGlow[state]} transition-all duration-700 ${["sleeping","paused"].includes(state) ? "cursor-pointer group-hover:scale-110" : ""}`}>
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-white/10 to-transparent flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-white/20 to-transparent flex items-center justify-center">
                {state === "paused"
                  ? <PauseCircle className="w-8 h-8 text-white" />
                  : <Bot className={`w-8 h-8 text-white ${state === "thinking" ? "animate-pulse" : ""}`} />}
              </div>
            </div>
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
            <div className={`px-3 py-0.5 rounded-full text-[10px] font-bold tracking-widest bg-gradient-to-r ${stateColor[state]} text-white`}>{stateLabel[state]}</div>
          </div>
        </button>

        <div className="text-center">
          <h1 className={`text-3xl font-bold tracking-tight transition-colors duration-500 ${["sleeping","paused"].includes(state) ? "text-muted-foreground" : "text-foreground"}`}>J.A.R.V.I.S.</h1>
          <p className="text-xs text-muted-foreground mt-1 tracking-wider">YOUR PERSONAL STORE ASSISTANT</p>
        </div>

        {/* User transcript */}
        {state === "listening" && transcript && (
          <div className="max-w-lg text-center animate-in fade-in">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Mic className="w-4 h-4 text-cyan-500 animate-pulse" />
              <span className="text-xs text-cyan-500 font-medium tracking-wider">LISTENING</span>
            </div>
            <p className="text-lg text-foreground/80 italic">&quot;{transcript}&quot;</p>
          </div>
        )}

        {/* Jarvis response */}
        {["speaking", "idle", "thinking", "paused"].includes(state) && displayedText && (
          <div className="max-w-2xl text-center animate-in fade-in px-4">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-cyan-500" />
              <span className="text-xs text-cyan-500 font-medium tracking-wider">JARVIS</span>
            </div>
            <p className="text-base sm:text-lg text-foreground leading-relaxed">
              {displayedText}
              {state === "speaking" && displayedText.length < jarvisText.length && <span className="inline-block w-0.5 h-5 bg-cyan-500 ml-1 animate-pulse" />}
            </p>
          </div>
        )}

        {/* Thinking */}
        {state === "thinking" && !displayedText && (
          <div className="flex items-center gap-3 animate-in fade-in">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-sm text-amber-500 font-medium">Processing, Sir...</span>
          </div>
        )}

        {/* Sleeping / Paused CTA + Features */}
        {(state === "sleeping" || state === "paused") && !displayedText && (
          <div className="text-center animate-in fade-in max-w-2xl">
            <p className="text-muted-foreground mb-5">
              {state === "paused" ? "Jarvis is paused. Click resume or the orb to continue." :
                micAllowed === false ? (
                  <span className="flex flex-col items-center gap-2 text-red-400">
                    <span>Microphone access denied.</span>
                    <span className="text-xs text-muted-foreground">Click the lock/site-settings icon in Chrome&apos;s address bar → Allow Microphone → Reload the page</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2"><Mic className="w-4 h-4 text-cyan-500/50 animate-pulse" /> Say <strong>&quot;Hey Jarvis&quot;</strong> or click below</span>
                )
              }
            </p>
            <button onClick={wakeUp}
              className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-full font-semibold hover:shadow-lg hover:shadow-cyan-500/30 transition-all hover:scale-105 flex items-center gap-2 mx-auto mb-8">
              <Zap className="w-4 h-4" /> {state === "paused" ? "Resume Jarvis" : "Initialize Jarvis"}
            </button>

            {state === "sleeping" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-2"><Mic className="w-4 h-4 text-cyan-500" /></div>
                  <p className="text-xs font-semibold text-foreground">Voice Control</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Speak naturally in Hindi or English</p>
                </div>
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center mb-2"><Package className="w-4 h-4 text-purple-500" /></div>
                  <p className="text-xs font-semibold text-foreground">Inventory Mgmt</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Add, update, delete products by voice</p>
                </div>
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-2"><TrendingUp className="w-4 h-4 text-indigo-500" /></div>
                  <p className="text-xs font-semibold text-foreground">AI Analysis</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Product, demand, category analysis on command</p>
                </div>
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-3">
                  <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center mb-2"><AlertTriangle className="w-4 h-4 text-green-500" /></div>
                  <p className="text-xs font-semibold text-foreground">Smart Alerts</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Stockout & overstock alerts with voice</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick actions */}
        {state === "idle" && (
          <div className="flex flex-wrap justify-center gap-2 max-w-2xl animate-in fade-in">
            {[
              { label: "Show inventory", icon: Package },
              { label: "Product analysis for Milk", icon: TrendingUp },
              { label: "Show demand spikes", icon: BarChart3 },
              { label: "Category analysis", icon: Tag },
              { label: "Show alerts", icon: AlertTriangle },
              { label: "Weather update", icon: Cloud },
              { label: "Show forecasts", icon: TrendingUp },
              { label: "Daily news", icon: ExternalLink },
            ].map(({ label, icon: Icon }) => (
              <button key={label} onClick={() => sendToJarvis(label)}
                className="flex items-center gap-2 px-4 py-2 bg-secondary/50 backdrop-blur-sm hover:bg-secondary text-sm text-muted-foreground hover:text-foreground rounded-full transition-all">
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Feature Popup */}
      {popup && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right w-[480px] max-h-[75vh] bg-card border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/10 overflow-hidden"
          onMouseEnter={() => { setPopupHovered(true); if (popupTimerRef.current) clearTimeout(popupTimerRef.current); }}
          onMouseLeave={() => { setPopupHovered(false); popupTimerRef.current = setTimeout(() => setPopup(null), 5000); }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-cyan-500/10 to-blue-500/10">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              {popup.loading ? <Loader2 className="w-3.5 h-3.5 text-cyan-500 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-cyan-500" />}
              {popup.title}
            </h3>
            <button onClick={() => setPopup(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-4 overflow-y-auto max-h-[60vh] text-sm text-foreground/80 leading-relaxed [&_table]:w-full [&_th]:text-left [&_th]:text-muted-foreground [&_th]:font-semibold [&_td]:text-foreground/80" dangerouslySetInnerHTML={{ __html: popup.content }} />
          {!popupHovered && !popup.loading && <div className="h-0.5 bg-cyan-500/30"><div className="h-full bg-cyan-500" style={{ animation: "shrink 8s linear forwards" }} /></div>}
        </div>
      )}

      {/* Inventory popup */}
      {inventoryPopup && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right w-[520px] max-h-[75vh] bg-card border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/10 overflow-hidden"
          onMouseEnter={() => { setInvHovered(true); if (invTimerRef.current) clearTimeout(invTimerRef.current); }}
          onMouseLeave={() => { setInvHovered(false); invTimerRef.current = setTimeout(() => setInventoryPopup(null), 5000); }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-cyan-500/10 to-blue-500/10">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-cyan-500" /> Inventory — {inventoryPopup.length} {inventoryPopup.length === 1 ? "item" : "items"}
            </h3>
            <button onClick={() => setInventoryPopup(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          <div className="overflow-y-auto max-h-[60vh]">
            <table className="w-full text-xs">
              <thead className="bg-secondary/60 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2.5 text-muted-foreground font-semibold uppercase tracking-wider">#</th>
                  <th className="text-left px-3 py-2.5 text-muted-foreground font-semibold uppercase tracking-wider">Product</th>
                  <th className="text-left px-3 py-2.5 text-muted-foreground font-semibold uppercase tracking-wider">Category</th>
                  <th className="text-right px-3 py-2.5 text-muted-foreground font-semibold uppercase tracking-wider">Qty</th>
                  <th className="text-right px-3 py-2.5 text-muted-foreground font-semibold uppercase tracking-wider">Price</th>
                  <th className="text-center px-3 py-2.5 text-muted-foreground font-semibold uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {inventoryPopup.map((item: any, i: number) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-cyan-500/5">
                    <td className="px-3 py-2.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-foreground">{item.product_name}</p>
                      {item.brand && <p className="text-muted-foreground text-[10px]">{item.brand}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{item.category}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-foreground">{item.quantity} <span className="text-muted-foreground font-normal">{item.unit || "pcs"}</span></td>
                    <td className="px-3 py-2.5 text-right text-foreground font-medium">₹{item.price}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-block w-2 h-2 rounded-full ${
                        item.quantity <= (item.min_stock || 10) ? "bg-red-500" : item.quantity >= (item.max_stock || 999) ? "bg-yellow-500" : "bg-green-500"
                      }`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!invHovered && <div className="h-0.5 bg-cyan-500/30"><div className="h-full bg-cyan-500" style={{ animation: "shrink 8s linear forwards" }} /></div>}
        </div>
      )}

      {/* Bottom mic */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all ${
          state === "listening" ? "bg-cyan-500/20 text-cyan-500" : state === "paused" ? "bg-orange-500/20 text-orange-500" : "bg-secondary/50 text-muted-foreground"
        }`}>
          <Mic className={`w-3.5 h-3.5 ${state === "listening" ? "animate-pulse text-cyan-500" : micAllowed === false ? "text-red-500" : ""}`} />
          {micAllowed === false ? "Mic blocked — allow in browser" : state === "listening" ? "Listening..." : state === "paused" ? "Paused — 60s auto-resume" : state === "sleeping" ? "Click to start or say \"Hey Jarvis\"" : "Always listening"}
        </div>
      </div>

      {/* Corners */}
      <div className="absolute top-0 left-0 w-16 h-16 border-l-2 border-t-2 border-cyan-500/10" />
      <div className="absolute top-0 right-0 w-16 h-16 border-r-2 border-t-2 border-cyan-500/10" />
      <div className="absolute bottom-0 left-0 w-16 h-16 border-l-2 border-b-2 border-cyan-500/10" />
      <div className="absolute bottom-0 right-0 w-16 h-16 border-r-2 border-b-2 border-cyan-500/10" />
    </div>
  );
}
