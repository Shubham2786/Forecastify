import Groq from "groq-sdk";

const GROQ_KEYS = [

  process.env.GROQ_API_KEY_2!,
  process.env.GROQ_API_KEY_3!,
].filter(Boolean);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { storeCategory, storeSize, city, state, weather, forecast, news, events, location, inventory } = body;

    // Build compact inventory context for the AI
    const inventoryContext = inventory?.length
      ? inventory.map((item: any) =>
          `${item.product_name} | ${item.category} | Qty: ${item.quantity}${item.unit || "pcs"} | Min: ${item.min_stock ?? "?"} | Max: ${item.max_stock ?? "?"} | ₹${item.price}${item.brand ? ` | Brand: ${item.brand}` : ""}`
        ).join("\n")
      : "No inventory data available";

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

LOCAL NEWS & OFFERS:
${JSON.stringify(news?.offers?.slice(0, 3) || [], null, 2)}

TRENDING IN CATEGORY:
${JSON.stringify(news?.trending?.slice(0, 3) || [], null, 2)}

UPCOMING EVENTS/FESTIVALS:
${JSON.stringify(news?.events?.slice(0, 3) || [], null, 2)}

CRITICAL INSTRUCTIONS:
- NEVER invent or hallucinate product names. For "demandSpikes.topProducts", "inventoryRecommendations", and "riskAlerts", you may ONLY use product names that appear EXACTLY in the STORE'S CURRENT INVENTORY list above.
- If the inventory is empty or has few products, say so honestly. Do NOT make up products.
- For "trendingProducts", you may include BOTH products from inventory AND market suggestions the store should consider stocking — but you MUST mark which is which using the "inInventory" field (true/false).
- In the summary, reference only real inventory product names and their actual quantities.
- NOT EVERY PRODUCT IS AFFECTED BY EVERY SPIKE. For each demand spike, think carefully about which SPECIFIC product categories are affected by that day's reason. For example:
  * A heatwave day should spike beverages and cold items — NOT soap or cooking oil.
  * A festival should spike sweets, snacks, and gifting items — NOT cleaning products.
  * Only list 1-3 products per spike that are LOGICALLY connected to the reason. If no inventory products match that spike, leave topProducts as an EMPTY array [].
- For each demand spike "reason", you MUST cite SPECIFIC data: mention the exact weather (e.g. "42°C heatwave"), exact festival/event names from the news, or exact trending topics. NEVER use vague reasons like "weekend approaching" or "people may stock up". Every reason must reference actual data from the weather/news/events provided above.
- Some days may have LOW or ZERO spike probability — that is realistic. Do NOT force high spikes on every day.

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

Provide 7 demand spikes (one per day) with REALISTIC and VARYING probabilities (some days may be low at 20-40%). For each spike, list ONLY the 1-3 inventory products logically affected — NOT all products. For trendingProducts, include inventory products that are relevant plus up to 5 market suggestions (with inInventory: false). For inventoryRecommendations, provide one entry for EACH product in inventory with honest action (some may be "Maintain" if stock is fine).`;

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
