"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { LangCode, getTranslation, LANGUAGES } from "./translations";

interface LangContextType {
  lang: LangCode;
  setLang: (lang: LangCode) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LangContext = createContext<LangContextType>({
  lang: "en",
  setLang: () => {},
  t: (key) => key,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>("en");

  useEffect(() => {
    const saved = localStorage.getItem("forecastify-lang") as LangCode;
    if (saved && LANGUAGES.some(l => l.code === saved)) {
      setLangState(saved);
    }
  }, []);

  const setLang = useCallback((newLang: LangCode) => {
    setLangState(newLang);
    localStorage.setItem("forecastify-lang", newLang);
  }, []);

  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    return getTranslation(lang, key, vars);
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
