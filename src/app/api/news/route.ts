export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { storeCategory, city, state } = body;

    if (!storeCategory) {
      return Response.json({ error: "storeCategory is required" }, { status: 400 });
    }

    const apiKey = process.env.SERPER_API_KEY;
    const location = [city, state, "India"].filter(Boolean).join(", ");

    // Search for offers, deals, and trends related to the store category
    const queries = [
      `${storeCategory} offers deals discounts ${location} 2026`,
      `${storeCategory} trending products demand India`,
      `upcoming festivals events ${location} April 2026`,
    ];

    const results = await Promise.all(
      queries.map(async (q) => {
        const res = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: {
            "X-API-KEY": apiKey!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ q, gl: "in", num: 5 }),
        });

        if (!res.ok) return [];
        const data = await res.json();
        return (data.organic || []).map((item: { title: string; snippet: string; link: string }) => ({
          title: item.title,
          snippet: item.snippet,
          link: item.link,
        }));
      })
    );

    return Response.json({
      offers: results[0] || [],
      trending: results[1] || [],
      events: results[2] || [],
    });
  } catch (err) {
    console.error("News API error:", err);
    return Response.json({ error: "News service unavailable" }, { status: 500 });
  }
}
