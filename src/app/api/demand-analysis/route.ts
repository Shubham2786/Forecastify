import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GROQ_KEYS = [
  process.env.GROQ_API_KEY!,
  process.env.GROQ_API_KEY_2!,
  process.env.GROQ_API_KEY_3!,
].filter(Boolean);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { storeCategory, storeSize, city, state, weather, forecast, news, location, inventory, promotions, lang } = body;

    const langMap: Record<string, string> = { hi: "Hindi", mr: "Marathi", ta: "Tamil", te: "Telugu", kn: "Kannada", bn: "Bengali", gu: "Gujarati" };
    const langInstruction = lang && langMap[lang] ? `\n\nIMPORTANT: Write ALL text fields in ${langMap[lang]}. Keep product names, numbers, and JSON keys in English.` : "";

    // Fetch regional_events from DB directly
    const today = new Date().toISOString().split("T")[0];
    const next14 = new Date(); next14.setDate(next14.getDate() + 14);
    const [{ data: upcomingEvents }, { data: ongoingEvents }] = await Promise.all([
      supabase.from("regional_events")
        .select("event_name, start_date, end_date, demand_impact_percent, affected_categories, event_type, is_national")
        .gte("start_date", today).lte("start_date", next14.toISOString().split("T")[0])
        .order("start_date", { ascending: true }),
      supabase.from("regional_events")
        .select("event_name, start_date, end_date, demand_impact_percent, affected_categories, event_type, is_national")
        .lte("start_date", today).gte("end_date", today),
    ]);
    const allDbEvents = [...(upcomingEvents || []), ...(ongoingEvents || [])];
    const dbEventsStr = allDbEvents.length
      ? allDbEvents.map((e: any) =>
          `${e.event_name} | ${e.event_type} | ${e.start_date}→${e.end_date} | +${e.demand_impact_percent}% on [${e.affected_categories?.join(", ")}]${e.is_national ? " | NATIONAL" : ""}`
        ).join("\n")
      : "None";

    const inventoryContext = inventory?.length
      ? inventory.map((item: any) =>
          `${item.product_name} | ${item.category} | Stock: ${item.current_stock}${item.unit || "pcs"} | ₹${item.price}${item.brand ? ` | Brand: ${item.brand}` : ""}`
        ).join("\n")
      : "No inventory data available";

    const promotionsContext = promotions?.length
      ? promotions.map((p: any) =>
          `${p.product_name}|${p.promo_type}|${p.discount_pct}% off|campaign:${p.campaign_name}|date:${p.date}${p.display_flag ? "|displayed in store" : ""}`
        ).join("\n")
      : "No active promotions";

    const prompt = `You are an AI retail demand forecasting expert for Indian retail stores. Analyze the following data and provide a comprehensive demand spike analysis.

STORE DETAILS:
- Category: ${storeCategory}
- Size: ${storeSize}
- Location: ${location || `${city}, ${state}`}

CURRENT WEATHER:
- Temperature: ${weather?.temp}°C (Feels like: ${weather?.feelsLike}°C)
- Conditions: ${weather?.description}
- Humidity: ${weather?.humidity}%
- Wind Speed: ${weather?.windSpeed} m/s

7-DAY WEATHER FORECAST:
${forecast?.map((d: { date: string; avgTemp: number; weather: string; avgHumidity: number }) => `- ${d.date}: ${d.avgTemp}°C, ${d.weather}, Humidity: ${d.avgHumidity}%`).join("\n") || "Not available"}

STORE'S CURRENT INVENTORY (${inventory?.length || 0} products):
${inventoryContext}

ACTIVE PROMOTIONS (next 7 days):
${promotionsContext}

UPCOMING FESTIVALS & EVENTS (from database — with exact demand impact %):
${dbEventsStr}

LOCAL NEWS & MARKET TRENDS (live from Google):
${JSON.stringify(news?.offers?.slice(0, 3) || [], null, 2)}

TRENDING IN CATEGORY:
${JSON.stringify(news?.trending?.slice(0, 3) || [], null, 2)}

CRITICAL INSTRUCTIONS:
- NEVER invent or hallucinate product names. For "demandSpikes.topProducts", "inventoryRecommendations", and "riskAlerts", you may ONLY use product names that appear EXACTLY in the STORE'S CURRENT INVENTORY list above.
- For "upcomingOffers", use ONLY events from the UPCOMING FESTIVALS & EVENTS section above — use their exact demand_impact_percent values.
- If a product has an ACTIVE PROMOTION, its demand will be higher — factor in 20-40% uplift per 10% discount.
- For "trendingProducts", you may include BOTH products from inventory AND market suggestions — mark with "inInventory": true/false.
- NOT EVERY PRODUCT IS AFFECTED BY EVERY SPIKE. Only list 1-3 products per spike that are LOGICALLY connected to the reason.
- For each demand spike "reason", cite SPECIFIC data: exact weather, exact festival name from DB events, or exact trending topic. NEVER use vague reasons.
- Some days may have LOW or ZERO spike probability — that is realistic.

Based on ALL the above data, provide your analysis in the following JSON format ONLY (no markdown, no code blocks, just raw JSON):
{
  "summary": "2-3 sentence executive summary mentioning ONLY the 2-3 most at-risk products from inventory with their actual quantities, and the PRIMARY reason (weather/event) WHY demand will change",
  "demandSpikes": [
    {
      "day": "YYYY-MM-DD",
      "dayName": "Monday",
      "spikeProbability": 85,
      "expectedIncrease": "+35%",
      "reason": "SPECIFIC reason citing actual data, e.g. 'Heatwave at 42°C driving cold beverage demand' or 'Gudi Padwa festival increasing sweets and snacks purchases'",
      "topProducts": ["ONLY 1-3 products from inventory that are LOGICALLY affected by this specific reason — NOT all products"]
    }
  ],
  "trendingProducts": [
    {
      "name": "Product Name",
      "category": "Category",
      "demandScore": 92,
      "reason": "Why this is trending",
      "recommendedStock": "High/Medium/Low",
      "priceRange": "₹XX - ₹XX",
      "inInventory": true
    }
  ],
  "weatherImpact": {
    "severity": "High/Medium/Low",
    "description": "How weather affects demand — reference ONLY the specific products from inventory that are weather-sensitive (e.g. beverages in heat, not soap)",
    "affectedCategories": ["category1", "category2"],
    "recommendations": ["specific recommendation referencing actual inventory products"]
  },
  "upcomingOffers": [
    {
      "event": "Festival/Event name",
      "date": "Expected date or period",
      "affectedCategories": ["category1"],
      "expectedDemandChange": "+XX%",
      "recommendations": ["What to stock up on — reference inventory items by exact name"]
    }
  ],
  "inventoryRecommendations": [
    {
      "product": "EXACT product_name from the inventory list — DO NOT invent names",
      "action": "Increase/Decrease/Maintain",
      "currentAdvice": "Current stock is X units, expected demand is Y units in Z days, order N more",
      "urgency": "High/Medium/Low"
    }
  ],
  "riskAlerts": [
    {
      "type": "stockout/overstock/spoilage/competition",
      "severity": "critical/warning/info",
      "message": "Reference ONLY real products from inventory with their actual stock levels",
      "mitigation": "How to address it"
    }
  ]
}

Provide 7 demand spikes (one per day) with REALISTIC and VARYING probabilities (some days may be low at 20-40%). For each spike, list ONLY the 1-3 inventory products logically affected — NOT all products. For trendingProducts, include inventory products that are relevant plus up to 5 market suggestions (with inInventory: false). For inventoryRecommendations, provide one entry for EACH product in inventory with honest action (some may be "Maintain" if stock is fine).${langInstruction}`;

    let completion: any = null;
    for (let i = 0; i < GROQ_KEYS.length; i++) {
      try {
        const groq = new Groq({ apiKey: GROQ_KEYS[i] });
        completion = await groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "llama-3.3-70b-versatile",
          temperature: 0.7,
          max_tokens: 4000,
        });
        break;
      } catch (e: any) {
        console.log(`Groq key ${i + 1} failed:`, e.message);
        if (i === GROQ_KEYS.length - 1) throw e;
      }
    }

    const content = completion.choices[0]?.message?.content || "";

    // Parse the JSON response
    let analysis;
    try {
      // Try to extract JSON from the response (handle potential markdown wrapping)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      return Response.json({ error: "Failed to parse AI response", raw: content }, { status: 500 });
    }

    return Response.json({ analysis, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Demand analysis error:", err);
    return Response.json({ error: "Demand analysis service unavailable" }, { status: 500 });
  }
}
