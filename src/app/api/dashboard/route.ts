import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();
    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    const { data: store } = await supabase.from("profiles")
      .select("store_name, store_category, store_size, city, state").eq("id", userId).single();

    const city = store?.city || "Pune";
    const storeState = store?.state || "Maharashtra";

    const stateToRegion: Record<string, string> = {
      "Maharashtra": "West", "Gujarat": "West", "Goa": "West", "Rajasthan": "West",
      "West Bengal": "East", "Bihar": "East", "Jharkhand": "East", "Odisha": "East",
      "Tamil Nadu": "South", "Kerala": "South", "Karnataka": "South", "Andhra Pradesh": "South", "Telangana": "South",
      "Uttar Pradesh": "North", "Delhi": "North", "Haryana": "North", "Punjab": "North", "Madhya Pradesh": "North",
    };
    const storeRegion = stateToRegion[storeState] || "West";

    // Match user to stores table (PDF-required table)
    const { data: matchedStore } = await supabase.from("stores")
      .select("store_id, store_name, city, state, store_type, store_size_sqft")
      .ilike("city", city).limit(1).maybeSingle();
    const storeId = matchedStore?.store_id || 1;

    // 1. Full inventory
    const { data: inventory } = await supabase.from("inventory")
      .select("id, product_name, category, quantity, unit, price, min_stock, max_stock, brand, created_at")
      .eq("store_id", userId).order("created_at", { ascending: false });

    const totalSKUs = inventory?.length || 0;
    const criticalItems = inventory?.filter(i => i.quantity <= (i.min_stock || 10) * 0.5).length || 0;
    const lowItems = inventory?.filter(i => i.quantity <= (i.min_stock || 10)).length || 0;
    const overstockItems = inventory?.filter(i => i.quantity >= (i.max_stock || 1000) * 0.9).length || 0;
    const totalValue = inventory?.reduce((s, i) => s + (i.quantity * i.price), 0) || 0;

    // Category demand
    const catMap: Record<string, { stock: number; value: number; count: number }> = {};
    inventory?.forEach(i => {
      if (!catMap[i.category]) catMap[i.category] = { stock: 0, value: 0, count: 0 };
      catMap[i.category].stock += i.quantity;
      catMap[i.category].value += i.quantity * i.price;
      catMap[i.category].count++;
    });
    const categoryDemand = Object.entries(catMap)
      .map(([cat, d]) => ({ category: cat, stock: d.stock, value: Math.round(d.value), products: d.count }))
      .sort((a, b) => b.stock - a.stock).slice(0, 8);

    // 2. Recent products
    const recentProducts = (inventory || []).slice(0, 10).map(i => ({
      name: i.product_name, category: i.category, quantity: i.quantity, unit: i.unit,
      price: i.price, brand: i.brand,
      status: i.quantity <= (i.min_stock || 10) * 0.5 ? "critical"
        : i.quantity <= (i.min_stock || 10) ? "low"
        : i.quantity >= (i.max_stock || 1000) * 0.9 ? "overstock" : "optimal",
    }));

    // 3. Inventory sorted views
    const byLowQty = [...(inventory || [])].sort((a, b) => a.quantity - b.quantity).slice(0, 10).map(i => ({
      name: i.product_name, category: i.category, quantity: i.quantity, unit: i.unit, price: i.price,
      status: i.quantity <= (i.min_stock || 10) * 0.5 ? "critical" : i.quantity <= (i.min_stock || 10) ? "low" : "ok",
    }));
    const byHighPrice = [...(inventory || [])].sort((a, b) => (b.quantity * b.price) - (a.quantity * a.price)).slice(0, 10).map(i => ({
      name: i.product_name, category: i.category, quantity: i.quantity, unit: i.unit, price: i.price,
      totalValue: Math.round(i.quantity * i.price),
    }));

    // 4. Demand forecast (next 7 days)
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const next7end = new Date(now); next7end.setDate(next7end.getDate() + 7);
    const { data: forecasts } = await supabase.from("demand_forecast")
      .select("date, product_id, predicted_units_sold, recommended_inventory_level, confidence")
      .eq("store_id", storeId).gte("date", today).lte("date", next7end.toISOString().split("T")[0]);

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayNamesFull = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const forecastByDay: Record<string, { predicted: number; recommended: number; count: number; date: string }> = {};
    forecasts?.forEach(f => {
      const d = new Date(f.date);
      const key = f.date; // use date as key for proper ordering
      if (!forecastByDay[key]) forecastByDay[key] = { predicted: 0, recommended: 0, count: 0, date: f.date };
      forecastByDay[key].predicted += f.predicted_units_sold;
      forecastByDay[key].recommended += f.recommended_inventory_level;
      forecastByDay[key].count++;
    });

    const salesForecast = Object.entries(forecastByDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => {
        const d = new Date(v.date);
        return {
          day: dayNames[d.getDay()],
          date: v.date,
          predicted: Math.round(v.predicted),
          recommended: Math.round(v.recommended),
          productCount: v.count,
        };
      });

    // 5. Products info
    const { data: allProducts } = await supabase.from("products").select("product_id, product_name, category, mrp, brand");
    const productInfoMap: Record<number, any> = {};
    const productNameMap: Record<number, string> = {};
    allProducts?.forEach(p => { productInfoMap[p.product_id] = p; productNameMap[p.product_id] = p.product_name; });

    // Top demanded products
    const demandByProduct: Record<number, number> = {};
    forecasts?.forEach(f => { demandByProduct[f.product_id] = (demandByProduct[f.product_id] || 0) + f.predicted_units_sold; });
    const topDemandProducts = Object.entries(demandByProduct)
      .sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([pid, demand]) => {
        const p = productInfoMap[Number(pid)];
        const inv = inventory?.find(i => i.product_name === p?.product_name);
        const dailyD = Math.round(demand / 7);
        return {
          name: p?.product_name || `Product #${pid}`, category: p?.category || "?",
          brand: p?.brand || "?", weeklyDemand: Math.round(demand), dailyDemand: dailyD,
          currentStock: inv?.quantity || 0, unit: inv?.unit || "pcs",
          daysOfStock: dailyD > 0 ? Math.round((inv?.quantity || 0) / dailyD) : 0,
          price: p?.mrp || inv?.price || 0,
          gap: inv ? Math.round(demand * 1.2) - inv.quantity : Math.round(demand * 1.2),
        };
      });

    // 6. Historic sales — last 14 days for proper matching
    const last14Start = new Date(now); last14Start.setDate(last14Start.getDate() - 14);
    const { data: recentSales } = await supabase.from("historic_sales")
      .select("date, day_of_week, quantity_sold, product_name, category, temperature, weather_condition, is_weekend, is_festival, festival_name")
      .eq("city", city).gte("date", last14Start.toISOString().split("T")[0])
      .order("date", { ascending: true });

    // If no data for this city, try without city filter
    let salesData = recentSales;
    if (!salesData?.length) {
      const { data: fallback } = await supabase.from("historic_sales")
        .select("date, day_of_week, quantity_sold, product_name, category, temperature, weather_condition, is_weekend, is_festival, festival_name")
        .gte("date", last14Start.toISOString().split("T")[0])
        .order("date", { ascending: true }).limit(500);
      salesData = fallback;
    }

    // Group by day_of_week (full name -> 3-letter)
    const historicByDay: Record<string, { total: number; count: number }> = {};
    salesData?.forEach(s => {
      const day = s.day_of_week?.slice(0, 3) || "?";
      if (!historicByDay[day]) historicByDay[day] = { total: 0, count: 0 };
      historicByDay[day].total += s.quantity_sold;
      historicByDay[day].count++;
    });

    // Also group by date for the last 7 days
    const last7Start = new Date(now); last7Start.setDate(last7Start.getDate() - 7);
    const historicByDate: Record<string, number> = {};
    salesData?.forEach(s => {
      if (s.date >= last7Start.toISOString().split("T")[0]) {
        historicByDate[s.date] = (historicByDate[s.date] || 0) + s.quantity_sold;
      }
    });

    // Build last week data for chart (7 days before forecast starts)
    const lastWeekData: { day: string; date: string; sales: number }[] = [];
    for (let i = 7; i >= 1; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayStr = dayNames[d.getDay()];
      const daySales = historicByDate[dateStr] || 0;
      // If no data for exact date, use avg for that day_of_week
      const h = historicByDay[dayStr];
      lastWeekData.push({
        day: dayStr, date: dateStr,
        sales: daySales > 0 ? daySales : (h ? Math.round(h.total / h.count) : 0),
      });
    }

    // Merge forecast with last week's same-day average
    const forecastVsHistoric = salesForecast.map(f => {
      const h = historicByDay[f.day];
      const lastWeekAvg = h ? Math.round(h.total / h.count) : 0;
      return { ...f, actual: lastWeekAvg || null };
    });

    // Total last week sales
    const totalLastWeek = lastWeekData.reduce((s, d) => s + d.sales, 0);

    // 7. Weather impact
    const weatherImpact: { condition: string; avgSales: number; count: number }[] = [];
    const weatherGroups: Record<string, { total: number; count: number }> = {};
    salesData?.forEach(s => {
      const cond = s.weather_condition || "Unknown";
      if (!weatherGroups[cond]) weatherGroups[cond] = { total: 0, count: 0 };
      weatherGroups[cond].total += s.quantity_sold;
      weatherGroups[cond].count++;
    });
    Object.entries(weatherGroups).forEach(([cond, d]) => {
      weatherImpact.push({ condition: cond, avgSales: Math.round(d.total / d.count), count: d.count });
    });
    weatherImpact.sort((a, b) => b.avgSales - a.avgSales);

    const weekendSales = salesData?.filter(s => s.is_weekend) || [];
    const weekdaySales = salesData?.filter(s => !s.is_weekend) || [];
    const avgWeekendSales = weekendSales.length ? Math.round(weekendSales.reduce((s, r) => s + r.quantity_sold, 0) / weekendSales.length) : 0;
    const avgWeekdaySales = weekdaySales.length ? Math.round(weekdaySales.reduce((s, r) => s + r.quantity_sold, 0) / weekdaySales.length) : 0;

    const hotDaySales = salesData?.filter(s => s.temperature && s.temperature > 35) || [];
    const coldDaySales = salesData?.filter(s => s.temperature && s.temperature < 20) || [];
    const avgHotSales = hotDaySales.length ? Math.round(hotDaySales.reduce((s, r) => s + r.quantity_sold, 0) / hotDaySales.length) : 0;
    const avgColdSales = coldDaySales.length ? Math.round(coldDaySales.reduce((s, r) => s + r.quantity_sold, 0) / coldDaySales.length) : 0;

    // 8. Promotions
    const promoLastMonth = new Date(now); promoLastMonth.setDate(promoLastMonth.getDate() - 30);
    const { data: activePromos } = await supabase.from("promotions")
      .select("date, product_id, promo_type, discount_pct, campaign_name")
      .gte("date", promoLastMonth.toISOString().split("T")[0])
      .order("date", { ascending: false }).limit(20);
    const promotions = activePromos?.map(p => ({
      date: p.date, product: productNameMap[p.product_id] || `Product #${p.product_id}`,
      type: p.promo_type, discount: p.discount_pct, campaign: p.campaign_name,
    })) || [];
    const promoTypeSummary: Record<string, { count: number; avgDiscount: number }> = {};
    activePromos?.forEach(p => {
      if (!promoTypeSummary[p.promo_type]) promoTypeSummary[p.promo_type] = { count: 0, avgDiscount: 0 };
      promoTypeSummary[p.promo_type].count++;
      promoTypeSummary[p.promo_type].avgDiscount += p.discount_pct;
    });
    const promotionImpact = Object.entries(promoTypeSummary).map(([type, d]) => ({
      type, count: d.count, avgDiscount: Math.round(d.avgDiscount / d.count),
    }));

    // 9. Events
    const next14 = new Date(now); next14.setDate(next14.getDate() + 14);
    const { data: allEvents } = await supabase.from("regional_events")
      .select("event_name, start_date, demand_impact_percent, affected_categories, event_type, is_national, region")
      .gte("start_date", today).lte("start_date", next14.toISOString().split("T")[0]).order("start_date");
    const events = allEvents?.filter(e => e.is_national || !e.region || e.region === "All India" || e.region === storeRegion) || [];

    // 10. Realtime signals
    const signalsSince = new Date(now); signalsSince.setHours(signalsSince.getHours() - 24);
    const { data: signals } = await supabase.from("realtime_signals")
      .select("timestamp, product_id, signal_type, signal_strength, notes")
      .gte("timestamp", signalsSince.toISOString()).order("timestamp", { ascending: false }).limit(5);
    const realtimeSignals = signals?.map(s => ({
      time: s.timestamp, product: productNameMap[s.product_id] || `Product #${s.product_id}`,
      type: s.signal_type, strength: s.signal_strength, notes: s.notes,
    })) || [];

    // 11. Risk — per-product stockout probability + demand volatility
    // Calculate daily demand from forecast per product
    const dailyDemandByProduct: Record<string, number> = {};
    topDemandProducts.forEach(p => { dailyDemandByProduct[p.name.toLowerCase()] = p.dailyDemand; });

    // Stockout risk: products where stock / daily_demand < 3 days
    const stockoutProducts = (inventory || []).map(i => {
      const forecastDemand = dailyDemandByProduct[i.product_name.toLowerCase()] || 0;
      const dailyDemand = forecastDemand > 0 ? forecastDemand : Math.max(1, Math.round(i.quantity / 14));
      const daysLeft = dailyDemand > 0 ? Math.round(i.quantity / dailyDemand) : 999;
      const probability = daysLeft <= 1 ? 95 : daysLeft <= 2 ? 80 : daysLeft <= 3 ? 60 : daysLeft <= 5 ? 30 : 5;
      return {
        name: i.product_name, category: i.category, currentStock: i.quantity, unit: i.unit,
        dailyDemand, daysLeft, probability, price: i.price,
        risk: probability >= 70 ? "high" : probability >= 40 ? "medium" : "low",
      };
    }).sort((a, b) => b.probability - a.probability);

    const stockoutRisk = stockoutProducts.filter(p => p.daysLeft < 3).length;

    // Demand volatility per product from historic data
    const volatilityByProduct: Record<string, { sales: number[] }> = {};
    salesData?.forEach(s => {
      const key = s.product_name?.toLowerCase() || "";
      if (!volatilityByProduct[key]) volatilityByProduct[key] = { sales: [] };
      volatilityByProduct[key].sales.push(s.quantity_sold);
    });

    const volatilityProducts = Object.entries(volatilityByProduct).map(([name, d]) => {
      const mean = d.sales.reduce((s, v) => s + v, 0) / d.sales.length;
      const variance = d.sales.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / d.sales.length;
      const cv = mean > 0 ? Math.round(Math.sqrt(variance) / mean * 100) : 0;
      return {
        name: name.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
        avgSales: Math.round(mean * 10) / 10,
        volatility: cv,
        dataPoints: d.sales.length,
        level: cv > 40 ? "high" : cv > 20 ? "medium" : "low",
      };
    }).sort((a, b) => b.volatility - a.volatility);

    const demandVolatility = salesData?.length
      ? (() => {
          const daily = Object.values(historicByDay).map(d => Math.round(d.total / d.count));
          if (!daily.length) return 15;
          const mean = daily.reduce((s, v) => s + v, 0) / daily.length;
          if (mean === 0) return 0;
          const variance = daily.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / daily.length;
          return Math.round(Math.sqrt(variance) / mean * 100);
        })() : 15;

    // Revenue
    const totalForecastDemand = forecasts?.reduce((s, f) => s + f.predicted_units_sold, 0) || 0;
    const demandTrend = totalLastWeek > 0
      ? Math.round(((totalForecastDemand - totalLastWeek) / totalLastWeek) * 100) : 0;

    const productPriceMap: Record<number, number> = {};
    allProducts?.forEach(p => { productPriceMap[p.product_id] = p.mrp || 0; });
    inventory?.forEach(i => {
      const mp = allProducts?.find(p => p.product_name === i.product_name);
      if (mp && !productPriceMap[mp.product_id]) productPriceMap[mp.product_id] = i.price || 0;
    });
    const predictedRevenue = forecasts?.reduce((sum, f) => sum + (f.predicted_units_sold * (productPriceMap[f.product_id] || 0)), 0) || 0;

    const avgConfidence = forecasts?.length
      ? Math.round((forecasts.reduce((s, f) => s + (f.confidence || 0.75), 0) / forecasts.length) * 100) : 78;

    // Weather data from database (weather_history table — PDF's "weather" table)
    const last7W = new Date(now); last7W.setDate(last7W.getDate() - 7);
    const { data: dbWeatherData } = await supabase.from("weather_history")
      .select("date, avg_temp, max_temp, min_temp, humidity, weather_condition, rainfall_mm")
      .eq("city", city).gte("date", last7W.toISOString().split("T")[0])
      .order("date", { ascending: false }).limit(7);

    // Test inputs — records the system must predict (test_input table)
    const { data: testInputs } = await supabase.from("test_input")
      .select("date, store_id, product_id")
      .eq("store_id", storeId).gte("date", today).order("date");
    const testFulfilled = testInputs?.filter(ti =>
      forecasts?.some(f => f.date === ti.date && f.product_id === ti.product_id)
    ).length || 0;

    return Response.json({
      store,
      stats: {
        totalSKUs, predictedRevenue: Math.round(predictedRevenue), forecastAccuracy: avgConfidence,
        activeAlerts: criticalItems + lowItems, criticalItems, lowItems, overstockItems,
        totalInventoryValue: Math.round(totalValue), stockoutRisk, demandVolatility, demandTrend,
        avgWeekendSales, avgWeekdaySales, avgHotSales, avgColdSales,
        totalForecastDemand: Math.round(totalForecastDemand),
        totalLastWeek: Math.round(totalLastWeek),
        forecastProductCount: forecasts?.length ? new Set(forecasts.map(f => f.product_id)).size : 0,
        dataSource: `${city}, ${storeState}`,
        historicDataDays: salesData?.length || 0,
      },
      salesForecast: forecastVsHistoric,
      lastWeekData,
      categoryDemand,
      recentProducts,
      topDemandProducts,
      inventoryByLowQty: byLowQty,
      inventoryByValue: byHighPrice,
      weatherImpact,
      promotionImpact,
      promotions,
      events,
      realtimeSignals,
      stockoutProducts: stockoutProducts.slice(0, 15),
      volatilityProducts: volatilityProducts.slice(0, 15),
      matchedStore: matchedStore || null,
      storeId,
      dbWeather: dbWeatherData || [],
      testInputs: { total: testInputs?.length || 0, fulfilled: testFulfilled, pending: (testInputs?.length || 0) - testFulfilled },
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Dashboard error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
