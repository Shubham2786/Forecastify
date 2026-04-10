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
    const { userId } = await request.json();
    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    // 1. Store profile
    const { data: store } = await supabase
      .from("profiles")
      .select("store_name, store_category, city, state")
      .eq("id", userId)
      .single();

    const city = store?.city || "Pune";

    // 2. Inventory (current stock from DB)
    const { data: inventory } = await supabase
      .from("inventory")
      .select("product_name, category, current_stock, unit, price, brand")
      .eq("store_id", userId);

    // 3. Demand forecast (next 7 days)
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const next7 = new Date(now);
    next7.setDate(next7.getDate() + 7);

    // Find the matched store_id
    const { data: stores } = await supabase.from("stores").select("store_id, city").ilike("city", city).limit(1);
    const storeId = stores?.[0]?.store_id || 1;

    const { data: forecasts } = await supabase
      .from("demand_forecast")
      .select("date, product_id, predicted_units_sold, recommended_inventory_level")
      .eq("store_id", storeId)
      .gte("date", today)
      .lte("date", next7.toISOString().split("T")[0]);

    // 4. Products mapping
    const { data: products } = await supabase
      .from("products")
      .select("product_id, product_name, category, mrp, shelf_life_days, lead_time_days");
    const prodMap: Record<number, any> = {};
    products?.forEach((p) => { prodMap[p.product_id] = p; });

    // 5. Historic sales (last 14 days)
    const past14 = new Date(now);
    past14.setDate(past14.getDate() - 14);
    const { data: historicSales } = await supabase
      .from("historic_sales")
      .select("product_name, quantity_sold, is_weekend, is_festival")
      .eq("city", city)
      .gte("date", past14.toISOString().split("T")[0])
      .limit(500);

    // 6. Build per-product forecast + historic summary
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Per-product daily forecast
    const perProduct: Record<string, { days: { day: string; date: string; predicted: number; recommended: number }[]; totalPredicted: number; category: string }> = {};
    forecasts?.forEach((f) => {
      const p = prodMap[f.product_id];
      if (!p) return;
      const name = p.product_name;
      if (!perProduct[name]) perProduct[name] = { days: [], totalPredicted: 0, category: p.category || "" };
      const d = new Date(f.date);
      perProduct[name].days.push({
        day: dayNames[d.getDay()],
        date: f.date,
        predicted: Math.round(f.predicted_units_sold),
        recommended: Math.round(f.recommended_inventory_level),
      });
      perProduct[name].totalPredicted += f.predicted_units_sold;
    });

    Object.values(perProduct).forEach((p) => p.days.sort((a, b) => a.date.localeCompare(b.date)));

    // Historic stats per product
    const historicStats: Record<string, { sales: number[]; weekendSales: number[]; festivalSales: number[] }> = {};
    historicSales?.forEach((s) => {
      const key = s.product_name?.toLowerCase() || "";
      if (!historicStats[key]) historicStats[key] = { sales: [], weekendSales: [], festivalSales: [] };
      historicStats[key].sales.push(s.quantity_sold);
      if (s.is_weekend) historicStats[key].weekendSales.push(s.quantity_sold);
      if (s.is_festival) historicStats[key].festivalSales.push(s.quantity_sold);
    });

    // 7. Build Groq prompt for min/max calculation
    const productSummaries = Object.entries(perProduct).map(([name, data]) => {
      const inv = inventory?.find((i) => i.product_name === name);
      const hist = historicStats[name.toLowerCase()];
      const avgDaily = data.totalPredicted / 7;
      const maxDaily = data.days.length ? Math.max(...data.days.map((d) => d.predicted)) : 0;
      const histAvg = hist?.sales.length ? Math.round(hist.sales.reduce((a, b) => a + b, 0) / hist.sales.length) : 0;
      const histMax = hist?.sales.length ? Math.max(...hist.sales) : 0;
      const prod = products?.find((p) => p.product_name === name);

      return `${name}|cat:${data.category}|current:${inv?.current_stock || 0}${inv?.unit || "pcs"}|price:₹${inv?.price || prod?.mrp || 0}|forecast_avg:${Math.round(avgDaily)}/day|forecast_max:${maxDaily}/day|hist_avg:${histAvg}/day|hist_max:${histMax}/day|lead_time:${prod?.lead_time_days || 3}d|shelf_life:${prod?.shelf_life_days || 30}d`;
    }).join("\n");

    const prompt = `You are a retail inventory optimization engine. Based on the REAL data below, calculate the optimal MIN STOCK and MAX STOCK levels for each product for the next 7 days.

STORE: ${store?.store_name} in ${city}, ${store?.state}
Category: ${store?.store_category}

PRODUCT DATA:
${productSummaries}

RULES FOR CALCULATING MIN/MAX:
- min_stock = safety stock to avoid stockout. Formula: (avg_daily_demand × lead_time_days) + buffer. Buffer = 20% extra for high-demand items, 10% for low.
- max_stock = maximum you should hold. Formula: (avg_daily_demand × 14) for perishables (shelf_life < 15), (avg_daily_demand × 21) for non-perishables. Cap based on storage.
- If forecast_avg > hist_avg, demand is rising — increase min by 15%.
- If forecast_avg < hist_avg, demand is dropping — reduce max by 10%.
- ALL values must be WHOLE INTEGERS. No decimals.
- min_stock must always be > 0 and < max_stock.

Return ONLY this JSON:
{
  "products": [
    { "name": "exact product name", "minStock": <integer>, "maxStock": <integer> }
  ]
}`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    let groqResult: { products?: { name: string; minStock: number; maxStock: number }[] } = {};
    try {
      groqResult = JSON.parse(raw);
    } catch {
      groqResult = { products: [] };
    }

    // 8. Build final response — merge Groq min/max with forecast data + DB current stock
    const groqMap: Record<string, { minStock: number; maxStock: number }> = {};
    groqResult.products?.forEach((p) => {
      groqMap[p.name.toLowerCase()] = { minStock: Math.round(p.minStock), maxStock: Math.round(p.maxStock) };
    });

    const result = Object.entries(perProduct).map(([name, data]) => {
      const inv = inventory?.find((i) => i.product_name === name);
      const gData = groqMap[name.toLowerCase()] || { minStock: 5, maxStock: 50 };

      return {
        name,
        category: data.category,
        currentStock: inv?.current_stock || 0,
        unit: inv?.unit || "pcs",
        minStock: gData.minStock,
        maxStock: gData.maxStock,
        days: data.days,
      };
    });

    return Response.json({ products: result });
  } catch (err: any) {
    console.error("Product stock levels error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
