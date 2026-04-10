/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function calcStockLevelScore(quantity: number, minStock: number | null, maxStock: number | null): number {
  const min = minStock ?? 0;
  const max = maxStock ?? Infinity;
  if (min === 0 && max === Infinity) return 15; // unknown range, neutral
  if (quantity >= min && quantity <= max) return 25;
  if (quantity === 0) return 0; // critical stockout
  if (quantity < min) {
    const ratio = quantity / min;
    return Math.round(ratio * 20);
  }
  // overstock
  if (max === Infinity) return 20;
  const overRatio = (quantity - max) / max;
  if (overRatio > 1) return 0; // severe overstock (2x max)
  return Math.round(25 - overRatio * 25);
}

function calcDemandAlignmentScore(quantity: number, totalDemand7d: number): number {
  if (totalDemand7d === 0) return quantity === 0 ? 15 : 20; // no demand data
  const daysOfSupply = quantity / (totalDemand7d / 7) ;
  // ideal: 7–14 days
  if (daysOfSupply >= 7 && daysOfSupply <= 14) return 25;
  if (daysOfSupply < 7) {
    return Math.round((daysOfSupply / 7) * 25);
  }
  // over 14 days
  if (daysOfSupply > 30) return 0;
  return Math.round(25 - ((daysOfSupply - 14) / 16) * 25);
}

function calcVolatilityScore(salesValues: number[]): number {
  if (salesValues.length < 2) return 15; // not enough data
  const mean = salesValues.reduce((a, b) => a + b, 0) / salesValues.length;
  if (mean === 0) return 15;
  const variance = salesValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / salesValues.length;
  const std = Math.sqrt(variance);
  const cv = (std / mean) * 100;
  if (cv <= 10) return 25;
  if (cv >= 50) return 0;
  return Math.round(25 - ((cv - 10) / 40) * 25);
}

function calcTrendScore(last7Avg: number, prior7Avg: number, quantity: number, minStock: number | null, maxStock: number | null): number {
  const min = minStock ?? 0;
  const max = maxStock ?? Infinity;
  if (prior7Avg === 0 && last7Avg === 0) return 15;
  const trendRatio = prior7Avg === 0 ? 1.5 : last7Avg / prior7Avg;

  // Growing demand
  if (trendRatio > 1.1) {
    if (quantity < min) return 5; // growing demand + low stock = bad
    if (quantity >= min) return 25;
    return 15;
  }
  // Declining demand
  if (trendRatio < 0.9) {
    if (max !== Infinity && quantity > max) return 5; // declining + overstock = bad
    if (quantity <= (max === Infinity ? quantity : max)) return 20;
    return 10;
  }
  // Stable
  if (quantity >= min && (max === Infinity || quantity <= max)) return 25;
  return 18;
}

function getGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();
    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    // 1. Store profile
    const { data: store } = await supabase
      .from("profiles")
      .select("city, state")
      .eq("id", userId)
      .single();
    const city = store?.city || "Pune";

    // 2. Inventory
    const { data: inventory } = await supabase
      .from("inventory")
      .select("product_name, category, quantity, unit, price, min_stock, max_stock")
      .eq("store_id", userId);

    if (!inventory?.length) {
      return Response.json({
        products: [],
        overallScore: 0,
        categoryScores: [],
        distribution: { A: 0, B: 0, C: 0, D: 0, F: 0 },
        factorAverages: { stockLevel: 0, demandAlignment: 0, volatility: 0, trend: 0 },
      });
    }

    // 3. Products table
    const { data: products } = await supabase
      .from("products")
      .select("product_id, product_name, category");

    const productIdMap: Record<string, number> = {};
    products?.forEach((p: any) => {
      productIdMap[p.product_name.toLowerCase()] = p.product_id;
    });

    // 4. Demand forecasts (next 7 days, store_id = 1)
    const today = new Date().toISOString().split("T")[0];
    const next7 = new Date();
    next7.setDate(next7.getDate() + 7);
    const { data: forecasts } = await supabase
      .from("demand_forecast")
      .select("product_id, predicted_units_sold")
      .eq("store_id", 1)
      .gte("date", today)
      .lte("date", next7.toISOString().split("T")[0]);

    // Aggregate forecast by product_id
    const forecastByProductId: Record<number, number> = {};
    forecasts?.forEach((f: any) => {
      forecastByProductId[f.product_id] = (forecastByProductId[f.product_id] || 0) + f.predicted_units_sold;
    });

    // 5. Historic sales (last 14 days)
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { data: historicSales } = await supabase
      .from("historic_sales")
      .select("date, product_name, quantity_sold")
      .eq("city", city)
      .gte("date", twoWeeksAgo.toISOString().split("T")[0])
      .order("date", { ascending: true });

    // Group historic by product name, split into last 7 and prior 7
    const oneWeekAgoStr = oneWeekAgo.toISOString().split("T")[0];
    const historicByProduct: Record<string, { last7: number[]; prior7: number[] }> = {};
    historicSales?.forEach((s: any) => {
      const key = s.product_name?.toLowerCase() || "";
      if (!historicByProduct[key]) historicByProduct[key] = { last7: [], prior7: [] };
      if (s.date >= oneWeekAgoStr) {
        historicByProduct[key].last7.push(s.quantity_sold || 0);
      } else {
        historicByProduct[key].prior7.push(s.quantity_sold || 0);
      }
    });

    // 6. Calculate health scores for each inventory item
    const productResults: any[] = [];
    let totalStockLevel = 0, totalDemandAlign = 0, totalVolatility = 0, totalTrend = 0;
    const categoryMap: Record<string, { scores: number[]; count: number }> = {};

    for (const item of inventory) {
      const nameLower = item.product_name.toLowerCase();
      const pid = productIdMap[nameLower];
      const totalDemand7d = pid ? (forecastByProductId[pid] || 0) : 0;

      const hist = historicByProduct[nameLower] || { last7: [], prior7: [] };
      const allSales = [...hist.prior7, ...hist.last7];

      const last7Avg = hist.last7.length > 0 ? hist.last7.reduce((a, b) => a + b, 0) / hist.last7.length : 0;
      const prior7Avg = hist.prior7.length > 0 ? hist.prior7.reduce((a, b) => a + b, 0) / hist.prior7.length : 0;

      const stockScore = calcStockLevelScore(item.quantity, item.min_stock, item.max_stock);
      const demandScore = calcDemandAlignmentScore(item.quantity, totalDemand7d);
      const volatilityScore = calcVolatilityScore(allSales);
      const trendScore = calcTrendScore(last7Avg, prior7Avg, item.quantity, item.min_stock, item.max_stock);

      const healthScore = Math.round(((stockScore + demandScore + volatilityScore + trendScore) / 100) * 100);
      const grade = getGrade(healthScore);

      totalStockLevel += stockScore;
      totalDemandAlign += demandScore;
      totalVolatility += volatilityScore;
      totalTrend += trendScore;

      const cat = item.category || "Other";
      if (!categoryMap[cat]) categoryMap[cat] = { scores: [], count: 0 };
      categoryMap[cat].scores.push(healthScore);
      categoryMap[cat].count++;

      productResults.push({
        productName: item.product_name,
        category: cat,
        quantity: item.quantity,
        healthScore,
        stockLevel: stockScore,
        demandAlignment: demandScore,
        volatility: volatilityScore,
        trend: trendScore,
        grade,
      });
    }

    const n = inventory.length;
    const overallScore = Math.round(productResults.reduce((sum, p) => sum + p.healthScore, 0) / n);

    const categoryScores = Object.entries(categoryMap).map(([category, data]) => ({
      category,
      score: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.count),
      count: data.count,
    })).sort((a, b) => b.score - a.score);

    const distribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    productResults.forEach(p => {
      distribution[p.grade as keyof typeof distribution]++;
    });

    // Sort by health score ascending (worst first)
    productResults.sort((a, b) => a.healthScore - b.healthScore);

    return Response.json({
      products: productResults,
      overallScore,
      categoryScores,
      distribution,
      factorAverages: {
        stockLevel: Math.round((totalStockLevel / n) * 10) / 10,
        demandAlignment: Math.round((totalDemandAlign / n) * 10) / 10,
        volatility: Math.round((totalVolatility / n) * 10) / 10,
        trend: Math.round((totalTrend / n) * 10) / 10,
      },
    });
  } catch (err: any) {
    console.error("inventory-health error:", err);
    return Response.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
