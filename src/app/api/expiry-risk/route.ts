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

    // 1. Get inventory items with expiry_date for this store
    const { data: inventory, error: invError } = await supabase
      .from("inventory")
      .select("*")
      .eq("store_id", userId);

    if (invError) throw invError;

    // 2. Get demand forecasts for next 7 days (store_id = 1)
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const next7 = new Date();
    next7.setDate(next7.getDate() + 7);
    const next7Str = next7.toISOString().split("T")[0];

    const { data: forecasts } = await supabase
      .from("demand_forecast")
      .select("product_id, predicted_units_sold, date")
      .eq("store_id", 1)
      .gte("date", todayStr)
      .lte("date", next7Str);

    // 3. Get products table for product info mapping
    const { data: products } = await supabase
      .from("products")
      .select("product_id, product_name, category, subcategory, brand, mrp");

    // Build product maps
    const productByName: Record<string, any> = {};
    const productById: Record<number, any> = {};
    products?.forEach((p) => {
      productByName[p.product_name.toLowerCase()] = p;
      productById[p.product_id] = p;
    });

    // Aggregate forecast: total predicted_units_sold per product over 7 days
    const forecastByProductName: Record<string, number> = {};
    forecasts?.forEach((f) => {
      const prod = productById[f.product_id];
      if (prod) {
        const name = prod.product_name.toLowerCase();
        forecastByProductName[name] = (forecastByProductName[name] || 0) + f.predicted_units_sold;
      }
    });

    // 4. Process each inventory item with expiry_date
    const riskProducts: any[] = [];

    inventory?.forEach((item) => {
      if (!item.expiry_date) return;

      const expiryDate = new Date(item.expiry_date);
      const diffMs = expiryDate.getTime() - today.getTime();
      const daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // Skip already expired items with negative days (still include for reporting)
      const effectiveDays = Math.max(daysUntilExpiry, 0);

      // Match product to demand forecast using product name
      const productNameLower = (item.product_name || "").toLowerCase();
      const totalForecast7Days = forecastByProductName[productNameLower] || 0;
      const dailyDemand = totalForecast7Days / 7;

      // Calculate units that can be sold before expiry
      const unitsSelledBeforeExpiry = Math.round(dailyDemand * effectiveDays * 100) / 100;

      // Calculate waste
      const quantity = item.current_stock || 0;
      const wasteUnits = Math.max(0, quantity - unitsSelledBeforeExpiry);
      const wastePercentage = quantity > 0 ? Math.round((wasteUnits / quantity) * 100 * 10) / 10 : 0;

      // Classify risk level
      let riskLevel: string;
      if (daysUntilExpiry < 3) riskLevel = "critical";
      else if (daysUntilExpiry < 7) riskLevel = "high";
      else if (daysUntilExpiry < 14) riskLevel = "medium";
      else riskLevel = "low";

      // Suggested markdown discount
      let suggestedMarkdown = 0;
      if (wastePercentage > 30) {
        // Scale discount based on waste percentage and urgency
        if (daysUntilExpiry <= 1) suggestedMarkdown = 50;
        else if (daysUntilExpiry <= 3) suggestedMarkdown = 40;
        else if (daysUntilExpiry <= 7) suggestedMarkdown = 30;
        else if (daysUntilExpiry <= 14) suggestedMarkdown = 20;
        else suggestedMarkdown = 10;
        // Increase discount if waste is very high
        if (wastePercentage > 70) suggestedMarkdown += 15;
        else if (wastePercentage > 50) suggestedMarkdown += 10;
        suggestedMarkdown = Math.min(suggestedMarkdown, 70);
      }

      // Potential loss
      const price = item.price || 0;
      const potentialLoss = Math.round(wasteUnits * price * 100) / 100;

      // Get category from products table or inventory
      const matchedProduct = productByName[productNameLower];
      const category = item.category || matchedProduct?.category || "Unknown";

      riskProducts.push({
        productName: item.product_name,
        category,
        quantity,
        expiryDate: item.expiry_date,
        daysUntilExpiry,
        dailyDemand: Math.round(dailyDemand * 100) / 100,
        unitsSelledBeforeExpiry: Math.round(unitsSelledBeforeExpiry),
        wasteUnits: Math.round(wasteUnits),
        wastePercentage,
        riskLevel,
        suggestedMarkdown,
        potentialLoss,
        price,
      });
    });

    // Sort by risk: critical first, then high, medium, low; within same risk by daysUntilExpiry
    const riskOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    riskProducts.sort((a, b) => {
      const orderDiff = (riskOrder[a.riskLevel] ?? 4) - (riskOrder[b.riskLevel] ?? 4);
      if (orderDiff !== 0) return orderDiff;
      return a.daysUntilExpiry - b.daysUntilExpiry;
    });

    // Summary stats
    const totalAtRisk = riskProducts.filter((p) => p.wasteUnits > 0).length;
    const totalPotentialLoss = Math.round(riskProducts.reduce((s, p) => s + p.potentialLoss, 0));
    const avgWastePercent =
      riskProducts.length > 0
        ? Math.round(riskProducts.reduce((s, p) => s + p.wastePercentage, 0) / riskProducts.length * 10) / 10
        : 0;
    const expiringThisWeek = riskProducts.filter((p) => p.daysUntilExpiry <= 7 && p.daysUntilExpiry >= 0).length;

    // Potential savings with markdowns
    const markdownProducts = riskProducts.filter((p) => p.suggestedMarkdown > 0);
    const potentialSavings = Math.round(
      markdownProducts.reduce((s, p) => {
        // Assume markdown clears 60% more stock
        const additionalSales = Math.min(p.wasteUnits * 0.6, p.wasteUnits);
        return s + additionalSales * p.price * (1 - p.suggestedMarkdown / 100);
      }, 0)
    );

    return Response.json({
      products: riskProducts,
      summary: {
        totalAtRisk,
        totalPotentialLoss,
        avgWastePercent,
        expiringThisWeek,
        potentialSavings,
        totalProducts: riskProducts.length,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Expiry risk error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
