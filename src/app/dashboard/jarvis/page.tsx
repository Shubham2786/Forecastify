"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Mic, Volume2, VolumeX, Bot, Globe, X, Package,
  Cloud, MapPin, Zap, AlertTriangle, ExternalLink,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface PopupData {
  title: string;
  content: string;
}

interface ActionResult {
  type: string;
  result: any;
}

type JarvisState = "sleeping" | "listening" | "thinking" | "speaking" | "idle";

export default function JarvisPage() {
  const { user } = useAuth();

  // Core state
  const [state, setState] = useState<JarvisState>("sleeping");
  const [transcript, setTranscript] = useState("");
  const [jarvisText, setJarvisText] = useState("");
  const [displayedText, setDisplayedText] = useState("");
  const [history, setHistory] = useState<Message[]>([]);

  // Data
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

  // Refs
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

  // Keep refs in sync
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { weatherRef.current = weather; }, [weather]);
  useEffect(() => { locationRef.current = locationName; }, [locationName]);
  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { newsRef.current = newsData; }, [newsData]);

  // Typewriter effect
  useEffect(() => {
    if (!jarvisText) { setDisplayedText(""); return; }
    let i = 0;
    setDisplayedText("");
    const timer = setInterval(() => {
      setDisplayedText(jarvisText.slice(0, i + 1));
      i++;
      if (i >= jarvisText.length) clearInterval(timer);
    }, 22);
    return () => clearInterval(timer);
  }, [jarvisText]);

  // Init speech synthesis + preload voices
  const [voicesReady, setVoicesReady] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    synthRef.current = window.speechSynthesis;
    const loadVoices = () => {
      const v = synthRef.current?.getVoices();
      if (v && v.length > 0) setVoicesReady(true);
    };
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
    // Poll for voices (some browsers are slow)
    const poll = setInterval(() => {
      loadVoices();
      if (voicesReady) clearInterval(poll);
    }, 500);
    return () => clearInterval(poll);
  }, [voicesReady]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
        );
        const { latitude: lat, longitude: lon } = pos.coords;
        const [wRes, lRes] = await Promise.all([
          fetch(`/api/weather?lat=${lat}&lon=${lon}`),
          fetch(`/api/location?lat=${lat}&lon=${lon}`),
        ]);
        let city = "", state = "";
        if (wRes.ok) { const d = await wRes.json(); setWeather(d.current); }
        if (lRes.ok) { const d = await lRes.json(); setLocationName(d.formattedAddress || d.city || ""); city = d.city || ""; state = d.state || ""; }

        // Fetch news in background
        try {
          const nRes = await fetch("/api/news", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ storeCategory: "Retail", city, state }),
          });
          if (nRes.ok) { const nd = await nRes.json(); setNewsData(nd); }
        } catch { /* news fetch failed — non-critical */ }
      } catch { /* location denied */ }
    })();
  }, [user]);

  // ---- SPEECH ----
  const speak = useCallback((text: string, onDone?: () => void) => {
    if (!voiceEnabled || !synthRef.current) { onDone?.(); return; }

    // Cancel any ongoing speech
    synthRef.current.cancel();

    // Clean text for speech
    const clean = text
      .replace(/[*#_`~]/g, "")
      .replace(/\n+/g, ". ")
      .replace(/https?:\/\/\S+/g, "link")
      .replace(/\s+/g, " ")
      .trim();

    if (!clean) { onDone?.(); return; }

    // Split into short chunks (Chrome cuts off long utterances)
    const chunks = clean.match(/[^.!?,;:]+[.!?,;:]*/g) || [clean];

    setState("speaking");
    isSpeakingRef.current = true;

    const voices = synthRef.current.getVoices();
    // Pick best voice
    let voice: SpeechSynthesisVoice | null = null;
    if (lang === "hi-IN") {
      voice = voices.find(v => v.lang === "hi-IN") || voices.find(v => v.lang.startsWith("hi")) || null;
    } else {
      voice = voices.find(v => v.name.includes("Samantha")) ||
              voices.find(v => v.name.includes("Daniel")) ||
              voices.find(v => v.name.includes("Google") && v.lang.startsWith("en")) ||
              voices.find(v => v.lang === "en-IN") ||
              voices.find(v => v.lang.startsWith("en")) || null;
    }

    let idx = 0;
    const speakNext = () => {
      if (!isSpeakingRef.current) { onDone?.(); return; }
      if (idx >= chunks.length) {
        isSpeakingRef.current = false;
        setState("idle");
        onDone?.();
        return;
      }

      const chunk = chunks[idx].trim();
      if (!chunk) { idx++; speakNext(); return; }

      const utt = new SpeechSynthesisUtterance(chunk);
      utt.lang = lang;
      utt.rate = 1.0;
      utt.pitch = 1.0;
      utt.volume = 1.0;
      if (voice) utt.voice = voice;

      utt.onend = () => { idx++; speakNext(); };
      utt.onerror = () => { idx++; speakNext(); };

      synthRef.current?.speak(utt);

      // Chrome bug: speech stops after ~15s. Resume it.
      if (typeof window !== "undefined") {
        const resumeTimer = setInterval(() => {
          if (!synthRef.current?.speaking) { clearInterval(resumeTimer); return; }
          synthRef.current?.pause();
          synthRef.current?.resume();
        }, 10000);
        utt.onend = () => { clearInterval(resumeTimer); idx++; speakNext(); };
        utt.onerror = () => { clearInterval(resumeTimer); idx++; speakNext(); };
      }
    };

    speakNext();
  }, [voiceEnabled, lang]);

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    isSpeakingRef.current = false;
    if (stateRef.current === "speaking") setState("idle");
  }, []);

  // ---- JARVIS CORE ----
  const sendToJarvis = useCallback(async (text: string) => {
    if (!text.trim() || !user) return;

    setState("thinking");
    setTranscript("");
    setJarvisText("");

    const userMsg: Message = { role: "user", content: text.trim() };
    const newHistory = [...historyRef.current, userMsg].slice(-12);
    setHistory(newHistory);

    try {
      const res = await fetch("/api/jarvis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          userId: user.id,
          conversationHistory: newHistory,
          weather: weatherRef.current,
          location: locationRef.current,
          news: newsRef.current,
        }),
      });
      const data = await res.json();
      const response = data.response || "Systems experiencing a brief interruption, Sir.";

      const assistantMsg: Message = { role: "assistant", content: response };
      setHistory(prev => [...prev, assistantMsg].slice(-12));
      setJarvisText(response);

      // Handle actions
      if (data.actions?.length) {
        for (const action of data.actions as ActionResult[]) {
          if (action.type === "open_url" && action.result?.url) {
            window.open(action.result.url, "_blank");
          }
          if (action.type === "popup" && action.result) {
            setPopup({ title: action.result.title, content: action.result.content });
            setPopupHovered(false);
            if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
            popupTimerRef.current = setTimeout(() => { if (!popupHovered) setPopup(null); }, 5000);
          }
          if ((action.type === "list" || action.type === "search") && action.result?.data?.length) {
            setInventoryPopup(action.result.data);
            setInvHovered(false);
            if (invTimerRef.current) clearTimeout(invTimerRef.current);
            invTimerRef.current = setTimeout(() => { if (!invHovered) setInventoryPopup(null); }, 5000);
          }
          if ((action.type === "add" || action.type === "reduce") && action.result?.data) {
            setInventoryPopup([action.result.data]);
            setInvHovered(false);
            if (invTimerRef.current) clearTimeout(invTimerRef.current);
            invTimerRef.current = setTimeout(() => { if (!invHovered) setInventoryPopup(null); }, 5000);
          }
        }
      }

      speak(response, () => {
        setState("idle");
      });
    } catch {
      const errText = "I seem to have lost connection briefly, Sir. Could you repeat that?";
      setJarvisText(errText);
      speak(errText);
    }
  }, [user, speak]);

  // ---- ALWAYS-ON RECOGNITION ----
  const startRecognition = useCallback(() => {
    const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechAPI) return;

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }

    const recognition = new SpeechAPI();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;
    isListeningRef.current = true;

    let finalTranscript = "";

    recognition.onresult = (event: any) => {
      let interim = "";
      let newFinal = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          newFinal += t;
        } else {
          interim += t;
        }
      }

      // Check wake word in both interim and final (for faster response)
      if (stateRef.current === "sleeping") {
        const checkText = (finalTranscript + newFinal + interim).toLowerCase();
        if (checkText.includes("jarvis") || checkText.includes("wake up") || checkText.includes("hey jarvis") || checkText.includes("hello jarvis")) {
          finalTranscript = "";
          setTranscript("");
          sendToJarvis("Hey Jarvis, wake up.");
          return;
        }
        // Show interim while sleeping but don't process anything else
        if (interim) setTranscript(interim);
        return;
      }

      if (newFinal) {
        finalTranscript += newFinal;

        // If Jarvis is speaking, interrupt immediately
        if (isSpeakingRef.current) {
          stopSpeaking();
        }

        setTranscript(finalTranscript);
        setState("listening");

        // Reset silence timer — send after 1.5s of silence
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (finalTranscript.trim()) {
            const text = finalTranscript.trim();
            finalTranscript = "";
            sendToJarvis(text);
          }
        }, 1500);
      }

      if (interim) {
        // If speaking, interrupt on any voice input
        if (isSpeakingRef.current) {
          stopSpeaking();
        }
        if (stateRef.current !== "thinking") {
          setState("listening");
        }
        setTranscript(finalTranscript + interim);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed") {
        isListeningRef.current = false;
        return;
      }
      // Auto-restart on other errors
    };

    recognition.onend = () => {
      // Always restart — always listening
      if (isListeningRef.current) {
        setTimeout(() => {
          try { recognition.start(); } catch { /* retry after delay */ }
        }, 300);
      }
    };

    try { recognition.start(); } catch { /* ignore */ }
  }, [lang, stopSpeaking, sendToJarvis]);

  // Auto-start recognition on mount
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => startRecognition(), 1000);
    return () => {
      clearTimeout(timer);
      isListeningRef.current = false;
      try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    };
  }, [user, startRecognition]);

  // ---- WAKE UP (manual) ----
  const wakeUp = useCallback(() => {
    if (state !== "sleeping") return;
    sendToJarvis("Hey Jarvis, wake up.");
  }, [state, sendToJarvis]);

  // ---- RENDER ----
  const stateColor = {
    sleeping: "from-gray-600 to-gray-800",
    listening: "from-cyan-500 to-blue-600",
    thinking: "from-amber-500 to-orange-600",
    speaking: "from-cyan-400 to-indigo-600",
    idle: "from-cyan-600 to-blue-700",
  };

  const stateGlow = {
    sleeping: "shadow-gray-500/20",
    listening: "shadow-cyan-500/40",
    thinking: "shadow-amber-500/40",
    speaking: "shadow-cyan-500/60",
    idle: "shadow-cyan-500/20",
  };

  const stateLabel = {
    sleeping: "STANDBY",
    listening: "LISTENING",
    thinking: "PROCESSING",
    speaking: "SPEAKING",
    idle: "ONLINE",
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background grid effect */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
        backgroundSize: "40px 40px"
      }} />

      {/* Top status bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-3 z-10">
        <div className="flex items-center gap-4">
          {weather && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <Cloud className="w-3.5 h-3.5 text-cyan-500" />
              <span>{weather.temp}°C, {weather.description}</span>
            </div>
          )}
          {locationName && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <MapPin className="w-3.5 h-3.5 text-cyan-500" />
              <span className="max-w-[200px] truncate">{locationName}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLang(l => l === "en-IN" ? "hi-IN" : "en-IN")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/50 backdrop-blur-sm rounded-full text-xs text-muted-foreground hover:text-foreground"
          >
            <Globe className="w-3.5 h-3.5" />
            {lang === "en-IN" ? "EN" : "HI"}
          </button>
          <button
            onClick={() => { setVoiceEnabled(!voiceEnabled); if (isSpeakingRef.current) stopSpeaking(); }}
            className={`p-1.5 rounded-full ${voiceEnabled ? "bg-cyan-500/20 text-cyan-500" : "bg-secondary/50 text-muted-foreground"}`}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Central Jarvis orb */}
      <div className="flex flex-col items-center gap-8 z-10">
        {/* Arc reactor / orb */}
        <button
          onClick={state === "sleeping" ? wakeUp : undefined}
          className="relative group"
          aria-label={state === "sleeping" ? "Wake up Jarvis" : "Jarvis"}
        >
          {/* Outer rings */}
          <div className={`absolute inset-[-20px] rounded-full border border-cyan-500/10 ${state !== "sleeping" ? "animate-spin" : ""}`} style={{ animationDuration: "8s" }} />
          <div className={`absolute inset-[-35px] rounded-full border border-cyan-500/5 ${state !== "sleeping" ? "animate-spin" : ""}`} style={{ animationDuration: "12s", animationDirection: "reverse" }} />

          {/* Pulse rings when active */}
          {(state === "listening" || state === "speaking") && (
            <>
              <div className="absolute inset-[-12px] rounded-full bg-cyan-500/10 animate-ping" style={{ animationDuration: "2s" }} />
              <div className="absolute inset-[-6px] rounded-full bg-cyan-500/15 animate-pulse" />
            </>
          )}
          {state === "thinking" && (
            <div className="absolute inset-[-8px] rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
          )}

          {/* Main orb */}
          <div className={`w-32 h-32 rounded-full bg-gradient-to-br ${stateColor[state]} flex items-center justify-center shadow-2xl ${stateGlow[state]} transition-all duration-700 ${state === "sleeping" ? "cursor-pointer group-hover:scale-110" : ""}`}>
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-white/10 to-transparent flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-white/20 to-transparent flex items-center justify-center">
                <Bot className={`w-8 h-8 text-white ${state === "thinking" ? "animate-pulse" : ""}`} />
              </div>
            </div>
          </div>

          {/* State indicator */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
            <div className={`px-3 py-0.5 rounded-full text-[10px] font-bold tracking-widest bg-gradient-to-r ${stateColor[state]} text-white`}>
              {stateLabel[state]}
            </div>
          </div>
        </button>

        {/* Jarvis name */}
        <div className="text-center">
          <h1 className={`text-3xl font-bold tracking-tight transition-colors duration-500 ${state === "sleeping" ? "text-muted-foreground" : "text-foreground"}`}>
            J.A.R.V.I.S.
          </h1>
          <p className="text-xs text-muted-foreground mt-1 tracking-wider">
            JUST A RATHER VERY INTELLIGENT SYSTEM
          </p>
        </div>

        {/* Transcript (what user is saying) */}
        {state === "listening" && transcript && (
          <div className="max-w-lg text-center animate-in fade-in">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Mic className="w-4 h-4 text-cyan-500 animate-pulse" />
              <span className="text-xs text-cyan-500 font-medium tracking-wider">LISTENING</span>
            </div>
            <p className="text-lg text-foreground/80 italic">&quot;{transcript}&quot;</p>
          </div>
        )}

        {/* Jarvis response (typewriter) */}
        {(state === "speaking" || state === "idle" || state === "thinking") && displayedText && (
          <div className="max-w-2xl text-center animate-in fade-in px-4">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-cyan-500" />
              <span className="text-xs text-cyan-500 font-medium tracking-wider">JARVIS</span>
            </div>
            <p className="text-base sm:text-lg text-foreground leading-relaxed">
              {displayedText}
              {state === "speaking" && displayedText.length < jarvisText.length && (
                <span className="inline-block w-0.5 h-5 bg-cyan-500 ml-1 animate-pulse" />
              )}
            </p>
          </div>
        )}

        {/* Thinking indicator */}
        {state === "thinking" && !displayedText && (
          <div className="flex items-center gap-3 animate-in fade-in">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-sm text-amber-500 font-medium">Processing your request, Sir...</span>
          </div>
        )}

        {/* Sleep state CTA */}
        {state === "sleeping" && (
          <div className="text-center animate-in fade-in">
            <p className="text-muted-foreground mb-4">
              {isListeningRef.current
                ? <span className="flex items-center justify-center gap-2"><Mic className="w-4 h-4 text-cyan-500/50 animate-pulse" /> Say <strong>&quot;Hey Jarvis&quot;</strong> to wake me up</span>
                : "Click the orb or say \"Hey Jarvis\" to begin"
              }
            </p>
            <button
              onClick={wakeUp}
              className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-full font-semibold hover:shadow-lg hover:shadow-cyan-500/30 transition-all hover:scale-105 flex items-center gap-2 mx-auto"
            >
              <Zap className="w-4 h-4" /> Initialize Jarvis
            </button>
          </div>
        )}

        {/* Quick voice commands when idle */}
        {state === "idle" && (
          <div className="flex flex-wrap justify-center gap-2 max-w-lg animate-in fade-in">
            {[
              { label: "Show inventory", icon: Package },
              { label: "Daily news", icon: ExternalLink },
              { label: "Weather update", icon: Cloud },
              { label: "Any alerts?", icon: AlertTriangle },
            ].map(({ label, icon: Icon }) => (
              <button
                key={label}
                onClick={() => sendToJarvis(label)}
                className="flex items-center gap-2 px-4 py-2 bg-secondary/50 backdrop-blur-sm hover:bg-secondary text-sm text-muted-foreground hover:text-foreground rounded-full transition-all"
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Popup overlay */}
      {popup && (
        <div
          className="fixed top-4 right-4 z-50 animate-in slide-in-from-right w-[420px] max-h-[70vh] bg-card border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/10 overflow-hidden"
          onMouseEnter={() => { setPopupHovered(true); if (popupTimerRef.current) clearTimeout(popupTimerRef.current); }}
          onMouseLeave={() => { setPopupHovered(false); popupTimerRef.current = setTimeout(() => setPopup(null), 3000); }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-cyan-500/10 to-blue-500/10">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-cyan-500" /> {popup.title}
            </h3>
            <button onClick={() => setPopup(null)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 overflow-y-auto max-h-[55vh] text-sm text-foreground/80 leading-relaxed" dangerouslySetInnerHTML={{ __html: popup.content }} />
        </div>
      )}

      {/* Inventory popup — proper table columns */}
      {inventoryPopup && (
        <div
          className="fixed top-4 right-4 z-50 animate-in slide-in-from-right w-[520px] max-h-[75vh] bg-card border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/10 overflow-hidden"
          onMouseEnter={() => { setInvHovered(true); if (invTimerRef.current) clearTimeout(invTimerRef.current); }}
          onMouseLeave={() => { setInvHovered(false); invTimerRef.current = setTimeout(() => setInventoryPopup(null), 3000); }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-cyan-500/10 to-blue-500/10">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-cyan-500" /> Inventory — {inventoryPopup.length} {inventoryPopup.length === 1 ? "item" : "items"}
            </h3>
            <button onClick={() => setInventoryPopup(null)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
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
                  <tr key={i} className="border-b border-border/50 hover:bg-cyan-500/5 transition-colors">
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
                        item.quantity <= (item.min_stock || 10) ? "bg-red-500" :
                        item.quantity >= (item.max_stock || 999) ? "bg-yellow-500" :
                        "bg-green-500"
                      }`} title={
                        item.quantity <= (item.min_stock || 10) ? "Low Stock" :
                        item.quantity >= (item.max_stock || 999) ? "Overstock" : "In Stock"
                      } />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Auto-close progress bar */}
          {!invHovered && (
            <div className="h-0.5 bg-cyan-500/30">
              <div className="h-full bg-cyan-500 animate-shrink" style={{ animation: "shrink 5s linear forwards" }} />
            </div>
          )}
        </div>
      )}

      {/* Bottom mic indicator — always visible */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all ${
          state === "listening"
            ? "bg-cyan-500/20 text-cyan-500"
            : state === "sleeping"
              ? "bg-secondary/50 text-muted-foreground"
              : "bg-secondary/30 text-muted-foreground"
        }`}>
          <Mic className={`w-3.5 h-3.5 ${state === "listening" ? "animate-pulse text-cyan-500" : ""}`} />
          {state === "listening" ? "Listening..." : state === "sleeping" ? "Microphone active — say \"Hey Jarvis\"" : "Always listening"}
        </div>
      </div>

      {/* Decorative corner elements */}
      <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-cyan-500/20 rounded-tl-lg" />
      <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-cyan-500/20 rounded-tr-lg" />
      <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-cyan-500/20 rounded-bl-lg" />
      <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-cyan-500/20 rounded-br-lg" />
    </div>
  );
}
