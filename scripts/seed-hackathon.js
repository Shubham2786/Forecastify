const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  "https://zktyotwkhfywizuooyjl.supabase.co",
  "sb_publishable_FrZrETinJJ6ePVFbkdukNQ_mRYj2uHX"
);

function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function randF(a, b) { return Math.round((Math.random() * (b - a) + a) * 100) / 100; }

const PRODUCTS = [
  { name: "Amul Taza Milk 500ml", category: "Dairy", sub: "Milk", brand: "Amul", mrp: 30, shelf: 3, lead: 1 },
  { name: "Amul Butter 100g", category: "Dairy", sub: "Butter", brand: "Amul", mrp: 56, shelf: 30, lead: 2 },
  { name: "Amul Cheese Slice", category: "Dairy", sub: "Cheese", brand: "Amul", mrp: 30, shelf: 30, lead: 2 },
  { name: "Curd (Amul Masti Dahi 400g)", category: "Dairy", sub: "Curd", brand: "Amul", mrp: 30, shelf: 5, lead: 1 },
  { name: "Bisleri Water 1L", category: "Beverages", sub: "Water", brand: "Bisleri", mrp: 20, shelf: 180, lead: 2 },
  { name: "Coca Cola 500ml", category: "Beverages", sub: "Soft Drinks", brand: "Coca Cola", mrp: 40, shelf: 120, lead: 2 },
  { name: "Thums Up 750ml", category: "Beverages", sub: "Soft Drinks", brand: "Thums Up", mrp: 40, shelf: 120, lead: 2 },
  { name: "Frooti 200ml", category: "Beverages", sub: "Juice", brand: "Parle Agro", mrp: 10, shelf: 90, lead: 2 },
  { name: "Maaza 600ml", category: "Beverages", sub: "Juice", brand: "Coca Cola", mrp: 35, shelf: 90, lead: 2 },
  { name: "Real Fruit Power Mango 1L", category: "Beverages", sub: "Juice", brand: "Dabur", mrp: 99, shelf: 120, lead: 3 },
  { name: "Tata Tea Gold 250g", category: "Beverages", sub: "Tea", brand: "Tata", mrp: 120, shelf: 365, lead: 3 },
  { name: "Lays Classic 30g", category: "Snacks", sub: "Chips", brand: "Lays", mrp: 10, shelf: 60, lead: 2 },
  { name: "Balaji Wafers", category: "Snacks", sub: "Chips", brand: "Balaji", mrp: 10, shelf: 60, lead: 2 },
  { name: "Kurkure Masala Munch", category: "Snacks", sub: "Namkeen", brand: "Kurkure", mrp: 10, shelf: 60, lead: 2 },
  { name: "Haldiram Aloo Bhujia 200g", category: "Snacks", sub: "Namkeen", brand: "Haldiram", mrp: 55, shelf: 90, lead: 3 },
  { name: "Parle G Biscuit", category: "Biscuits", sub: "Glucose", brand: "Parle", mrp: 10, shelf: 180, lead: 2 },
  { name: "Britannia Good Day Butter Cookies", category: "Biscuits", sub: "Cookies", brand: "Britannia", mrp: 30, shelf: 120, lead: 2 },
  { name: "Maggi 2-Min Noodles", category: "Instant Food", sub: "Noodles", brand: "Nestle", mrp: 14, shelf: 180, lead: 2 },
  { name: "Tata Salt 1kg", category: "Groceries", sub: "Salt", brand: "Tata", mrp: 28, shelf: 730, lead: 3 },
  { name: "Fortune Sunflower Oil 1L", category: "Oils", sub: "Cooking Oil", brand: "Fortune", mrp: 180, shelf: 365, lead: 3 },
  { name: "Aashirvaad Atta 5kg", category: "Groceries", sub: "Flour", brand: "Aashirvaad", mrp: 280, shelf: 180, lead: 3 },
  { name: "Sugar 1kg", category: "Groceries", sub: "Sugar", brand: "Local", mrp: 45, shelf: 365, lead: 2 },
  { name: "Toor Dal 1kg", category: "Groceries", sub: "Pulses", brand: "Local", mrp: 160, shelf: 180, lead: 3 },
  { name: "Cadbury Dairy Milk Silk", category: "Chocolates", sub: "Chocolate Bar", brand: "Cadbury", mrp: 80, shelf: 180, lead: 2 },
  { name: "Colgate MaxFresh 80g", category: "Personal Care", sub: "Toothpaste", brand: "Colgate", mrp: 50, shelf: 730, lead: 3 },
  { name: "Dettol Soap 75g", category: "Personal Care", sub: "Soap", brand: "Dettol", mrp: 35, shelf: 730, lead: 3 },
  { name: "Surf Excel Easy Wash 1kg", category: "Household", sub: "Detergent", brand: "Surf Excel", mrp: 120, shelf: 365, lead: 3 },
  { name: "Vim Bar", category: "Household", sub: "Dishwash", brand: "Vim", mrp: 10, shelf: 365, lead: 2 },
  { name: "Amul Ice Cream 500ml", category: "Ice Cream", sub: "Cup", brand: "Amul", mrp: 120, shelf: 90, lead: 1 },
  { name: "Kwality Walls Cornetto Cone", category: "Ice Cream", sub: "Cone", brand: "Kwality Walls", mrp: 40, shelf: 90, lead: 1 },
];

const STORES = [
  { name: "Kirana Dukan", city: "Pune", state: "Maharashtra", type: "Kirana", sqft: 400 },
  { name: "SuperMart Express", city: "Mumbai", state: "Maharashtra", type: "Supermarket", sqft: 1200 },
  { name: "Delhi Fresh Store", city: "Delhi", state: "Delhi", type: "Kirana", sqft: 350 },
  { name: "Bangalore Bazaar", city: "Bangalore", state: "Karnataka", type: "Supermarket", sqft: 800 },
  { name: "Chennai Corner Shop", city: "Chennai", state: "Tamil Nadu", type: "Kirana", sqft: 300 },
];

const PROMO_TYPES = ["Discount", "BOGO", "Bundle", "Clearance", "Festival Special"];
const CAMPAIGNS = ["Summer Sale", "Diwali Dhamaka", "Holi Offers", "Weekend Special", "Independence Day", "New Year Bash", "Eid Mubarak", "IPL Mania"];
const SIGNAL_TYPES = ["weather_change", "competitor_price_drop", "social_media_trend", "supply_disruption", "festival_rush", "promotion_launch"];

async function insertBatch(table, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + 500));
    if (error) console.error(`${table} batch ${i}:`, error.message);
    else process.stdout.write(`  ${table}: ${Math.min(i + 500, rows.length)}/${rows.length}\r`);
  }
  console.log(`  ${table}: ${rows.length} rows done`);
}

(async () => {
  console.log("=== Seeding Hackathon Tables ===\n");

  // 1. Products
  console.log("1. Products...");
  const productRows = PRODUCTS.map(p => ({
    product_name: p.name, category: p.category, subcategory: p.sub,
    brand: p.brand, mrp: p.mrp, shelf_life_days: p.shelf, lead_time_days: p.lead,
  }));
  await insertBatch("products", productRows);

  // 2. Stores
  console.log("2. Stores...");
  const storeRows = STORES.map(s => ({
    store_name: s.name, city: s.city, state: s.state,
    store_type: s.type, store_size_sqft: s.sqft,
  }));
  await insertBatch("stores", storeRows);

  // 3. Promotions (last 90 days, ~300 promos)
  console.log("3. Promotions...");
  const promoRows = [];
  const today = new Date();
  for (let d = 90; d >= 0; d--) {
    const date = new Date(today); date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split("T")[0];
    // 3-4 promos per day across stores
    for (let j = 0; j < rand(2, 5); j++) {
      promoRows.push({
        date: dateStr,
        store_id: rand(1, 5),
        product_id: rand(1, 30),
        promo_type: PROMO_TYPES[rand(0, PROMO_TYPES.length - 1)],
        discount_pct: [5, 10, 15, 20, 25, 30][rand(0, 5)],
        display_flag: rand(0, 1) === 1,
        campaign_name: CAMPAIGNS[rand(0, CAMPAIGNS.length - 1)],
      });
    }
  }
  await insertBatch("promotions", promoRows);

  // 4. Demand Forecast (next 7 days for all products × store 1)
  console.log("4. Demand Forecast...");
  const forecastRows = [];
  for (let d = 0; d < 7; d++) {
    const date = new Date(today); date.setDate(date.getDate() + d);
    const dateStr = date.toISOString().split("T")[0];
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    for (let pid = 1; pid <= 30; pid++) {
      const base = [8, 5, 3, 6, 15, 8, 7, 12, 6, 4, 3, 10, 8, 7, 5, 12, 6, 6, 4, 3, 2, 4, 3, 4, 3, 3, 2, 3, 6, 8][pid - 1] || 5;
      const predicted = Math.round(base * (isWeekend ? 1.25 : 1) * (0.85 + Math.random() * 0.3));
      forecastRows.push({
        date: dateStr, store_id: 1, product_id: pid,
        predicted_units_sold: predicted,
        recommended_inventory_level: Math.round(predicted * 1.3),
        confidence: randF(0.7, 0.92),
      });
    }
  }
  await insertBatch("demand_forecast", forecastRows);

  // 5. Realtime Signals (last 24 hours)
  console.log("5. Realtime Signals...");
  const signalRows = [];
  for (let h = 24; h >= 0; h--) {
    const ts = new Date(today); ts.setHours(ts.getHours() - h);
    if (rand(1, 3) === 1) { // ~33% chance per hour
      signalRows.push({
        timestamp: ts.toISOString(),
        store_id: 1,
        product_id: rand(1, 30),
        signal_type: SIGNAL_TYPES[rand(0, SIGNAL_TYPES.length - 1)],
        signal_strength: randF(0.3, 1.0),
        notes: [
          "Temperature spike detected — cold drink demand expected to rise",
          "Competitor dropped price on similar product by 15%",
          "Trending on social media — expect demand surge",
          "Supplier delay reported — stock may run low",
          "Festival rush starting — increase inventory",
          "New promotion launched — monitor demand closely",
        ][rand(0, 5)],
      });
    }
  }
  await insertBatch("realtime_signals", signalRows);

  // 6. Test Input (next 7 days × 10 products for store 1)
  console.log("6. Test Input...");
  const testRows = [];
  for (let d = 0; d < 7; d++) {
    const date = new Date(today); date.setDate(date.getDate() + d);
    for (const pid of [1, 5, 6, 12, 13, 18, 19, 24, 29, 30]) {
      testRows.push({ date: date.toISOString().split("T")[0], store_id: 1, product_id: pid });
    }
  }
  await insertBatch("test_input", testRows);

  // Verify
  for (const t of ["products", "stores", "promotions", "demand_forecast", "realtime_signals", "test_input"]) {
    const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
    console.log(`  ${t}: ${count} rows`);
  }
  console.log("\n=== Done ===");
})();
