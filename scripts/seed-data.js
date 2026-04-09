const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://zktyotwkhfywizuooyjl.supabase.co",
  "sb_publishable_FrZrETinJJ6ePVFbkdukNQ_mRYj2uHX"
);

// ---- PRODUCTS with realistic daily sales ranges per season ----
const PRODUCTS = [
  // Beverages
  { name: "Bisleri Water 1L", category: "Beverages", price: 20, summer: [10,20], monsoon: [4,8], winter: [3,6] },
  { name: "Coca Cola 500ml", category: "Beverages", price: 40, summer: [8,18], monsoon: [3,7], winter: [2,5] },
  { name: "Pepsi 500ml", category: "Beverages", price: 40, summer: [6,14], monsoon: [2,6], winter: [2,4] },
  { name: "Frooti 200ml", category: "Beverages", price: 10, summer: [12,25], monsoon: [4,8], winter: [2,5] },
  { name: "Limca 500ml", category: "Beverages", price: 40, summer: [5,12], monsoon: [2,5], winter: [1,3] },
  { name: "Thums Up 500ml", category: "Beverages", price: 40, summer: [7,15], monsoon: [3,6], winter: [2,4] },
  { name: "Lassi 200ml", category: "Beverages", price: 15, summer: [8,15], monsoon: [3,6], winter: [2,4] },
  // Ice Cream
  { name: "Amul Ice Cream 500ml", category: "Ice Cream", price: 120, summer: [4,10], monsoon: [1,3], winter: [0,1] },
  { name: "Kwality Walls Cone", category: "Ice Cream", price: 30, summer: [6,15], monsoon: [1,4], winter: [0,2] },
  { name: "Cornetto", category: "Ice Cream", price: 40, summer: [5,12], monsoon: [1,3], winter: [0,2] },
  // Snacks
  { name: "Lays Classic 30g", category: "Snacks", price: 10, summer: [8,15], monsoon: [6,12], winter: [5,10] },
  { name: "Balaji Wafers", category: "Snacks", price: 10, summer: [8,15], monsoon: [6,12], winter: [5,10] },
  { name: "Kurkure Masala", category: "Snacks", price: 10, summer: [6,12], monsoon: [5,10], winter: [5,10] },
  { name: "Parle G Biscuit", category: "Snacks", price: 10, summer: [10,18], monsoon: [8,15], winter: [8,14] },
  { name: "Maggi Noodles", category: "Snacks", price: 14, summer: [4,8], monsoon: [8,15], winter: [6,12] },
  // Dairy
  { name: "Amul Butter 100g", category: "Dairy", price: 56, summer: [3,6], monsoon: [3,6], winter: [4,8] },
  { name: "Amul Milk 500ml", category: "Dairy", price: 30, summer: [10,18], monsoon: [8,14], winter: [10,16] },
  { name: "Amul Cheese Slice", category: "Dairy", price: 30, summer: [2,4], monsoon: [2,4], winter: [2,5] },
  { name: "Dahi 400g", category: "Dairy", price: 30, summer: [5,10], monsoon: [3,6], winter: [3,5] },
  // Groceries
  { name: "Tata Salt 1kg", category: "Groceries", price: 28, summer: [3,6], monsoon: [3,6], winter: [3,6] },
  { name: "Fortune Oil 1L", category: "Groceries", price: 180, summer: [2,4], monsoon: [2,4], winter: [2,5] },
  { name: "Aashirvaad Atta 5kg", category: "Groceries", price: 280, summer: [1,3], monsoon: [1,3], winter: [2,4] },
  { name: "Toor Dal 1kg", category: "Groceries", price: 160, summer: [1,3], monsoon: [2,4], winter: [2,4] },
  { name: "Sugar 1kg", category: "Groceries", price: 45, summer: [2,5], monsoon: [2,4], winter: [3,6] },
  // Personal Care
  { name: "Dove Soap 100g", category: "Personal Care", price: 55, summer: [2,4], monsoon: [2,4], winter: [1,3] },
  { name: "Colgate 100g", category: "Personal Care", price: 50, summer: [2,4], monsoon: [2,4], winter: [2,4] },
  { name: "Dettol Handwash", category: "Personal Care", price: 60, summer: [1,3], monsoon: [2,5], winter: [1,3] },
  // Household
  { name: "Surf Excel 1kg", category: "Household", price: 120, summer: [1,3], monsoon: [1,3], winter: [1,3] },
  { name: "Vim Bar", category: "Household", price: 10, summer: [2,4], monsoon: [2,4], winter: [2,4] },
  // Health
  { name: "Eno Sachet", category: "Health", price: 10, summer: [2,4], monsoon: [1,2], winter: [1,2] },
  { name: "ORS Powder", category: "Health", price: 15, summer: [3,6], monsoon: [1,2], winter: [0,1] },
];

// ---- CITIES ----
const CITIES = [
  { city: "Pune", state: "Maharashtra", region: "West", summerTemp: [32,42], monsoonTemp: [24,30], winterTemp: [12,25] },
  { city: "Mumbai", state: "Maharashtra", region: "West", summerTemp: [30,38], monsoonTemp: [25,32], winterTemp: [18,28] },
  { city: "Delhi", state: "Delhi", region: "North", summerTemp: [35,46], monsoonTemp: [28,35], winterTemp: [5,20] },
  { city: "Bangalore", state: "Karnataka", region: "South", summerTemp: [28,38], monsoonTemp: [20,28], winterTemp: [15,26] },
  { city: "Chennai", state: "Tamil Nadu", region: "South", summerTemp: [32,42], monsoonTemp: [26,32], winterTemp: [22,30] },
  { city: "Kolkata", state: "West Bengal", region: "East", summerTemp: [30,40], monsoonTemp: [26,34], winterTemp: [12,24] },
  { city: "Jaipur", state: "Rajasthan", region: "North", summerTemp: [35,46], monsoonTemp: [28,36], winterTemp: [8,22] },
  { city: "Hyderabad", state: "Telangana", region: "South", summerTemp: [32,42], monsoonTemp: [24,30], winterTemp: [16,28] },
  { city: "Ahmedabad", state: "Gujarat", region: "West", summerTemp: [34,44], monsoonTemp: [26,34], winterTemp: [12,26] },
  { city: "Lucknow", state: "Uttar Pradesh", region: "North", summerTemp: [34,44], monsoonTemp: [28,34], winterTemp: [8,22] },
];

// ---- FESTIVALS / EVENTS ----
const FESTIVALS = [
  { name: "Diwali", month: 10, day: 20, duration: 5, impact: 60, cats: ["Snacks","Beverages","Dairy","Groceries"], national: true },
  { name: "Holi", month: 3, day: 14, duration: 2, impact: 40, cats: ["Beverages","Snacks","Dairy"], national: true },
  { name: "Ganesh Chaturthi", month: 9, day: 7, duration: 10, impact: 50, cats: ["Snacks","Dairy","Groceries","Beverages"], national: false, region: "West" },
  { name: "Navratri", month: 10, day: 3, duration: 9, impact: 35, cats: ["Groceries","Dairy","Snacks"], national: true },
  { name: "Christmas", month: 12, day: 25, duration: 3, impact: 30, cats: ["Snacks","Beverages","Ice Cream"], national: true },
  { name: "New Year", month: 1, day: 1, duration: 2, impact: 45, cats: ["Beverages","Snacks","Ice Cream"], national: true },
  { name: "Independence Day", month: 8, day: 15, duration: 1, impact: 20, cats: ["Snacks","Beverages"], national: true },
  { name: "Republic Day", month: 1, day: 26, duration: 1, impact: 15, cats: ["Snacks","Beverages"], national: true },
  { name: "Eid ul-Fitr", month: 4, day: 10, duration: 3, impact: 40, cats: ["Snacks","Beverages","Dairy","Groceries"], national: true },
  { name: "Raksha Bandhan", month: 8, day: 19, duration: 1, impact: 30, cats: ["Snacks","Dairy"], national: true },
  { name: "Makar Sankranti", month: 1, day: 14, duration: 2, impact: 25, cats: ["Snacks","Groceries","Dairy"], national: true },
  { name: "Pongal", month: 1, day: 15, duration: 3, impact: 30, cats: ["Groceries","Dairy","Snacks"], national: false, region: "South" },
  { name: "Onam", month: 9, day: 15, duration: 5, impact: 35, cats: ["Groceries","Dairy","Snacks","Beverages"], national: false, region: "South" },
  { name: "IPL Season Start", month: 3, day: 22, duration: 60, impact: 25, cats: ["Snacks","Beverages"], national: true },
  { name: "IPL Final", month: 5, day: 26, duration: 1, impact: 50, cats: ["Snacks","Beverages"], national: true },
  { name: "World Cup Cricket", month: 10, day: 5, duration: 45, impact: 30, cats: ["Snacks","Beverages"], national: true },
  { name: "Summer Vacation Start", month: 5, day: 1, duration: 45, impact: 20, cats: ["Ice Cream","Beverages","Snacks"], national: true },
  { name: "Back to School", month: 6, day: 15, duration: 7, impact: -10, cats: ["Snacks","Beverages"], national: true },
  { name: "Durga Puja", month: 10, day: 10, duration: 5, impact: 45, cats: ["Snacks","Dairy","Groceries"], national: false, region: "East" },
  { name: "Chhath Puja", month: 11, day: 7, duration: 3, impact: 30, cats: ["Groceries","Dairy"], national: false, region: "East" },
];

// ---- HELPERS ----
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max) { return Math.round((Math.random() * (max - min) + min) * 10) / 10; }

function getSeason(month) {
  if (month >= 3 && month <= 5) return "summer";
  if (month >= 6 && month <= 9) return "monsoon";
  return "winter";
}

function getWeatherCondition(season, temp) {
  if (season === "monsoon") return rand(1,10) <= 6 ? "Rain" : rand(1,10) <= 3 ? "Heavy Rain" : "Cloudy";
  if (season === "summer") return temp > 40 ? "Extreme Heat" : temp > 35 ? "Clear" : "Partly Cloudy";
  return temp < 10 ? "Fog" : temp < 18 ? "Cold" : "Clear";
}

function isFestivalDay(date, festivals, city) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  for (const f of festivals) {
    if (f.month === m && d >= f.day && d < f.day + f.duration) {
      if (f.national || f.region === city.region) return f;
    }
  }
  return null;
}

async function insertBatch(table, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase.from(table).insert(batch);
    if (error) console.error(`Error inserting ${table} batch ${i}:`, error.message);
    else process.stdout.write(`  ${table}: ${Math.min(i+500, rows.length)}/${rows.length}\r`);
  }
  console.log(`  ${table}: ${rows.length} rows inserted.`);
}

// ---- MAIN ----
(async () => {
  console.log("=== Seeding Forecastify Database ===\n");

  // 1. Generate regional events (2025-2026)
  console.log("1. Inserting regional events...");
  const eventRows = [];
  for (const year of [2025, 2026]) {
    for (const f of FESTIVALS) {
      const startDate = `${year}-${String(f.month).padStart(2,"0")}-${String(f.day).padStart(2,"0")}`;
      const endDate = new Date(year, f.month - 1, f.day + f.duration - 1);
      eventRows.push({
        event_name: f.name,
        event_type: f.name.includes("IPL") || f.name.includes("World Cup") || f.name.includes("Cricket") ? "Sports" :
                    f.name.includes("Vacation") || f.name.includes("School") ? "Season" : "Festival",
        region: f.region || "All India",
        city: null,
        state: null,
        start_date: startDate,
        end_date: endDate.toISOString().split("T")[0],
        demand_impact_percent: f.impact,
        affected_categories: f.cats,
        description: `${f.name} — expected ${f.impact}% demand change for ${f.cats.join(", ")}`,
        is_national: f.national,
      });
    }
  }
  await insertBatch("regional_events", eventRows);

  // 2. Generate weather history (last 365 days for all cities)
  console.log("\n2. Inserting weather history...");
  const weatherRows = [];
  const today = new Date();
  for (const c of CITIES) {
    for (let i = 365; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const season = getSeason(d.getMonth() + 1);
      const tempRange = c[season + "Temp"];
      const avgTemp = randFloat(tempRange[0], tempRange[1]);
      const maxTemp = avgTemp + randFloat(2, 6);
      const minTemp = avgTemp - randFloat(2, 6);
      const humidity = season === "monsoon" ? rand(65, 95) : season === "summer" ? rand(15, 45) : rand(30, 60);
      const weatherCond = getWeatherCondition(season, avgTemp);
      const rainfall = weatherCond.includes("Rain") ? randFloat(2, 50) : 0;

      weatherRows.push({
        city: c.city, state: c.state, date: d.toISOString().split("T")[0],
        avg_temp: avgTemp, max_temp: maxTemp, min_temp: minTemp,
        humidity, weather_condition: weatherCond, rainfall_mm: rainfall,
      });
    }
  }
  await insertBatch("weather_history", weatherRows);

  // 3. Generate historic sales (1000+ entries across products/cities/dates)
  console.log("\n3. Inserting historic sales data...");
  const salesRows = [];
  const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  // Generate 90 days of sales for each product in 3 cities = ~8400 entries
  const targetCities = CITIES.slice(0, 4); // Pune, Mumbai, Delhi, Bangalore
  for (const c of targetCities) {
    for (const p of PRODUCTS) {
      for (let i = 90; i >= 1; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const season = getSeason(d.getMonth() + 1);
        const dayOfWeek = dayNames[d.getDay()];
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const isFriday = d.getDay() === 5;

        // Base sales from seasonal range
        const range = p[season];
        let sales = rand(range[0], range[1]);

        // Weekend boost
        if (isWeekend) sales = Math.round(sales * (1 + rand(15, 30) / 100));
        if (isFriday) sales = Math.round(sales * 1.1);

        // Temperature effect
        const tempRange = c[season + "Temp"];
        const temp = randFloat(tempRange[0], tempRange[1]);
        const humidity = season === "monsoon" ? rand(65, 95) : season === "summer" ? rand(15, 45) : rand(30, 60);
        const weatherCond = getWeatherCondition(season, temp);

        if (temp > 38 && ["Beverages", "Ice Cream"].includes(p.category)) {
          sales = Math.round(sales * (1 + rand(25, 50) / 100));
        }
        if (temp > 42 && p.category === "Ice Cream") {
          sales = Math.round(sales * 1.5);
        }
        if (temp < 15 && p.category === "Ice Cream") {
          sales = Math.max(0, Math.round(sales * 0.3));
        }
        if (weatherCond.includes("Rain")) {
          sales = Math.round(sales * 0.75); // rain reduces footfall
          if (p.name === "Maggi Noodles") sales = Math.round(sales * 1.6); // but Maggi sells in rain
        }

        // Festival boost
        const festival = isFestivalDay(d, FESTIVALS, c);
        if (festival && festival.cats.includes(p.category)) {
          sales = Math.round(sales * (1 + festival.impact / 100));
        }

        // Ensure non-negative
        sales = Math.max(0, sales);

        salesRows.push({
          product_name: p.name,
          category: p.category,
          region: c.region,
          city: c.city,
          state: c.state,
          date: d.toISOString().split("T")[0],
          day_of_week: dayOfWeek,
          quantity_sold: sales,
          price: p.price,
          temperature: temp,
          weather_condition: weatherCond,
          humidity,
          is_weekend: isWeekend,
          is_festival: !!festival,
          festival_name: festival?.name || null,
          is_promotion: rand(1, 20) === 1, // 5% chance of promotion
          store_type: "Kirana",
          store_size: rand(1, 3) === 1 ? "Medium" : "Small",
        });
      }
    }
  }

  console.log(`  Total sales rows: ${salesRows.length}`);
  await insertBatch("historic_sales", salesRows);

  // Verify
  const { count: sc } = await supabase.from("historic_sales").select("*", { count: "exact", head: true });
  const { count: ec } = await supabase.from("regional_events").select("*", { count: "exact", head: true });
  const { count: wc } = await supabase.from("weather_history").select("*", { count: "exact", head: true });
  console.log(`\n=== Done ===`);
  console.log(`historic_sales: ${sc} rows`);
  console.log(`regional_events: ${ec} rows`);
  console.log(`weather_history: ${wc} rows`);
})();
