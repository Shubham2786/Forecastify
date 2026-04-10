import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();
    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    const { data: store } = await supabase.from("profiles")
      .select("store_name, city, state").eq("id", userId).single();
    const city = store?.city || "Pune";

    // Map to stores table for FK-based queries
    const { data: matchedStore } = await supabase.from("stores")
      .select("store_id").ilike("city", city).limit(1).maybeSingle();
    const storeId = matchedStore?.store_id || 1;

    // 1. All products
    const { data: products } = await supabase.from("products")
      .select("product_id, product_name, category, subcategory, brand, mrp");

    const productMap: Record<number, any> = {};
    products?.forEach(p => { productMap[p.product_id] = p; });

    // 2. Inventory for this store
    const { data: inventory } = await supabase.from("inventory")
      .select("product_name, category, quantity, unit, price, min_stock, max_stock")
      .eq("store_id", userId);

    // Map inventory by product name (lowercase)
    const invMap: Record<string, any> = {};
    inventory?.forEach(i => { invMap[i.product_name.toLowerCase()] = i; });

    // 3. Demand forecasts (next 7 days)
    const today = new Date().toISOString().split("T")[0];
    const next7 = new Date(); next7.setDate(next7.getDate() + 7);
    const { data: forecasts } = await supabase.from("demand_forecast")
      .select("date, product_id, predicted_units_sold, recommended_inventory_level, confidence")
      .eq("store_id", storeId).gte("date", today).lte("date", next7.toISOString().split("T")[0]);

    // 4. Historic sales (last 14 days for comparison)
    const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const { data: historicSales } = await supabase.from("historic_sales")
      .select("date, product_name, quantity_sold, day_of_week, temperature, is_weekend")
      .eq("city", city)
      .gte("date", twoWeeksAgo.toISOString().split("T")[0])
      .order("date", { ascending: true });

    // 5. Build per-product forecasts
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const productForecasts: any[] = [];

    // Group forecasts by product
    const forecastsByProduct: Record<number, any[]> = {};
    forecasts?.forEach(f => {
      if (!forecastsByProduct[f.product_id]) forecastsByProduct[f.product_id] = [];
      forecastsByProduct[f.product_id].push(f);
    });

    // Group historic sales by product name
    const historicByProduct: Record<string, any[]> = {};
    historicSales?.forEach(s => {
      const key = s.product_name?.toLowerCase() || "";
      if (!historicByProduct[key]) historicByProduct[key] = [];
      historicByProduct[key].push(s);
    });

    for (const [pidStr, pForecasts] of Object.entries(forecastsByProduct)) {
      const pid = Number(pidStr);
      const product = productMap[pid];
      if (!product) continue;

      // Match inventory
      const inv = invMap[product.product_name.toLowerCase()];
      const currentStock = inv?.quantity || 0;
      const price = product.mrp || inv?.price || 0;

      // Build 7-day forecast
      const dailyForecast = pForecasts
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(f => {
          const d = new Date(f.date);
          return {
            day: dayNames[d.getDay()],
            date: f.date,
            predicted: Math.round(f.predicted_units_sold),
            recommended: Math.round(f.recommended_inventory_level),
            confidence: Math.round((f.confidence || 0.8) * 100),
          };
        });

      // Avg daily demand from forecast
      const avgDemand = dailyForecast.length
        ? Math.round(dailyForecast.reduce((s, d) => s + d.predicted, 0) / dailyForecast.length)
        : 0;
      const weeklyDemand = dailyForecast.reduce((s, d) => s + d.predicted, 0);

      // Historic avg
      const histSales = historicByProduct[product.product_name.toLowerCase()] || [];
      const historicAvg = histSales.length
        ? Math.round(histSales.reduce((s, h) => s + h.quantity_sold, 0) / histSales.length)
        : 0;

      // Days of stock
      const daysOfStock = avgDemand > 0 ? Math.round((currentStock / avgDemand) * 10) / 10 : 999;

      // Status
      let status: string;
      if (daysOfStock < 2) status = "critical";
      else if (daysOfStock < 5) status = "low";
      else if (inv && currentStock >= (inv.max_stock || 1000) * 0.9) status = "overstock";
      else status = "optimal";

      // Trend
      let trend: string;
      if (historicAvg > 0 && avgDemand > historicAvg * 1.1) trend = "rising";
      else if (historicAvg > 0 && avgDemand < historicAvg * 0.9) trend = "falling";
      else trend = "stable";

      // Avg confidence
      const avgConfidence = pForecasts.length
        ? Math.round(pForecasts.reduce((s, f) => s + (f.confidence || 0.8), 0) / pForecasts.length * 100)
        : 80;

      productForecasts.push({
        productId: pid,
        product: product.product_name,
        category: product.category,
        brand: product.brand,
        mrp: price,
        currentStock,
        recommendedStock: Math.round(weeklyDemand * 1.3),
        dailyDemand: avgDemand,
        weeklyDemand,
        daysOfStock,
        status,
        trend,
        confidence: avgConfidence,
        historicAvg,
        dailyForecast,
      });
    }

    // Sort by status priority: critical > low > overstock > optimal
    const statusOrder: Record<string, number> = { critical: 0, low: 1, overstock: 2, optimal: 3 };
    productForecasts.sort((a, b) => (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3));

    // 6. Store-wide aggregated forecast (for the main chart)
    const aggregatedByDay: Record<string, { predicted: number; recommended: number; date: string }> = {};
    forecasts?.forEach(f => {
      const d = new Date(f.date);
      const key = dayNames[d.getDay()];
      if (!aggregatedByDay[key]) aggregatedByDay[key] = { predicted: 0, recommended: 0, date: f.date };
      aggregatedByDay[key].predicted += f.predicted_units_sold;
      aggregatedByDay[key].recommended += f.recommended_inventory_level;
    });

    // Historic aggregated by day of week
    const historicByDayOfWeek: Record<string, { total: number; count: number }> = {};
    historicSales?.forEach(s => {
      const day = s.day_of_week?.slice(0, 3) || "?";
      if (!historicByDayOfWeek[day]) historicByDayOfWeek[day] = { total: 0, count: 0 };
      historicByDayOfWeek[day].total += s.quantity_sold;
      historicByDayOfWeek[day].count++;
    });

    const storeWideForecast = Object.entries(aggregatedByDay).map(([day, v]) => {
      const hist = historicByDayOfWeek[day];
      const actual = hist ? Math.round(hist.total / hist.count) : null;
      const predicted = Math.round(v.predicted);
      return {
        day,
        date: v.date,
        predicted,
        actual,
        recommended: Math.round(v.recommended),
        upper: Math.round(predicted * 1.15),
        lower: Math.round(predicted * 0.85),
      };
    });

    // 7. Revenue forecast using actual MRP
    const revenueForecast = storeWideForecast.map(d => {
      // Use the aggregated revenue from per-product forecasts for this day
      let dayRevenue = 0;
      forecasts?.filter(f => {
        const fd = new Date(f.date);
        return dayNames[fd.getDay()] === d.day && f.date === d.date;
      }).forEach(f => {
        const price = productMap[f.product_id]?.mrp || 0;
        dayRevenue += f.predicted_units_sold * price;
      });
      return { ...d, revenue: Math.round(dayRevenue) };
    });

    // Test inputs for this store (test_input table)
    const { data: testInputs } = await supabase.from("test_input")
      .select("date, product_id").eq("store_id", storeId).gte("date", today);
    const testProductIds = new Set(testInputs?.map(t => t.product_id) || []);

    return Response.json({
      store,
      storeId,
      productForecasts: productForecasts.map(p => ({
        ...p,
        isTestInput: testProductIds.has(p.productId),
      })),
      storeWideForecast: revenueForecast,
      totalProducts: productForecasts.length,
      criticalCount: productForecasts.filter(p => p.status === "critical").length,
      lowCount: productForecasts.filter(p => p.status === "low").length,
      overstockCount: productForecasts.filter(p => p.status === "overstock").length,
      testInputs: { total: testInputs?.length || 0, productIds: [...testProductIds] },
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Forecasts error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
