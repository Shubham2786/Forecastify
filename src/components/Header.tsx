"use client";

import { useRouter } from "next/navigation";
import { Menu, Moon, Sun, Bell, Globe } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { useLang } from "@/lib/lang-context";
import { LANGUAGES } from "@/lib/translations";

interface HeaderProps {
  onMenuClick: () => void;
  title: string;
}

export default function Header({ onMenuClick, title }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang } = useLang();
  const router = useRouter();

  const currentLang = LANGUAGES.find(l => l.code === lang);

  return (
    <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-secondary">
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg sm:text-xl font-bold text-foreground">{title}</h1>
      </div>
      <div className="flex items-center gap-1.5">
        {/* Language Selector */}
        <div className="relative">
          <select
            value={lang}
            onChange={e => setLang(e.target.value as any)}
            className="appearance-none pl-8 pr-3 py-1.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.nativeName}</option>
            ))}
          </select>
          <Globe className="w-4 h-4 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Alerts */}
        <button
          onClick={() => router.push("/dashboard/alerts")}
          className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
          title="Alerts"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full" />
        </button>

        {/* Theme Toggle */}
        <button onClick={toggleTheme} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary" aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
    </header>
  );
}
