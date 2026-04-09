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

export async function POST(request: Request) {
  try {
    const { userId, weather, location } = await request.json();
    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    // Fetch inventory
    const { data: inventory } = await supabase
      .from("inventory").select("*").eq("store_id", userId).order("quantity", { ascending: true });

    if (!inventory?.length) {
      return Response.json({ alerts: [], summary: { critical: 0, warning: 0, info: 0 } });
    }

    // Fetch store
    const { data: store } = await supabase
      .from("profiles").select("store_name, store_category, city, state")
      .eq("id", userId).single();

    // Fetch upcoming events
    const today = new Date().toISOString().split("T")[0];
    const next14 = new Date(); next14.setDate(next14.getDate() + 14);
    const { data: events } = await supabase.from("regional_events")
      .select("event_name, start_date, demand_impact_percent, affected_categories")
      .gte("start_date", today).lte("start_date", next14.toISOString().split("T")[0]);

    // Build product list for Groq
    const productList = inventory.map(p =>
      `${p.product_name}|${p.category}|qty:${p.quantity}${p.unit}|min:${p.min_stock}|max:${p.max_stock}|₹${p.price}`
    ).join("\n");

    const eventsStr = events?.length
      ? events.map(e => `${e.event_name}(${e.start_date}) +${e.demand_impact_percent}% on ${e.affected_categories?.join(",")}`).join("; ")
      : "None";

    const prompt = `Analyze this store's inventory and generate stockout/overstock alerts.

STORE: "${store?.store_name || "Store"}" (${store?.store_category || "General"}) at ${store?.city || ""}, ${store?.state || ""}
${weather ? `WEATHER: ${weather.temp}°C ${weather.description}` : ""}
EVENTS NEXT 14 DAYS: ${eventsStr}

INVENTORY:
${productList}

RULES:
- If quantity <= min_stock × 0.5 → CRITICAL stockout risk
- If quantity <= min_stock → WARNING low stock
- If quantity >= max_stock × 0.9 → INFO overstock
- Also flag products where upcoming events will spike demand beyond current stock
- For each alert estimate: days until stockout = quantity / estimated daily demand
- Demand categories: HIGH (>10/day), MEDIUM (3-10/day), LOW (<3/day) — based on product type
- suggestedRestock = (7 × dailyDemand) - currentQuantity + 20% buffer

Return JSON array ONLY:
[
  {
    "productName": "Name",
    "category": "Category",
    "currentStock": 10,
    "unit": "pcs",
    "minStock": 20,
    "maxStock": 100,
    "severity": "critical/warning/info",
    "alertType": "stockout/low_stock/overstock/demand_spike",
    "title": "Short alert title",
    "message": "1-2 sentence description of the issue",
    "daysUntilStockout": 2,
    "demandLevel": "High/Medium/Low",
    "estimatedDailyDemand": 5,
    "suggestedRestock": 30,
    "recommendation": "Specific action to take",
    "factors": ["factor1", "factor2"]
  }
]

Only include products that actually need alerts. Be realistic. Max 15 alerts.`;

    let completion: any = null;
    for (let i = 0; i < GROQ_KEYS.length; i++) {
      try {
        const groq = new Groq({ apiKey: GROQ_KEYS[i] });
        completion = await groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "llama-3.3-70b-versatile",
          temperature: 0.2,
          max_tokens: 3000,
        });
        break;
      } catch (e: any) {
        if (i === GROQ_KEYS.length - 1) throw e;
      }
    }

    const content = completion.choices[0]?.message?.content || "[]";
    let alerts;
    try {
      const match = content.match(/\[[\s\S]*\]/);
      alerts = JSON.parse(match ? match[0] : content);
    } catch {
      return Response.json({ error: "Failed to parse alerts", raw: content }, { status: 500 });
    }

    // Sort: critical first, then warning, then info
    const order = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a: any, b: any) => (order[a.severity as keyof typeof order] ?? 3) - (order[b.severity as keyof typeof order] ?? 3));

    const summary = {
      critical: alerts.filter((a: any) => a.severity === "critical").length,
      warning: alerts.filter((a: any) => a.severity === "warning").length,
      info: alerts.filter((a: any) => a.severity === "info").length,
    };

    return Response.json({ alerts, summary, generatedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error("Alerts error:", err.message);
    return Response.json({ error: err.message || "Failed to generate alerts" }, { status: 500 });
  }
}
