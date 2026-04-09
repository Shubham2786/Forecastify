import Groq from "groq-sdk";

const GROQ_KEYS = [
  process.env.GROQ_API_KEY!,
  process.env.GROQ_API_KEY_2!,
].filter(Boolean);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { storeCategory, storeSize, city, state, weather, forecast, news, events, location } = body;

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

LOCAL NEWS & OFFERS:
${JSON.stringify(news?.offers?.slice(0, 3) || [], null, 2)}

TRENDING IN CATEGORY:
${JSON.stringify(news?.trending?.slice(0, 3) || [], null, 2)}

UPCOMING EVENTS/FESTIVALS:
${JSON.stringify(news?.events?.slice(0, 3) || [], null, 2)}

Based on ALL the above data, provide your analysis in the following JSON format ONLY (no markdown, no code blocks, just raw JSON):
{
  "summary": "2-3 sentence executive summary of expected demand patterns",
  "demandSpikes": [
    {
      "day": "YYYY-MM-DD",
      "dayName": "Monday",
      "spikeProbability": 85,
      "expectedIncrease": "+35%",
      "reason": "Why this spike is expected",
      "topProducts": ["product1", "product2", "product3"]
    }
  ],
  "trendingProducts": [
    {
      "name": "Product Name",
      "category": "Category",
      "demandScore": 92,
      "reason": "Why this is trending",
      "recommendedStock": "High/Medium/Low",
      "priceRange": "₹XX - ₹XX"
    }
  ],
  "weatherImpact": {
    "severity": "High/Medium/Low",
    "description": "How weather affects demand",
    "affectedCategories": ["category1", "category2"],
    "recommendations": ["recommendation1", "recommendation2"]
  },
  "upcomingOffers": [
    {
      "event": "Festival/Event name",
      "date": "Expected date or period",
      "affectedCategories": ["category1"],
      "expectedDemandChange": "+XX%",
      "recommendations": ["What to stock up on"]
    }
  ],
  "inventoryRecommendations": [
    {
      "product": "Product name",
      "action": "Increase/Decrease/Maintain",
      "currentAdvice": "Specific advice",
      "urgency": "High/Medium/Low"
    }
  ],
  "riskAlerts": [
    {
      "type": "stockout/overstock/spoilage/competition",
      "severity": "critical/warning/info",
      "message": "What the risk is",
      "mitigation": "How to address it"
    }
  ]
}

Provide at least 7 demand spikes (one per day), 10+ trending products relevant to a ${storeCategory} store, and comprehensive recommendations. Be specific with Indian product names, brands, and realistic price ranges in INR.`;

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
