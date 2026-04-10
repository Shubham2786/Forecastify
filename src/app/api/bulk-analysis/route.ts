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
  name: string;
  brand?: string;
  category: string;
  quantity?: number;
  unit?: string;
  price?: number;
}

export async function POST(request: Request) {
  try {
    const { products, userId, weather } = await request.json();
    if (!products?.length || !userId) {
      return Response.json({ error: "products array and userId required" }, { status: 400 });
    }

    const { data: store } = await supabase.from("profiles")
      .select("store_name, store_category, store_size, city, state").eq("id", userId).single();
    const city = store?.city || "Pune";

    const { data: inventory } = await supabase.from("inventory")
      .select("product_name, category, quantity, unit, price").eq("store_id", userId);

    // Historic sales averages
    const historicStats: Record<string, string> = {};
    for (const pName of products.slice(0, 15).map((p: ProductInput) => p.name)) {
      const { data: sales } = await supabase.from("historic_sales")
        .select("quantity_sold, is_weekend")
        .ilike("product_name", `%${pName}%`).eq("city", city)
        .order("date", { ascending: false }).limit(30);
      if (sales?.length) {
        const avg = (sales.reduce((s, r) => s + r.quantity_sold, 0) / sales.length).toFixed(1);
        historicStats[pName] = `${avg}/day`;
      }
    }

    const next7 = getNext7Days();
    const invStr = inventory?.map(i => `${i.product_name}:${i.quantity}${i.unit}`).join(", ") || "Empty";
    const histStr = Object.entries(historicStats).map(([k, v]) => `${k}:${v}`).join(", ") || "None";

    const productList = products.map((p: ProductInput, i: number) =>
      `${i + 1}. ${p.name}|${p.category}|qty:${p.quantity || "?"}${p.unit || "pcs"}|₹${p.price || "?"}`
    ).join("\n");

    const systemMsg = `You analyze purchase lists for kirana stores. Return ONLY valid JSON. No markdown. No explanation.`;

    const userMsg = `Store: "${store?.store_name}" (${store?.store_category}) ${city}
${weather ? `Weather: ${weather.temp}°C ${weather.description}` : ""}
Inventory: ${invStr}
Historic: ${histStr}

Products to analyze:
${productList}

Return this exact JSON structure:
{"analysis":[{"name":"Product","category":"Cat","requestedQty":10,"unit":"pcs","price":50,"currentInventory":0,"dailyDemand":5,"weeklyDemand":35,"recommendedQty":40,"adjustmentReason":"why","priority":"High/Medium/Low","priorityReason":"why","estimatedCost":500,"demandLevel":"High/Medium/Low","dailyBreakdown":[0,0,0,0,0,0,0]}],"buyFirstList":["Product — reason"],"totalEstimatedCost":0,"suggestions":["tip1"]}

Rules: dailyBreakdown = 7 numbers (${next7.map(d => d.day.slice(0, 3)).join(",")}). recommendedQty = weeklyDemand + 15% - currentInventory. Priority HIGH if stock < 2 days demand.`;

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

    // Clean up common Groq output issues
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let result;
    try {
      const match = content.match(/\{[\s\S]*\}/);
      result = JSON.parse(match ? match[0] : content);
    } catch {
      // Try fixing truncated JSON
      try {
        let fixed = content;
        // Count braces and add missing ones
        const openBraces = (fixed.match(/\{/g) || []).length;
        const closeBraces = (fixed.match(/\}/g) || []).length;
        const openBrackets = (fixed.match(/\[/g) || []).length;
        const closeBrackets = (fixed.match(/\]/g) || []).length;
        for (let i = 0; i < openBrackets - closeBrackets; i++) fixed += "]";
        for (let i = 0; i < openBraces - closeBraces; i++) fixed += "}";
        const match2 = fixed.match(/\{[\s\S]*\}/);
        result = JSON.parse(match2 ? match2[0] : fixed);
      } catch {
        return Response.json({ error: "Analysis parsing failed. Please try with fewer products.", raw: content.slice(0, 300) }, { status: 500 });
      }
    }

    // Post-process: convert dailyBreakdown array to dailyForecast objects
    if (result.analysis) {
      for (const item of result.analysis) {
        if (item.dailyBreakdown && !item.dailyForecast) {
          item.dailyForecast = next7.map((d, i) => ({
            day: d.day,
            date: d.date,
            sales: item.dailyBreakdown[i] || 0,
          }));
        }
        // Ensure all fields exist
        item.currentInventory = item.currentInventory || 0;
        item.weeklyDemand = item.weeklyDemand || 0;
        item.recommendedQty = item.recommendedQty || item.requestedQty || 0;
        item.estimatedCost = item.estimatedCost || 0;
        item.priority = item.priority || "Medium";
        item.demandLevel = item.demandLevel || "Medium";
      }
    }

    return Response.json({ ...result, generatedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error("Bulk analysis error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
