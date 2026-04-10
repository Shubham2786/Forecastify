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

    // Get user profile for city
    const { data: profile } = await supabase
      .from("profiles")
      .select("city, state")
      .eq("id", userId)
      .single();

    const city = profile?.city || "Pune";

    // Get inventory for this store
    const { data: inventory } = await supabase
      .from("inventory")
      .select("id, product_name, category, quantity, unit, price, min_stock, max_stock, brand")
      .eq("store_id", userId);

    if (!inventory?.length) {
      return Response.json({ items: [], summary: { reorderNow: 0, totalCost: 0, avgLeadTime: 0 } });
    }

    // Get demand forecasts for next 7 days
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const next7 = new Date(today);
    next7.setDate(next7.getDate() + 7);
    const next7Str = next7.toISOString().split("T")[0];

    const { data: forecasts } = await supabase
      .from("demand_forecast")
      .select("product_name, predicted_units_sold, forecast_date")
      .eq("store_id", 1)
      .gte("forecast_date", todayStr)
      .lte("forecast_date", next7Str);

    // Get products table for lead_time_days
    const { data: products } = await supabase
      .from("products")
      .select("name, lead_time_days, category");

    // Get historic sales (last 14 days, matched by city)
    const past14 = new Date(today);
    past14.setDate(past14.getDate() - 14);
    const past14Str = past14.toISOString().split("T")[0];

    const { data: historicSales } = await supabase
      .from("historic_sales")
      .select("product_name, units_sold, date")
      .eq("city", city)
      .gte("date", past14Str)
      .lte("date", todayStr);

    // Build lookup maps
    const forecastMap: Record<string, number> = {};
    forecasts?.forEach((f: any) => {
      forecastMap[f.product_name] = (forecastMap[f.product_name] || 0) + (f.predicted_units_sold || 0);
    });

    const historicMap: Record<string, number[]> = {};
    historicSales?.forEach((s: any) => {
      if (!historicMap[s.product_name]) historicMap[s.product_name] = [];
      historicMap[s.product_name].push(s.units_sold || 0);
    });

    const leadTimeMap: Record<string, number> = {};
    products?.forEach((p: any) => {
      leadTimeMap[p.name] = p.lead_time_days || 3;
    });

    // Calculate reorder data for each inventory product
    const items = inventory.map((item: any) => {
      // Daily demand: forecast sum / 7, or historic average
      let dailyDemand = 0;
      if (forecastMap[item.product_name]) {
        dailyDemand = forecastMap[item.product_name] / 7;
      } else if (historicMap[item.product_name]?.length) {
        const total = historicMap[item.product_name].reduce((a: number, b: number) => a + b, 0);
        dailyDemand = total / historicMap[item.product_name].length;
      } else {
        dailyDemand = Math.max(1, Math.round(item.quantity * 0.05)); // fallback
      }

      const leadTimeDays = leadTimeMap[item.product_name] || 3;
      const safetyStock = dailyDemand * 2;
      const reorderPoint = (dailyDemand * leadTimeDays) + safetyStock;
      const currentStock = item.quantity || 0;
      const needsReorder = currentStock <= reorderPoint;
      const daysUntilReorder = needsReorder ? 0 : Math.round((currentStock - reorderPoint) / dailyDemand);

      const reorderDate = new Date(today);
      reorderDate.setDate(reorderDate.getDate() + daysUntilReorder);

      const orderQuantity = Math.max(0, Math.round((dailyDemand * 14) - currentStock + safetyStock));
      const estimatedCost = Math.round(orderQuantity * (item.price || 0));

      let urgency: string;
      if (daysUntilReorder <= 0) urgency = "immediate";
      else if (daysUntilReorder <= 3) urgency = "soon";
      else if (daysUntilReorder <= 7) urgency = "upcoming";
      else urgency = "planned";

      return {
        productName: item.product_name,
        category: item.category,
        currentStock,
        dailyDemand: Math.round(dailyDemand * 10) / 10,
        leadTimeDays,
        reorderPoint: Math.round(reorderPoint),
        safetyStock: Math.round(safetyStock),
        needsReorder,
        daysUntilReorder,
        reorderDate: reorderDate.toISOString().split("T")[0],
        orderQuantity,
        estimatedCost,
        urgency,
        unit: item.unit || "pcs",
        price: item.price || 0,
      };
    });

    // Sort by urgency priority
    const urgencyOrder: Record<string, number> = { immediate: 0, soon: 1, upcoming: 2, planned: 3 };
    items.sort((a: any, b: any) => (urgencyOrder[a.urgency] ?? 4) - (urgencyOrder[b.urgency] ?? 4));

    // Summary
    const reorderNow = items.filter((i: any) => i.needsReorder).length;
    const totalCost = items.filter((i: any) => i.needsReorder).reduce((s: number, i: any) => s + i.estimatedCost, 0);
    const avgLeadTime = items.length
      ? Math.round((items.reduce((s: number, i: any) => s + i.leadTimeDays, 0) / items.length) * 10) / 10
      : 0;

    return Response.json({
      items,
      summary: { reorderNow, totalCost, avgLeadTime },
    });
  } catch (err: any) {
    console.error("Reorder planner error:", err);
    return Response.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
