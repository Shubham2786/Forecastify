"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import {
  Search, ExternalLink, Megaphone, Newspaper, ShoppingBag,
  Loader2, Tag, RefreshCw,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface PromoItem {
  title: string;
  snippet: string;
  link: string;
}

interface PromoResults {
  offers: PromoItem[];
  promotions: PromoItem[];
  news: PromoItem[];
}

export default function MarketInsightsPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PromoResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("");

  // Load unique categories from inventory
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("inventory")
        .select("category")
        .eq("store_id", user.id);
      if (data) {
        const unique = [...new Set(data.map((r: any) => r.category).filter(Boolean))];
        setCategories(unique);
      }
    })();
  }, [user]);

  const searchPromos = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setActiveCategory(q);
    try {
      const res = await fetch("/api/search-promos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q.trim() }),
      });
      if (res.ok) setResults(await res.json());
    } catch {} finally { setLoading(false); }
  };

  const handleSearch = () => searchPromos(query);

  return (
    <div className="space-y-5">
      {/* Search Bar */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
          <Megaphone className="w-5 h-5 text-pink-500" /> Search Market Insights
        </h3>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search any product or category (e.g. Soap, Rice, Shampoo)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>

        {/* Quick category chips from inventory */}
        {categories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1">
              <Tag className="w-3 h-3" /> Your categories:
            </span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => { setQuery(cat); searchPromos(cat); }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                  activeCategory === cat
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-secondary text-foreground border-border hover:border-indigo-500/50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Searching for &quot;{activeCategory}&quot;...</p>
          </div>
        </div>
      )}

      {!loading && results && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">
              Results for &quot;<span className="text-primary">{activeCategory}</span>&quot;
            </h3>
            <button onClick={() => searchPromos(activeCategory)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Offers & Deals */}
            <div className="bg-linear-to-br from-green-500/5 to-green-500/10 border border-green-500/20 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                <ShoppingBag className="w-4 h-4 text-green-500" /> Offers & Deals
              </h4>
              {results.offers?.length > 0 ? (
                <div className="space-y-4">
                  {results.offers.map((item, i) => (
                    <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" className="block group">
                      <p className="text-sm font-medium text-foreground group-hover:text-green-500 transition-colors line-clamp-2 flex items-start gap-1">
                        {item.title}
                        <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{item.snippet}</p>
                    </a>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground py-4">No offers found for this category</p>}
            </div>

            {/* Promotions & Ads */}
            <div className="bg-linear-to-br from-amber-500/5 to-amber-500/10 border border-amber-500/20 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                <Megaphone className="w-4 h-4 text-amber-500" /> Promotions & Ads
              </h4>
              {results.promotions?.length > 0 ? (
                <div className="space-y-4">
                  {results.promotions.map((item, i) => (
                    <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" className="block group">
                      <p className="text-sm font-medium text-foreground group-hover:text-amber-500 transition-colors line-clamp-2 flex items-start gap-1">
                        {item.title}
                        <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{item.snippet}</p>
                    </a>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground py-4">No promotions found for this category</p>}
            </div>

            {/* Market News */}
            <div className="bg-linear-to-br from-blue-500/5 to-blue-500/10 border border-blue-500/20 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                <Newspaper className="w-4 h-4 text-blue-500" /> Market News & Trends
              </h4>
              {results.news?.length > 0 ? (
                <div className="space-y-4">
                  {results.news.map((item, i) => (
                    <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" className="block group">
                      <p className="text-sm font-medium text-foreground group-hover:text-blue-500 transition-colors line-clamp-2 flex items-start gap-1">
                        {item.title}
                        <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{item.snippet}</p>
                    </a>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground py-4">No news found for this category</p>}
            </div>
          </div>
        </>
      )}

      {!loading && !results && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Megaphone className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">Search for a product or click a category to see market insights</p>
        </div>
      )}
    </div>
  );
}
