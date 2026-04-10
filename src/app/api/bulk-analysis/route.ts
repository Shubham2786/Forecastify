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

function getNext7Days(): { day: string; date: string }[] {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const result = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    result.push({ day: days[d.getDay()], date: d.toISOString().split("T")[0] });
  }
  return result;
}

interface ProductInput {
  name: string;
  brand?: string;
  category: string;
  quantity?: number;
  unit?: string;
}

export async function POST(request: Request) {
  try {
    const { products, userId, weather } = await request.json();
    if (!products?.length || !userId) {
      return Response.json({ error: "products array and userId required" }, { status: 400 });
    }

    // Store profile
    const { data: store } = await supabase.from("profiles")
      .select("store_name, store_category, store_size, city, state").eq("id", userId).single();
    const city = store?.city || "Pune";

    // My inventory
    const { data: inventory } = await supabase.from("inventory")
      .select("product_name, category, quantity, unit, price").eq("store_id", userId);

    // Historic sales for these products
    const productNames = products.map((p: ProductInput) => p.name);
    const historicStats: Record<string, string> = {};

    for (const pName of productNames.slice(0, 15)) {
      const { data: sales } = await supabase.from("historic_sales")
        .select("quantity_sold, temperature, is_weekend, is_festival")
        .ilike("product_name", `%${pName}%`).eq("city", city)
        .order("date", { ascending: false }).limit(30);

      if (sales?.length) {
        const avg = (sales.reduce((s, r) => s + r.quantity_sold, 0) / sales.length).toFixed(1);
        const wknd = sales.filter(r => r.is_weekend);
        const avgWknd = wknd.length ? (wknd.reduce((s, r) => s + r.quantity_sold, 0) / wknd.length).toFixed(1) : avg;
        historicStats[pName] = `avg:${avg}/day, wknd:${avgWknd}/day`;
      }
    }

    // Events
    const today = new Date().toISOString().split("T")[0];
    const next14 = new Date(); next14.setDate(next14.getDate() + 14);
    const { data: events } = await supabase.from("regional_events")
      .select("event_name, start_date, demand_impact_percent, affected_categories")
      .gte("start_date", today).lte("start_date", next14.toISOString().split("T")[0]);

    const next7 = getNext7Days();
    const invStr = inventory?.map(i => `${i.product_name}|${i.quantity}${i.unit}|₹${i.price}`).join("\n") || "Empty";
    const historicStr = Object.entries(historicStats).map(([k, v]) => `${k}: ${v}`).join("\n") || "No historic data";
    const eventsStr = events?.map(e => `${e.event_name}(${e.start_date}) +${e.demand_impact_percent}%`).join(", ") || "None";

    const prompt = `Analyze this purchase list for a kirana store. For each product, predict 7-day demand, check current inventory, and prioritize what to buy first.

STORE: "${store?.store_name}" (${store?.store_category}) at ${city}, ${store?.state}
${weather ? `WEATHER: ${weather.temp}°C ${weather.description}` : ""}
EVENTS: ${eventsStr}
NEXT 7 DAYS: ${next7.map(d => d.day + " " + d.date).join(", ")}

PURCHASE LIST (what shopkeeper wants to buy):
${products.map((p: ProductInput, i: number) => `${i + 1}. ${p.name} (${p.category}) — wants ${p.quantity || "?"} ${p.unit || "units"}`).join("\n")}

CURRENT INVENTORY:
${invStr}

HISTORIC SALES:
${historicStr}

For EACH product return analysis. JSON ONLY:
{
  "analysis": [
    {
      "name": "Product Name",
      "category": "Category",
      "requestedQty": 10,
      "unit": "pcs",
      "currentInventory": 5,
      "weeklyDemand": 35,
      "dailyDemand": 5,
      "dailyForecast": [
        {"day":"${next7[0].day}","date":"${next7[0].date}","sales":0},
        {"day":"${next7[1].day}","date":"${next7[1].date}","sales":0},
        {"day":"${next7[2].day}","date":"${next7[2].date}","sales":0},
        {"day":"${next7[3].day}","date":"${next7[3].date}","sales":0},
        {"day":"${next7[4].day}","date":"${next7[4].date}","sales":0},
        {"day":"${next7[5].day}","date":"${next7[5].date}","sales":0},
        {"day":"${next7[6].day}","date":"${next7[6].date}","sales":0}
      ],
      "recommendedQty": 40,
      "adjustmentReason": "Why adjust from requested qty",
      "priority": "High/Medium/Low",
      "priorityReason": "Why this priority",
      "estimatedCost": 500,
      "demandLevel": "High/Medium/Low"
    }
  ],
  "buyFirstList": ["Product 1 — reason", "Product 2 — reason"],
  "totalEstimatedCost": 0,
  "suggestions": ["suggestion1", "suggestion2"]
}

RULES:
- Use historic data for daily demand. If no data, estimate based on product type.
- recommendedQty = weeklyDemand + 15% buffer - currentInventory. If > requestedQty, suggest increase.
- Priority HIGH: currentInventory < 2 days demand. MEDIUM: < 5 days. LOW: > 5 days.
- buyFirstList: sorted by urgency, most critical first.
- Be realistic with ${city} market data.`;

    let completion: any = null;
    for (let i = 0; i < GROQ_KEYS.length; i++) {
      try {
        const groq = new Groq({ apiKey: GROQ_KEYS[i] });
        completion = await groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "llama-3.3-70b-versatile",
          temperature: 0.2,
          max_tokens: 4000,
        });
        break;
      } catch (e: any) {
        if (i === GROQ_KEYS.length - 1) throw e;
      }
    }

    const content = completion.choices[0]?.message?.content || "";
    let result;
    try {
      const match = content.match(/\{[\s\S]*\}/);
      result = JSON.parse(match ? match[0] : content);
    } catch {
      return Response.json({ error: "Failed to parse analysis", raw: content }, { status: 500 });
    }

    return Response.json({ ...result, generatedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error("Bulk analysis error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
