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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productName, userId, weather, weatherForecast, location, storeCategory } = body;

    if (!productName || !userId) {
      return Response.json({ error: "productName and userId required" }, { status: 400 });
    }

    // 1. Product from inventory
    const { data: products } = await supabase
      .from("inventory").select("*").eq("store_id", userId).ilike("product_name", `%${productName}%`);
    const product = products?.[0] || null;

    // 2. Store profile
    const { data: store } = await supabase
      .from("profiles").select("store_name, store_category, store_size, city, state, store_address")
      .eq("id", userId).single();

    const city = store?.city || "Pune";

    // 3. HISTORIC SALES — query by product + city
    const { data: historicSales } = await supabase
      .from("historic_sales")
      .select("date, day_of_week, quantity_sold, temperature, weather_condition, humidity, is_weekend, is_festival, festival_name")
      .ilike("product_name", `%${productName}%`).eq("city", city)
      .order("date", { ascending: false }).limit(90);

    let salesData = historicSales;
    if (!salesData?.length) {
      // Fallback: any city
      const { data: fb } = await supabase.from("historic_sales")
        .select("date, day_of_week, quantity_sold, temperature, weather_condition, humidity, is_weekend, is_festival, festival_name")
        .ilike("product_name", `%${productName}%`).order("date", { ascending: false }).limit(90);
      salesData = fb;
    }

    // Compute stats from historic data
    let historicContext = "No historic sales data available for this product.";
    if (salesData?.length) {
      const total = salesData.reduce((s, r) => s + r.quantity_sold, 0);
      const avg = (total / salesData.length).toFixed(1);
      const wkday = salesData.filter(r => !r.is_weekend);
      const wkend = salesData.filter(r => r.is_weekend);
      const avgWD = wkday.length ? (wkday.reduce((s, r) => s + r.quantity_sold, 0) / wkday.length).toFixed(1) : "0";
      const avgWE = wkend.length ? (wkend.reduce((s, r) => s + r.quantity_sold, 0) / wkend.length).toFixed(1) : "0";
      const hot = salesData.filter(r => r.temperature && r.temperature > 35);
      const cold = salesData.filter(r => r.temperature && r.temperature < 20);
      const rainy = salesData.filter(r => r.weather_condition?.includes("Rain"));
      const fest = salesData.filter(r => r.is_festival);
      const avgHot = hot.length ? (hot.reduce((s, r) => s + r.quantity_sold, 0) / hot.length).toFixed(1) : "N/A";
      const avgCold = cold.length ? (cold.reduce((s, r) => s + r.quantity_sold, 0) / cold.length).toFixed(1) : "N/A";
      const avgRainy = rainy.length ? (rainy.reduce((s, r) => s + r.quantity_sold, 0) / rainy.length).toFixed(1) : "N/A";
      const avgFest = fest.length ? (fest.reduce((s, r) => s + r.quantity_sold, 0) / fest.length).toFixed(1) : "N/A";
      const last7 = salesData.slice(0, 7).map(r =>
        `${r.day_of_week}: ${r.quantity_sold} units (${r.temperature}°C ${r.weather_condition}${r.is_festival ? " FEST:" + r.festival_name : ""})`
      ).join("\n");

      historicContext = `HISTORIC SALES (${salesData.length} days, ${city}):
Avg daily: ${avg} | Weekday avg: ${avgWD} | Weekend avg: ${avgWE}
Hot(>35°C): ${avgHot}/day | Cold(<20°C): ${avgCold}/day | Rainy: ${avgRainy}/day | Festival: ${avgFest}/day
Max: ${Math.max(...salesData.map(r => r.quantity_sold))} | Min: ${Math.min(...salesData.map(r => r.quantity_sold))}
Last 7 days:\n${last7}`;
    }

    // 4. Upcoming events
    const today = new Date().toISOString().split("T")[0];
    const next10 = new Date(); next10.setDate(next10.getDate() + 10);
    const { data: events } = await supabase.from("regional_events")
      .select("event_name, start_date, end_date, demand_impact_percent, affected_categories")
      .gte("start_date", today).lte("start_date", next10.toISOString().split("T")[0]);
    const { data: ongoing } = await supabase.from("regional_events")
      .select("event_name, start_date, end_date, demand_impact_percent, affected_categories")
      .lte("start_date", today).gte("end_date", today);
    const allEvents = [...(events || []), ...(ongoing || [])];
    const eventsStr = allEvents.length
      ? allEvents.map(e => `${e.event_name} (${e.start_date}→${e.end_date}) ${e.demand_impact_percent}% on ${e.affected_categories?.join(",")}`).join("\n")
      : "No events next 10 days.";

    // 5. Weather history same week last year
    const lastYr = new Date(); lastYr.setFullYear(lastYr.getFullYear() - 1);
    const { data: lastYrW } = await supabase.from("weather_history")
      .select("date, avg_temp, weather_condition").eq("city", city)
      .gte("date", lastYr.toISOString().split("T")[0]).order("date", { ascending: false }).limit(7);

    const next7 = getNext7Days();

    const weatherPerDay = weatherForecast?.length
      ? weatherForecast.slice(0, 7).map((w: any, i: number) =>
          `${next7[i]?.day} ${next7[i]?.date}: ${w.avgTemp || w.maxTemp || "?"}°C ${w.weather || "?"} Hum:${w.avgHumidity || "?"}%`
        ).join("\n") : "No forecast.";

    const prompt = `Predict demand for "${productName}" for next 7 days. USE THE HISTORIC DATA — it is REAL past sales.

DATE: ${today}
PRODUCT: "${productName}"
${product ? `STOCK: ${product.quantity} ${product.unit} at ₹${product.price} | ${product.category}` : "NOT in inventory."}
STORE: "${store?.store_name || "Store"}" (${store?.store_category || storeCategory || "General"}) ${city}, ${store?.state || ""}
Size: ${store?.store_size || "Small"}

WEATHER NOW: ${weather ? `${weather.temp}°C ${weather.description} Humidity:${weather.humidity}%` : "N/A"}
7-DAY FORECAST:\n${weatherPerDay}

${historicContext}

EVENTS:\n${eventsStr}

${lastYrW?.length ? `LAST YEAR SAME WEEK: ${lastYrW.map(w => `${w.date}:${w.avg_temp}°C ${w.weather_condition}`).join(", ")}` : ""}

RULES:
- USE historic averages as baseline. Weekday→use weekday avg, weekend→weekend avg
- Adjust for weather: if forecast >35°C and historic hot-day avg is X, use X (not weekday avg)
- If festival upcoming and category matches, apply the impact %
- Confidence: 70-90 INTEGER (not decimal)
- stockRequired = totalSales + 15% buffer
- additionalNeeded = max(0, stockRequired - currentStock)
- Margins: FMCG 8-15%, beverages 15-25%, snacks 20-30%, ice cream 30-50%

JSON ONLY:
{"productName":"${productName}","currentStock":${product?.quantity || 0},"unit":"${product?.unit || "pcs"}","currentPrice":${product?.price || 0},"inInventory":${!!product},"weatherSummary":"1-line","locationContext":"1-line","summary":"2 sentences based on historic data","dailyForecast":[{"day":"${next7[0].day}","date":"${next7[0].date}","predictedSales":0,"confidence":75,"reason":"why"},{"day":"${next7[1].day}","date":"${next7[1].date}","predictedSales":0,"confidence":75,"reason":"why"},{"day":"${next7[2].day}","date":"${next7[2].date}","predictedSales":0,"confidence":75,"reason":"why"},{"day":"${next7[3].day}","date":"${next7[3].date}","predictedSales":0,"confidence":75,"reason":"why"},{"day":"${next7[4].day}","date":"${next7[4].date}","predictedSales":0,"confidence":75,"reason":"why"},{"day":"${next7[5].day}","date":"${next7[5].date}","predictedSales":0,"confidence":75,"reason":"why"},{"day":"${next7[6].day}","date":"${next7[6].date}","predictedSales":0,"confidence":75,"reason":"why"}],"totalPredictedSales":0,"stockRequired":0,"currentStockStatus":"Sufficient/Insufficient/Critical/Overstocked","additionalStockNeeded":0,"restockUrgency":"High/Medium/Low/None","recommendations":["r1","r2","r3"],"pricingAdvice":{"currentPrice":${product?.price || 0},"suggestedPrice":0,"reason":"why"},"seasonalFactors":["f1"],"competitorInsight":"insight","riskFactors":[{"risk":"what","severity":"level","mitigation":"how"}],"demandDrivers":["d1","d2"],"profitAnalysis":{"estimatedRevenue":0,"estimatedProfit":0,"margin":"X%"}}`;

    let completion: any = null;
    for (let i = 0; i < GROQ_KEYS.length; i++) {
      try {
        const groq = new Groq({ apiKey: GROQ_KEYS[i] });
        completion = await groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "llama-3.3-70b-versatile",
          temperature: 0.2,
          max_tokens: 2000,
        });
        break;
      } catch (e: any) {
        console.log(`Groq key ${i + 1} failed:`, e.message);
        if (i === GROQ_KEYS.length - 1) throw e;
      }
    }

    const content = completion.choices[0]?.message?.content || "";
    let analysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      return Response.json({ error: "Failed to parse analysis", raw: content }, { status: 500 });
    }

    // Fix confidence decimals
    if (analysis.dailyForecast) {
      for (const day of analysis.dailyForecast) {
        if (day.confidence < 1) day.confidence = Math.round(day.confidence * 100);
        if (day.confidence < 10) day.confidence = day.confidence * 10;
        day.predictedSales = Math.max(0, Math.round(day.predictedSales));
      }
    }

    return Response.json({
      analysis, product,
      weather: weather || null,
      location: location || city,
      historicDataPoints: salesData?.length || 0,
      eventsCount: allEvents.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Product analysis error:", err.message);
    return Response.json({ error: err.message || "Analysis failed" }, { status: 500 });
  }
}
