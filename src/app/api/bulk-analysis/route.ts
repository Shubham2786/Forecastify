import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";

const GROQ_KEYS = [
  process.env.GROQ_API_KEY!,
  process.env.GROQ_API_KEY_2!,
  process.env.GROQ_API_KEY_3!,
].filter(Boolean);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function getNext7Days() {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const result = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    result.push({ day: days[d.getDay()], date: d.toISOString().split("T")[0] });
  }
  return result;
}

interface ProductInput {
  name: string; brand?: string; category: string;
  quantity?: number; unit?: string; price?: number;
}

export async function POST(request: Request) {
  try {
    const { products, userId, weather, weatherForecast, location } = await request.json();
    if (!products?.length || !userId) {
      return Response.json({ error: "products array and userId required" }, { status: 400 });
    }

    // Store profile
    const { data: store } = await supabase.from("profiles")
      .select("store_name, store_category, store_size, city, state, store_address").eq("id", userId).single();
    const city = store?.city || "Pune";
    const state = store?.state || "Maharashtra";

    // Full inventory
    const { data: inventory } = await supabase.from("inventory")
      .select("product_name, category, quantity, unit, price").eq("store_id", userId);

    // Match each product to inventory (fuzzy)
    const invMatch: Record<string, any> = {};
    for (const p of products as ProductInput[]) {
      const nameLC = p.name.toLowerCase();
      const match = inventory?.find(i =>
        i.product_name.toLowerCase().includes(nameLC) ||
        nameLC.includes(i.product_name.toLowerCase()) ||
        i.product_name.toLowerCase().split(" ").some((w: string) => w.length > 3 && nameLC.includes(w))
      );
      if (match) invMatch[p.name] = match;
    }

    // Historic sales
    const historicStats: Record<string, { avg: number; wkndAvg: number; hotAvg: number }> = {};
    for (const pName of products.slice(0, 15).map((p: ProductInput) => p.name)) {
      const { data: sales } = await supabase.from("historic_sales")
        .select("quantity_sold, is_weekend, temperature")
        .ilike("product_name", `%${pName}%`).eq("city", city)
        .order("date", { ascending: false }).limit(30);

      if (!sales?.length) {
        // Try broader match
        const words = pName.split(" ").filter((w: string) => w.length > 3);
        for (const word of words) {
          const { data: s2 } = await supabase.from("historic_sales")
            .select("quantity_sold, is_weekend, temperature")
            .ilike("product_name", `%${word}%`).ilike("category", `%${(products.find((p: ProductInput) => p.name === pName))?.category || ""}%`)
            .eq("city", city).order("date", { ascending: false }).limit(30);
          if (s2?.length) {
            const avg = s2.reduce((s, r) => s + r.quantity_sold, 0) / s2.length;
            const wknd = s2.filter(r => r.is_weekend);
            const hot = s2.filter(r => r.temperature > 35);
            historicStats[pName] = {
              avg: Math.round(avg * 10) / 10,
              wkndAvg: wknd.length ? Math.round(wknd.reduce((s, r) => s + r.quantity_sold, 0) / wknd.length) : Math.round(avg),
              hotAvg: hot.length ? Math.round(hot.reduce((s, r) => s + r.quantity_sold, 0) / hot.length) : Math.round(avg),
            };
            break;
          }
        }
      } else {
        const avg = sales.reduce((s, r) => s + r.quantity_sold, 0) / sales.length;
        const wknd = sales.filter(r => r.is_weekend);
        const hot = sales.filter(r => r.temperature > 35);
        historicStats[pName] = {
          avg: Math.round(avg * 10) / 10,
          wkndAvg: wknd.length ? Math.round(wknd.reduce((s, r) => s + r.quantity_sold, 0) / wknd.length) : Math.round(avg),
          hotAvg: hot.length ? Math.round(hot.reduce((s, r) => s + r.quantity_sold, 0) / hot.length) : Math.round(avg),
        };
      }
    }

    // Events
    const today = new Date().toISOString().split("T")[0];
    const next14 = new Date(); next14.setDate(next14.getDate() + 14);
    const { data: events } = await supabase.from("regional_events")
      .select("event_name, start_date, demand_impact_percent, affected_categories")
      .gte("start_date", today).lte("start_date", next14.toISOString().split("T")[0]);
    const eventsStr = events?.map(e => `${e.event_name}(+${e.demand_impact_percent}% on ${e.affected_categories?.join(",")})`).join("; ") || "None";

    // Weather forecast per day
    const next7 = getNext7Days();
    const forecastStr = weatherForecast?.slice(0, 7).map((w: any, i: number) =>
      `${next7[i]?.day.slice(0, 3)}: ${w.avgTemp || w.maxTemp || "?"}°C ${w.weather || ""}`
    ).join(", ") || "N/A";

    // Build compact context
    const invContext = Object.entries(invMatch).map(([name, inv]) =>
      `${name}→${inv.product_name}:${inv.quantity}${inv.unit}@₹${inv.price}`
    ).join(", ") || "No matches";

    const histContext = Object.entries(historicStats).map(([name, s]) =>
      `${name}:avg${s.avg}/day,wknd${s.wkndAvg},hot${s.hotAvg}`
    ).join(", ") || "No data";

    const productList = products.map((p: ProductInput, i: number) => {
      const inv = invMatch[p.name];
      return `${i + 1}. ${p.name}|${p.category}|want:${p.quantity || "?"}${p.unit || "pcs"}|₹${p.price || "?"}|inStock:${inv ? inv.quantity + inv.unit : "0"}`;
    }).join("\n");

    const systemMsg = `You are a retail analyst. Return ONLY valid JSON. All quantities must be WHOLE INTEGERS (no decimals). estimatedCost = recommendedQty × price per unit.`;

    const userMsg = `Store: "${store?.store_name}" (${store?.store_category}) at ${location || store?.store_address || city}, ${state}
Weather NOW: ${weather ? `${weather.temp}°C ${weather.description} Humidity:${weather.humidity}%` : "N/A"}
7-Day Forecast: ${forecastStr}
Events: ${eventsStr}
Inventory matches: ${invContext}
Historic sales: ${histContext}

PURCHASE LIST:
${productList}

Return JSON:
{"analysis":[{"name":"Product","category":"Cat","requestedQty":10,"unit":"pcs","price":50,"currentInventory":0,"dailyDemand":5,"weeklyDemand":35,"recommendedQty":40,"adjustmentReason":"why","priority":"High/Medium/Low","priorityReason":"why","estimatedCost":2000,"demandLevel":"High/Medium/Low","dailyBreakdown":[5,5,6,6,7,8,6]}],"buyFirstList":["Product — reason"],"totalEstimatedCost":0,"suggestions":["tip"]}

RULES:
- ALL numbers must be INTEGERS. No 35.75, use 36. No 5.5, use 6. Round UP.
- dailyBreakdown = 7 integers for ${next7.map(d => d.day.slice(0, 3)).join(",")}.
- Use historic data as baseline. Hot weather (${weather?.temp || "?"}°C) boosts beverages/ice cream.
- currentInventory = look up from inventory matches above. If not found, use 0.
- estimatedCost = recommendedQty × price. Must be > 0 if price > 0.
- recommendedQty = weeklyDemand + 20% buffer - currentInventory. Round UP to integer.
- price = use from purchase list. If "?", estimate Indian MRP.
- Priority HIGH: stock < 2 days of demand. MEDIUM: < 5 days. LOW: sufficient.`;

    let completion: any = null;
    for (let i = 0; i < GROQ_KEYS.length; i++) {
      try {
        const groq = new Groq({ apiKey: GROQ_KEYS[i] });
        completion = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemMsg },
            { role: "user", content: userMsg },
          ],
          model: "llama-3.3-70b-versatile",
          temperature: 0.1,
          max_tokens: 3000,
        });
        break;
      } catch (e: any) {
        if (i === GROQ_KEYS.length - 1) throw e;
      }
    }

    let content = completion.choices[0]?.message?.content || "";
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let result;
    try {
      const match = content.match(/\{[\s\S]*\}/);
      result = JSON.parse(match ? match[0] : content);
    } catch {
      try {
        let fixed = content;
        const ob = (fixed.match(/\{/g) || []).length;
        const cb = (fixed.match(/\}/g) || []).length;
        const oq = (fixed.match(/\[/g) || []).length;
        const cq = (fixed.match(/\]/g) || []).length;
        for (let i = 0; i < oq - cq; i++) fixed += "]";
        for (let i = 0; i < ob - cb; i++) fixed += "}";
        const m2 = fixed.match(/\{[\s\S]*\}/);
        result = JSON.parse(m2 ? m2[0] : fixed);
      } catch {
        return Response.json({ error: "Parsing failed. Try fewer products.", raw: content.slice(0, 300) }, { status: 500 });
      }
    }

    // Post-process: force integers, calc costs, build dailyForecast
    if (result.analysis) {
      let totalCost = 0;
      for (const item of result.analysis) {
        // Force integers
        item.requestedQty = Math.round(item.requestedQty || 0);
        item.currentInventory = Math.round(item.currentInventory || 0);
        item.dailyDemand = Math.round(item.dailyDemand || 0);
        item.weeklyDemand = Math.round(item.weeklyDemand || 0);
        item.recommendedQty = Math.round(item.recommendedQty || item.requestedQty || 0);
        item.price = Math.round(item.price || 0);

        // Fix cost
        if (!item.estimatedCost || item.estimatedCost === 0) {
          item.estimatedCost = item.recommendedQty * item.price;
        }
        item.estimatedCost = Math.round(item.estimatedCost);
        totalCost += item.estimatedCost;

        // Convert dailyBreakdown to dailyForecast
        if (item.dailyBreakdown && !item.dailyForecast) {
          item.dailyForecast = next7.map((d, i) => ({
            day: d.day, date: d.date,
            sales: Math.round(item.dailyBreakdown[i] || 0),
          }));
        }
        if (item.dailyForecast) {
          item.dailyForecast = item.dailyForecast.map((f: any) => ({
            ...f, sales: Math.round(f.sales || 0),
          }));
        }

        item.priority = item.priority || "Medium";
        item.demandLevel = item.demandLevel || "Medium";
      }
      result.totalEstimatedCost = Math.round(result.totalEstimatedCost || totalCost);
    }

    return Response.json({
      ...result,
      weather: weather || null,
      location: location || `${city}, ${state}`,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Bulk analysis error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
