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
    const { category: rawCategory, userId, weather, location, lang } = await request.json();
    const langMap: Record<string, string> = { hi: "Hindi", mr: "Marathi", ta: "Tamil", te: "Telugu", kn: "Kannada", bn: "Bengali", gu: "Gujarati" };
    const langInstruction = lang && langMap[lang] ? `\nIMPORTANT: Write summary, reason, recommendations, competitorInsight, seasonalTrend in ${langMap[lang]}. Keep product/brand names, numbers, JSON keys in English.` : "";
    if (!userId) {
      return Response.json({ error: "userId required" }, { status: 400 });
    }

    // If no category given, pick the top category from inventory
    let category = rawCategory;
    if (!category) {
      const { data: inv } = await supabase.from("inventory").select("category").eq("store_id", userId);
      if (inv?.length) {
        const catCount: Record<string, number> = {};
        inv.forEach(i => { catCount[i.category] = (catCount[i.category] || 0) + 1; });
        category = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0][0];
      } else {
        category = "Beverages";
      }
    }

    // Validate category exists in inventory, products, or historic_sales
    if (category) {
      const { data: invCat } = await supabase.from("inventory").select("id").eq("store_id", userId).ilike("category", `%${category}%`).limit(1);
      const { data: prodCat } = await supabase.from("products").select("product_id").ilike("category", `%${category}%`).limit(1);
      const { data: salesCat } = await supabase.from("historic_sales").select("product_name").ilike("category", `%${category}%`).limit(1);

      if (!invCat?.length && !prodCat?.length && !salesCat?.length) {
        return Response.json({ error: `"${category}" is not a valid category. Please search for a category that exists in your inventory.` }, { status: 400 });
      }
    }

    // Store profile
    const { data: store } = await supabase
      .from("profiles").select("store_name, store_category, store_size, city, state, store_address")
      .eq("id", userId).single();

    const city = store?.city || "Pune";
    const state = store?.state || "Maharashtra";

    // Products in this category from inventory
    const { data: myProducts } = await supabase
      .from("inventory").select("*").eq("store_id", userId)
      .ilike("category", `%${category}%`);

    // Historic sales for this category
    const { data: historicSales } = await supabase
      .from("historic_sales")
      .select("product_name, quantity_sold, temperature, weather_condition, is_weekend, is_festival, festival_name, day_of_week")
      .ilike("category", `%${category}%`).eq("city", city)
      .order("date", { ascending: false }).limit(200);

    // Aggregate historic by product
    const productMap: Record<string, { total: number; count: number; weekend: number; wkndCount: number; hot: number; hotCount: number }> = {};
    if (historicSales?.length) {
      for (const row of historicSales) {
        if (!productMap[row.product_name]) {
          productMap[row.product_name] = { total: 0, count: 0, weekend: 0, wkndCount: 0, hot: 0, hotCount: 0 };
        }
        const p = productMap[row.product_name];
        p.total += row.quantity_sold;
        p.count++;
        if (row.is_weekend) { p.weekend += row.quantity_sold; p.wkndCount++; }
        if (row.temperature && row.temperature > 35) { p.hot += row.quantity_sold; p.hotCount++; }
      }
    }

    const historicContext = Object.entries(productMap).map(([name, d]) =>
      `${name}: avg ${(d.total / d.count).toFixed(1)}/day, wknd avg ${d.wkndCount ? (d.weekend / d.wkndCount).toFixed(1) : "N/A"}, hot-day avg ${d.hotCount ? (d.hot / d.hotCount).toFixed(1) : "N/A"}`
    ).join("\n") || "No historic data.";

    // My inventory summary
    const myInvStr = myProducts?.length
      ? myProducts.map(p => `${p.product_name}|stock:${p.current_stock}${p.unit}|₹${p.price}|brand:${p.brand || "?"}`).join("\n")
      : "No products in this category yet.";

    // Upcoming events
    const today = new Date().toISOString().split("T")[0];
    const next14 = new Date(); next14.setDate(next14.getDate() + 14);
    const { data: events } = await supabase.from("regional_events")
      .select("event_name, start_date, demand_impact_percent, affected_categories")
      .gte("start_date", today).lte("start_date", next14.toISOString().split("T")[0]);

    const eventsStr = events?.filter(e => e.affected_categories?.some((c: string) => c.toLowerCase().includes(category.toLowerCase())))
      .map(e => `${e.event_name}(${e.start_date}) +${e.demand_impact_percent}%`).join(", ") || "None";

    const prompt = `Analyze the "${category}" category for a kirana store in ${city}, ${state}.

STORE: "${store?.store_name || "Store"}" (${store?.store_category || "General"}) at ${location || store?.store_address || city}
${weather ? `WEATHER: ${weather.temp}°C ${weather.description} Humidity:${weather.humidity}%` : ""}
EVENTS: ${eventsStr}

MY INVENTORY IN THIS CATEGORY:
${myInvStr}

HISTORIC SALES DATA:
${historicContext}

Give me the top brands and products that sell well in "${category}" category in ${city}, ${state} region. Include both what I already stock AND popular products I should consider adding.

JSON ONLY:
{
  "category": "${category}",
  "location": "${city}, ${state}",
  "summary": "2-3 sentences about this category's performance and trends in this region",
  "totalCategoryDemand": "High/Medium/Low",
  "weeklyEstimate": 0,
  "topBrands": [
    {
      "brand": "Brand Name",
      "popularity": 90,
      "marketShare": "XX%",
      "priceRange": "₹XX - ₹XX",
      "reason": "Why popular in this region"
    }
  ],
  "products": [
    {
      "name": "Product Name",
      "brand": "Brand",
      "category": "${category}",
      "demandLevel": "High/Medium/Low",
      "dailyDemand": 0,
      "weeklyDemand": 0,
      "suggestedPrice": 0,
      "inMyInventory": true,
      "myStock": 0,
      "myUnit": "pcs",
      "stockStatus": "Sufficient/Low/Out of Stock/Not Stocked",
      "restockNeeded": 0,
      "reason": "Why this product is important",
      "margin": "X%"
    }
  ],
  "missingProducts": ["Product I should add but don't stock yet"],
  "seasonalTrend": "How season affects this category right now",
  "recommendations": ["actionable rec 1", "rec 2", "rec 3"],
  "competitorInsight": "What competitors stock in this category"
}

Include 6-8 top brands and 10-15 products. Mark which ones are in my inventory. Be realistic with ${city} market data. Use historic averages where available.${langInstruction}`;

    let completion: any = null;
    for (let i = 0; i < GROQ_KEYS.length; i++) {
      try {
        const groq = new Groq({ apiKey: GROQ_KEYS[i] });
        completion = await groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "llama-3.3-70b-versatile",
          temperature: 0.3,
          max_tokens: 3000,
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
      const match = content.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(match ? match[0] : content);
    } catch {
      return Response.json({ error: "Failed to parse", raw: content }, { status: 500 });
    }

    return Response.json({
      analysis,
      myProducts: myProducts || [],
      historicCount: historicSales?.length || 0,
      weather: weather || null,
      location: location || `${city}, ${state}`,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Category analysis error:", err.message);
    return Response.json({ error: err.message || "Analysis failed" }, { status: 500 });
  }
}
