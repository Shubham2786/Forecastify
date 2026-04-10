import { createClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";

/* eslint-disable @typescript-eslint/no-explicit-any */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

export async function POST(request: Request) {
  try {
    const { userId, scenario } = await request.json();
    if (!userId || !scenario) return Response.json({ error: "userId and scenario required" }, { status: 400 });

    // 1. Fetch store profile
    const { data: store } = await supabase
      .from("profiles")
      .select("store_name, store_category, city, state")
      .eq("id", userId)
      .single();

    const city = store?.city || "Pune";

    // 2. Fetch inventory
    const { data: inventory } = await supabase
      .from("inventory")
      .select("product_name, category, quantity, unit, price, min_stock, max_stock, brand")
      .eq("store_id", userId);

    // 3. Fetch historic sales (last 30 days for richer context)
    const now = new Date();
    const past30 = new Date(now);
    past30.setDate(past30.getDate() - 30);
    const { data: historicSales } = await supabase
      .from("historic_sales")
      .select("date, product_name, quantity_sold, temperature, weather_condition, is_weekend, is_festival, festival_name, category")
      .eq("city", city)
      .gte("date", past30.toISOString().split("T")[0])
      .order("date", { ascending: true })
      .limit(800);

    // 4. Fetch demand forecast
    const today = now.toISOString().split("T")[0];
    const next7 = new Date(now);
    next7.setDate(next7.getDate() + 7);
    const { data: forecasts } = await supabase
      .from("demand_forecast")
      .select("date, product_id, predicted_units_sold, recommended_inventory_level")
      .eq("store_id", 1)
      .gte("date", today)
      .lte("date", next7.toISOString().split("T")[0]);

    // 5. Fetch products for mapping
    const { data: products } = await supabase.from("products").select("product_id, product_name, category, mrp");
    const prodMap: Record<number, any> = {};
    products?.forEach((p) => { prodMap[p.product_id] = p; });

    // 6. Build historic summary stats
    const productStats: Record<string, { totalSold: number; days: number; avgPrice: number; maxSold: number; minSold: number; weekendAvg: number; weekdayAvg: number; festivalAvg: number; normalAvg: number }> = {};
    historicSales?.forEach((s) => {
      const key = s.product_name?.toLowerCase() || "";
      if (!productStats[key]) productStats[key] = { totalSold: 0, days: 0, avgPrice: 0, maxSold: 0, minSold: Infinity, weekendAvg: 0, weekdayAvg: 0, festivalAvg: 0, normalAvg: 0 };
      const ps = productStats[key];
      ps.totalSold += s.quantity_sold;
      ps.days++;
      ps.maxSold = Math.max(ps.maxSold, s.quantity_sold);
      ps.minSold = Math.min(ps.minSold, s.quantity_sold);
    });

    // Weekend/weekday/festival breakdowns
    const weekendSales: Record<string, number[]> = {};
    const weekdaySales: Record<string, number[]> = {};
    const festivalSales: Record<string, number[]> = {};
    const normalSales: Record<string, number[]> = {};
    historicSales?.forEach((s) => {
      const key = s.product_name?.toLowerCase() || "";
      if (s.is_weekend) { (weekendSales[key] ||= []).push(s.quantity_sold); }
      else { (weekdaySales[key] ||= []).push(s.quantity_sold); }
      if (s.is_festival) { (festivalSales[key] ||= []).push(s.quantity_sold); }
      else { (normalSales[key] ||= []).push(s.quantity_sold); }
    });

    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : 0;
    Object.keys(productStats).forEach((key) => {
      const ps = productStats[key];
      ps.weekendAvg = avg(weekendSales[key] || []);
      ps.weekdayAvg = avg(weekdaySales[key] || []);
      ps.festivalAvg = avg(festivalSales[key] || []);
      ps.normalAvg = avg(normalSales[key] || []);
      if (ps.minSold === Infinity) ps.minSold = 0;
    });

    // Build top products summary
    const topProducts = Object.entries(productStats)
      .sort((a, b) => b[1].totalSold - a[1].totalSold)
      .slice(0, 20)
      .map(([name, s]) => `${name}: avg ${Math.round(s.totalSold / s.days)}/day, range ${s.minSold}-${s.maxSold}, weekend avg ${s.weekendAvg}, weekday avg ${s.weekdayAvg}, festival avg ${s.festivalAvg}, normal avg ${s.normalAvg}`)
      .join("\n");

    // Forecast summary
    const forecastSummary = forecasts?.slice(0, 30).map((f) => {
      const p = prodMap[f.product_id];
      return `${p?.product_name || `#${f.product_id}`}: ${f.predicted_units_sold} units on ${f.date}`;
    }).join("\n") || "No forecast data";

    // Inventory summary
    const invSummary = inventory?.map((i) =>
      `${i.product_name} (${i.category}): ${i.quantity} ${i.unit} @ ₹${i.price}, min=${i.min_stock || "?"}, max=${i.max_stock || "?"}`
    ).join("\n") || "No inventory";

    const prompt = `You are a retail demand simulation engine for an Indian retail store. You have REAL historic sales data below. Use it to provide REALISTIC, DATA-BACKED predictions. Do NOT guess — base every number on the patterns in the data.

STORE: ${store?.store_name || "Store"} in ${city}, ${store?.state || ""}
Category: ${store?.store_category || "Retail"}

SCENARIO TO SIMULATE:
"${scenario}"

=== REAL HISTORIC SALES DATA (last 30 days, top 20 products) ===
${topProducts}

=== CURRENT INVENTORY ===
${invSummary}

=== CURRENT 7-DAY FORECAST ===
${forecastSummary}

=== STRICT RULES ===
1. ALL numeric values for units, demand, stock, daysOfStock MUST be WHOLE INTEGERS — never decimals. You cannot sell 7.16 units of milk, it is 7 or 8.
2. Revenue values should be rounded to nearest whole rupee.
3. changePercent should be a whole integer (e.g., -11 not -10.5).
4. baselineDemand and projectedDemand are units per day — ALWAYS whole numbers.
5. Calculate baseline from historic averages in the data. Apply the scenario multiplier from real patterns (e.g., festival avg vs normal avg = festival multiplier). Round the result.
6. daysOfStock = floor(currentStock / projectedDemand). Must be integer.
7. demandMultiplier in timeline should have max 1 decimal (e.g., 1.3, 0.8).
8. Only include products that are ACTUALLY in the inventory or historic data above. Do not invent products.

Respond ONLY in this JSON format:
{
  "scenarioTitle": "Short title of what was simulated",
  "summary": "2-3 line plain English summary. Use real numbers. Be specific about which products and how much.",
  "overallImpact": "positive" | "negative" | "mixed",
  "revenueChange": { "before": <integer ₹/day>, "after": <integer ₹/day>, "changePercent": <integer> },
  "demandChange": { "before": <integer units/day>, "after": <integer units/day>, "changePercent": <integer> },
  "riskLevel": "low" | "medium" | "high" | "critical",
  "confidence": <integer 0-100>,
  "affectedProducts": [
    {
      "name": "exact product name from data",
      "category": "category",
      "currentStock": <integer>,
      "baselineDemand": <integer per day>,
      "projectedDemand": <integer per day>,
      "changePercent": <integer>,
      "daysOfStock": <integer>,
      "stockoutRisk": "none" | "low" | "medium" | "high",
      "action": "specific recommendation with numbers",
      "reasoning": "cite the actual historic data pattern"
    }
  ],
  "timeline": [
    { "day": "Day 1", "event": "what happens", "demandMultiplier": <number max 1 decimal>, "keyProducts": ["product1"] }
  ],
  "recommendations": ["action with specific numbers", "action 2", "action 3"],
  "risks": ["risk 1", "risk 2"],
  "opportunities": ["opportunity 1", "opportunity 2"]
}`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      result = { error: "Failed to parse simulation", raw };
    }

    // Post-process: force all numeric fields to integers (Groq sometimes ignores instructions)
    if (result && !result.error) {
      if (result.revenueChange) {
        result.revenueChange.before = Math.round(result.revenueChange.before || 0);
        result.revenueChange.after = Math.round(result.revenueChange.after || 0);
        result.revenueChange.changePercent = Math.round(result.revenueChange.changePercent || 0);
      }
      if (result.demandChange) {
        result.demandChange.before = Math.round(result.demandChange.before || 0);
        result.demandChange.after = Math.round(result.demandChange.after || 0);
        result.demandChange.changePercent = Math.round(result.demandChange.changePercent || 0);
      }
      result.confidence = Math.round(result.confidence || 0);
      if (result.affectedProducts) {
        result.affectedProducts = result.affectedProducts.map((p: any) => ({
          ...p,
          currentStock: Math.round(p.currentStock || 0),
          baselineDemand: Math.round(p.baselineDemand || 0),
          projectedDemand: Math.round(p.projectedDemand || 0),
          changePercent: Math.round(p.changePercent || 0),
          daysOfStock: Math.floor(p.daysOfStock || 0),
        }));
      }
      if (result.timeline) {
        result.timeline = result.timeline.map((t: any) => ({
          ...t,
          demandMultiplier: Math.round((t.demandMultiplier || 1) * 10) / 10,
        }));
      }
    }

    return Response.json({ simulation: result, dataPoints: historicSales?.length || 0 });
  } catch (err: any) {
    console.error("What-If API error:", err.message);
    return Response.json({ error: err.message || "Simulation failed" }, { status: 500 });
  }
}
