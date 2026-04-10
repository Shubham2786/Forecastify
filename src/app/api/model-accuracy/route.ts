/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();
    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    // 1. Get store city from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("city")
      .eq("id", userId)
      .single();
    const city = profile?.city || "Pune";

    // 2. Get product mapping (product_id -> product_name, category)
    const { data: products } = await supabase
      .from("products")
      .select("product_id, product_name, category");

    const productMap: Record<number, { product_name: string; category: string }> = {};
    products?.forEach((p) => {
      productMap[p.product_id] = { product_name: p.product_name, category: p.category };
    });

    // 3. Get demand_forecast for past dates (store_id = 1)
    const today = new Date().toISOString().split("T")[0];
    const { data: forecasts } = await supabase
      .from("demand_forecast")
      .select("date, product_id, predicted_units_sold")
      .eq("store_id", 1)
      .lt("date", today);

    // 4. Determine date range from forecasts
    const forecastDates = [...new Set((forecasts || []).map((f) => f.date))].sort();
    const minDate = forecastDates[0] || today;
    const maxDate = forecastDates[forecastDates.length - 1] || today;

    // 5. Get historic_sales for the same city and date range
    const { data: historicSales } = await supabase
      .from("historic_sales")
      .select("date, product_name, quantity_sold, category")
      .eq("city", city)
      .gte("date", minDate)
      .lte("date", maxDate);

    // 6. Build a lookup: key = "product_name|date" -> actual quantity
    const actualMap: Record<string, { quantity: number; category: string }> = {};
    historicSales?.forEach((s) => {
      const key = `${s.product_name?.toLowerCase()}|${s.date}`;
      if (!actualMap[key]) {
        actualMap[key] = { quantity: 0, category: s.category || "" };
      }
      actualMap[key].quantity += s.quantity_sold;
    });

    // 7. Match predictions to actuals
    const matched: {
      product_name: string;
      category: string;
      date: string;
      predicted: number;
      actual: number;
    }[] = [];

    forecasts?.forEach((f) => {
      const prod = productMap[f.product_id];
      if (!prod) return;
      const key = `${prod.product_name.toLowerCase()}|${f.date}`;
      const act = actualMap[key];
      if (act && act.quantity > 0) {
        matched.push({
          product_name: prod.product_name,
          category: prod.category,
          date: f.date,
          predicted: f.predicted_units_sold,
          actual: act.quantity,
        });
      }
    });

    if (matched.length === 0) {
      return Response.json({
        mape: 0,
        rmse: 0,
        mae: 0,
        accuracy: 0,
        productAccuracy: [],
        dailyTrend: [],
        categoryAccuracy: [],
        matchedCount: 0,
      });
    }

    // 8. Calculate overall MAPE, RMSE, MAE
    let sumAPE = 0;
    let sumSE = 0;
    let sumAE = 0;
    matched.forEach((m) => {
      const err = Math.abs(m.actual - m.predicted);
      sumAPE += err / m.actual;
      sumSE += (m.actual - m.predicted) ** 2;
      sumAE += err;
    });
    const n = matched.length;
    const mape = (sumAPE / n) * 100;
    const rmse = Math.sqrt(sumSE / n);
    const mae = sumAE / n;
    const accuracy = Math.min(100, Math.max(0, 100 - mape));

    // 9. Per-product accuracy
    const productGroups: Record<string, { predicted: number; actual: number; apeSum: number; count: number; category: string }> = {};
    matched.forEach((m) => {
      if (!productGroups[m.product_name]) {
        productGroups[m.product_name] = { predicted: 0, actual: 0, apeSum: 0, count: 0, category: m.category };
      }
      const g = productGroups[m.product_name];
      g.predicted += m.predicted;
      g.actual += m.actual;
      g.apeSum += Math.abs(m.actual - m.predicted) / m.actual;
      g.count++;
    });

    const productAccuracy = Object.entries(productGroups).map(([name, g]) => {
      const prodMape = (g.apeSum / g.count) * 100;
      return {
        product: name,
        category: g.category,
        predicted: Math.round(g.predicted),
        actual: Math.round(g.actual),
        errorPct: Math.round(prodMape * 10) / 10,
        accuracy: Math.round(Math.min(100, Math.max(0, 100 - prodMape)) * 10) / 10,
      };
    }).sort((a, b) => b.accuracy - a.accuracy);

    // 10. Daily accuracy trend (last 14 days)
    const dailyGroups: Record<string, { apeSum: number; count: number }> = {};
    matched.forEach((m) => {
      if (!dailyGroups[m.date]) dailyGroups[m.date] = { apeSum: 0, count: 0 };
      dailyGroups[m.date].apeSum += Math.abs(m.actual - m.predicted) / m.actual;
      dailyGroups[m.date].count++;
    });

    const dailyTrend = Object.entries(dailyGroups)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([date, g]) => {
        const dayMape = (g.apeSum / g.count) * 100;
        return {
          date,
          label: new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
          accuracy: Math.round(Math.min(100, Math.max(0, 100 - dayMape)) * 10) / 10,
          mape: Math.round(dayMape * 10) / 10,
        };
      });

    // 11. Per-category accuracy
    const categoryGroups: Record<string, { apeSum: number; count: number }> = {};
    matched.forEach((m) => {
      const cat = m.category || "Other";
      if (!categoryGroups[cat]) categoryGroups[cat] = { apeSum: 0, count: 0 };
      categoryGroups[cat].apeSum += Math.abs(m.actual - m.predicted) / m.actual;
      categoryGroups[cat].count++;
    });

    const categoryAccuracy = Object.entries(categoryGroups).map(([category, g]) => {
      const catMape = (g.apeSum / g.count) * 100;
      return {
        category,
        accuracy: Math.round(Math.min(100, Math.max(0, 100 - catMape)) * 10) / 10,
        mape: Math.round(catMape * 10) / 10,
      };
    }).sort((a, b) => b.accuracy - a.accuracy);

    return Response.json({
      mape: Math.round(mape * 10) / 10,
      rmse: Math.round(rmse * 10) / 10,
      mae: Math.round(mae * 10) / 10,
      accuracy: Math.round(accuracy * 10) / 10,
      productAccuracy,
      dailyTrend,
      categoryAccuracy,
      matchedCount: n,
    });
  } catch (err: any) {
    console.error("Model accuracy error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
