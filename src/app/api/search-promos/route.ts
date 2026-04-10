export async function POST(request: Request) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== "string") {
      return Response.json({ error: "query is required" }, { status: 400 });
    }

    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Serper API key not configured" }, { status: 500 });
    }

    const searches = [
      { q: `${query} offers deals discounts India 2026`, label: "offers" },
      { q: `${query} brand promotions advertisements India`, label: "promotions" },
      { q: `${query} market trends demand news India`, label: "news" },
    ];

    const results = await Promise.all(
      searches.map(async ({ q, label }) => {
        const res = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: {
            "X-API-KEY": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ q, gl: "in", num: 3 }),
        });

        if (!res.ok) return { label, items: [] };
        const data = await res.json();
        const items = (data.organic || []).slice(0, 3).map(
          (item: { title: string; snippet: string; link: string }) => ({
            title: item.title,
            snippet: item.snippet,
            link: item.link,
          })
        );
        return { label, items };
      })
    );

    const mapped: Record<string, { title: string; snippet: string; link: string }[]> = {};
    for (const r of results) mapped[r.label] = r.items;

    return Response.json(mapped);
  } catch (err) {
    console.error("Search promos error:", err);
    return Response.json({ error: "Search service unavailable" }, { status: 500 });
  }
}
