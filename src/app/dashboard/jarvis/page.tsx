"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Mic, Volume2, VolumeX, Bot, Globe, X, Package,
  Cloud, MapPin, Zap, AlertTriangle, ExternalLink,
  PauseCircle, PlayCircle,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Message { role: "user" | "assistant"; content: string }
interface PopupData { title: string; content: string }
interface ActionResult { type: string; result: any }
type JarvisState = "sleeping" | "listening" | "thinking" | "speaking" | "idle" | "paused";

export default function JarvisPage() {
  const { user } = useAuth();

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

  // Unlock audio on first click (browser requirement)
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

    // Use single utterance for short text (more reliable)
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
    utt.onerror = (e) => { clearInterval(keepAlive); isSpeakingRef.current = false; setState("idle"); onDone?.(); };
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
    // Auto-resume after 60 seconds
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(() => resumeJarvis(), 60000);
  }, [stopSpeaking]);

  const resumeJarvis = useCallback(() => {
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    setState("idle");
    setJarvisText("Back online, Sir.");
    isListeningRef.current = true;
    try {
      const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechAPI && recognitionRef.current) {
        recognitionRef.current.start();
      }
    } catch {}
    speak("Back online, Sir.");
  }, [speak]);

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
          conversationHistory: newHistory.slice(-4),
          weather: weatherRef.current,
          location: locationRef.current,
          news: newsRef.current,
        }),
      });
      const data = await res.json();
      // Strip any leftover action tags from response text
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
            popupTimerRef.current = setTimeout(() => { setPopup(p => popupHovered ? p : null); }, 5000);
          }

          if ((action.type === "list" || action.type === "search") && action.result?.data?.length) {
            setInventoryPopup(action.result.data);
            setInvHovered(false);
            if (invTimerRef.current) clearTimeout(invTimerRef.current);
            invTimerRef.current = setTimeout(() => { setInventoryPopup(p => invHovered ? p : null); }, 5000);
          }

          if ((action.type === "add" || action.type === "reduce" || action.type === "update" || action.type === "duplicate") && action.result?.data) {
            setInventoryPopup([action.result.data]);
            setInvHovered(false);
            if (invTimerRef.current) clearTimeout(invTimerRef.current);
            invTimerRef.current = setTimeout(() => { setInventoryPopup(p => invHovered ? p : null); }, 5000);
          }

          if (action.type === "delete") {
            // Show brief confirmation — no popup needed
          }
        }
      }

      speak(cleanResponse);
    } catch {
      setJarvisText("Connection lost briefly, Sir.");
      speak("Connection lost briefly, Sir.");
    }
  }, [user, speak, unlockAudio, popupHovered, invHovered]);

  // ---- ALWAYS-ON RECOGNITION ----
  const startRecognition = useCallback(() => {
    const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechAPI) return;

    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }

    const recognition = new SpeechAPI();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;
    isListeningRef.current = true;

    let finalTranscript = "";

    recognition.onresult = (event: any) => {
      if (stateRef.current === "paused") return;

      let interim = "", newFinal = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) newFinal += t; else interim += t;
      }

      // Wake word check
      if (stateRef.current === "sleeping") {
        const check = (finalTranscript + newFinal + interim).toLowerCase();
        if (check.includes("jarvis") || check.includes("wake up") || check.includes("hey jarvis") || check.includes("hello jarvis")) {
          finalTranscript = "";
          setTranscript("");
          sendToJarvis("Hey Jarvis, wake up.");
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

        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (finalTranscript.trim()) {
            const t = finalTranscript.trim();
            finalTranscript = "";
            sendToJarvis(t);
          }
        }, 1500);
      }

      if (interim) {
        if (isSpeakingRef.current) stopSpeaking();
        if (stateRef.current !== "thinking") setState("listening");
        setTranscript(finalTranscript + interim);
      }
    };

    recognition.onerror = (event: any) => { if (event.error === "not-allowed") isListeningRef.current = false; };
    recognition.onend = () => {
      if (isListeningRef.current && stateRef.current !== "paused") {
        setTimeout(() => { try { recognition.start(); } catch {} }, 300);
      }
    };
    try { recognition.start(); } catch {}
  }, [lang, stopSpeaking, sendToJarvis]);

  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => startRecognition(), 1000);
    return () => { clearTimeout(t); isListeningRef.current = false; try { recognitionRef.current?.stop(); } catch {} };
  }, [user, startRecognition]);

  const wakeUp = useCallback(() => {
    unlockAudio();
    if (state === "sleeping" || state === "paused") {
      if (state === "paused") resumeJarvis();
      sendToJarvis("Hey Jarvis, wake up.");
    }
  }, [state, sendToJarvis, unlockAudio, resumeJarvis]);

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
    <div className="h-[calc(100vh-8rem)] flex flex-col items-center justify-center relative overflow-hidden" onClick={unlockAudio}>
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
          {/* Pause/Resume */}
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
                <span className="flex items-center justify-center gap-2"><Mic className="w-4 h-4 text-cyan-500/50 animate-pulse" /> Say <strong>&quot;Hey Jarvis&quot;</strong> or click below</span>
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
                  <p className="text-[10px] text-muted-foreground mt-0.5">Speak naturally in Hindi or English to manage your store</p>
                </div>
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center mb-2"><Package className="w-4 h-4 text-purple-500" /></div>
                  <p className="text-xs font-semibold text-foreground">Inventory Mgmt</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Add, update, delete or search products by just saying it</p>
                </div>
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center mb-2"><Cloud className="w-4 h-4 text-blue-500" /></div>
                  <p className="text-xs font-semibold text-foreground">Live Weather</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Real-time weather briefing for your store location</p>
                </div>
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-3">
                  <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center mb-2"><ExternalLink className="w-4 h-4 text-green-500" /></div>
                  <p className="text-xs font-semibold text-foreground">News & Trends</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Latest market news, offers and trending products</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick actions */}
        {state === "idle" && (
          <div className="flex flex-wrap justify-center gap-2 max-w-lg animate-in fade-in">
            {[
              { label: "Show inventory", icon: Package },
              { label: "Daily news", icon: ExternalLink },
              { label: "Weather update", icon: Cloud },
              { label: "Any alerts?", icon: AlertTriangle },
            ].map(({ label, icon: Icon }) => (
              <button key={label} onClick={() => sendToJarvis(label)}
                className="flex items-center gap-2 px-4 py-2 bg-secondary/50 backdrop-blur-sm hover:bg-secondary text-sm text-muted-foreground hover:text-foreground rounded-full transition-all">
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Popup */}
      {popup && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right w-[420px] max-h-[70vh] bg-card border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/10 overflow-hidden"
          onMouseEnter={() => { setPopupHovered(true); if (popupTimerRef.current) clearTimeout(popupTimerRef.current); }}
          onMouseLeave={() => { setPopupHovered(false); popupTimerRef.current = setTimeout(() => setPopup(null), 3000); }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-cyan-500/10 to-blue-500/10">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-cyan-500" /> {popup.title}</h3>
            <button onClick={() => setPopup(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-4 overflow-y-auto max-h-[55vh] text-sm text-foreground/80 leading-relaxed" dangerouslySetInnerHTML={{ __html: popup.content }} />
        </div>
      )}

      {/* Inventory popup */}
      {inventoryPopup && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right w-[520px] max-h-[75vh] bg-card border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/10 overflow-hidden"
          onMouseEnter={() => { setInvHovered(true); if (invTimerRef.current) clearTimeout(invTimerRef.current); }}
          onMouseLeave={() => { setInvHovered(false); invTimerRef.current = setTimeout(() => setInventoryPopup(null), 3000); }}>
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
          {!invHovered && <div className="h-0.5 bg-cyan-500/30"><div className="h-full bg-cyan-500" style={{ animation: "shrink 5s linear forwards" }} /></div>}
        </div>
      )}

      {/* Bottom mic */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all ${
          state === "listening" ? "bg-cyan-500/20 text-cyan-500" : state === "paused" ? "bg-orange-500/20 text-orange-500" : "bg-secondary/50 text-muted-foreground"
        }`}>
          <Mic className={`w-3.5 h-3.5 ${state === "listening" ? "animate-pulse text-cyan-500" : ""}`} />
          {state === "listening" ? "Listening..." : state === "paused" ? "Paused — 60s auto-resume" : state === "sleeping" ? "Say \"Hey Jarvis\"" : "Always listening"}
        </div>
      </div>

      {/* Corners */}
      <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-cyan-500/20 rounded-tl-lg" />
      <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-cyan-500/20 rounded-tr-lg" />
      <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-cyan-500/20 rounded-bl-lg" />
      <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-cyan-500/20 rounded-br-lg" />
    </div>
  );
}
