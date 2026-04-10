import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";

const GROQ_KEYS = [
  process.env.GROQ_API_KEY!,
  process.env.GROQ_API_KEY_2!,
  process.env.GROQ_API_KEY_3!,
].filter(Boolean);

function getGroqClient(keyIndex = 0) {
  return new Groq({ apiKey: GROQ_KEYS[keyIndex] });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface InventoryItem {
  id?: string;
  product_name: string;
  category: string;
  current_stock: number;
  unit: string;
  price: number;
  sku?: string | null;
  brand?: string | null;
  supplier?: string | null;
  store_id: string;
}

async function getInventory(storeId: string) {
  const { data, error } = await supabase
    .from("inventory")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  return { data, error };
}

async function searchProduct(storeId: string, query: string) {
  const { data, error } = await supabase
    .from("inventory")
    .select("*")
    .eq("store_id", storeId)
    .or(`product_name.ilike.%${query}%,category.ilike.%${query}%,brand.ilike.%${query}%,sku.ilike.%${query}%`);
  return { data, error };
}

async function addProduct(item: InventoryItem) {
  const { data: existing } = await supabase
    .from("inventory")
    .select("*")
    .eq("store_id", item.store_id)
    .ilike("product_name", `%${item.product_name}%`)
    .limit(1)
    .single();

  if (existing) {
    return { data: existing, error: null, duplicate: true };
  }

  const { data, error } = await supabase
    .from("inventory")
    .insert(item)
    .select()
    .single();
  return { data, error, duplicate: false };
}

async function updateProduct(id: string, updates: Partial<InventoryItem>) {
  const { data, error } = await supabase
    .from("inventory")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  return { data, error };
}

async function deleteProduct(id: string) {
  const { error } = await supabase
    .from("inventory")
    .delete()
    .eq("id", id);
  return { error };
}

async function getStoreProfile(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("store_name, store_category, store_size, city, state, store_address")
    .eq("id", userId)
    .single();
  return data;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, userId, conversationHistory, weather, location, news, lang } = body;
    const langMap: Record<string, string> = { hi: "Hindi (हिन्दी)", mr: "Marathi (मराठी)", ta: "Tamil (தமிழ்)", te: "Telugu (తెలుగు)", kn: "Kannada (ಕನ್ನಡ)", bn: "Bengali (বাংলা)", gu: "Gujarati (ગુજરાતી)" };
    const langInstruction = lang && langMap[lang] ? `\nIMPORTANT: Respond in ${langMap[lang]}. User's preferred language.` : "";

    if (!message || !userId) {
      return Response.json({ error: "message and userId required" }, { status: 400 });
    }

    const store = await getStoreProfile(userId);
    const inventory = await getInventory(userId);

    // Compact inventory: only name|qty|id (saves tokens for faster response)
    const inventoryContext = inventory.data?.length
      ? inventory.data.slice(0, 30).map((i: InventoryItem) =>
          `${i.product_name}|${i.current_stock}${i.unit}|₹${i.price}|${i.id}`
        ).join("; ")
      : "Empty";

    const systemPrompt = `You are JARVIS, Tony Stark's AI. Store: "${store?.store_name || "Store"}" at ${store?.city || ""}. ${weather ? `${weather.temp}°C ${weather.description}` : ""}

RULES: Reply 1-2 sentences MAX. Same language as user. Data goes in <action> tags only, never in spoken text.
Greeting: "Jarvis online, Sir. What would you like me to do?"
Add=name+qty+price needed. Duplicate→say "already exists". sold/reduce/bech diya→REDUCE. hatao→DELETE.

STOCK(${inventory.data?.length || 0}): ${inventoryContext}

ACTIONS in <action>{JSON}</action>:
Inventory: add/reduce/update/delete/search/list
{"type":"add","product_name":"X","category":"Cat","current_stock":10,"unit":"pcs","price":50}
{"type":"reduce","product_name":"X","current_stock":5}
{"type":"update","product_name":"X","updates":{"price":60}}
{"type":"delete","product_name":"X"}
{"type":"search","query":"X"} | {"type":"list"}

FEATURES — use these when user asks for analysis/features:
"analyze X"/"forecast X" → {"type":"product_analysis","product":"X"}
"demand spike"/"trending"/"demand analysis" → {"type":"demand_analysis"}
"category analysis"/"categories" → {"type":"category_analysis","category":"Beverages"} (extract category from user msg, or omit for auto)
"alerts"/"stockout"/"any alerts" → {"type":"alerts"}
"dashboard"/"overview" → {"type":"dashboard"}
"forecasts"/"predictions" → {"type":"forecasts"}
"purchase list"/"shopping list" → {"type":"purchase_list"}
Weather/news data → {"type":"popup","title":"T","content":"<html>"}

For features: say "Running analysis, Sir." + action tag. Don't generate analysis yourself.${langInstruction}`;

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    // Only last 2 messages for speed
    if (conversationHistory?.length) {
      for (const msg of conversationHistory.slice(-2)) {
        messages.push({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        });
      }
    }

    messages.push({ role: "user", content: message });

    let completion: any = null;
    for (let i = 0; i < GROQ_KEYS.length; i++) {
      try {
        const client = getGroqClient(i);
        completion = await client.chat.completions.create({
          messages,
          model: "llama-3.3-70b-versatile",
          temperature: 0.3,
          max_tokens: 300,
        });
        break;
      } catch (e: any) {
        console.log(`Groq key ${i + 1} failed:`, e.message);
        if (i === GROQ_KEYS.length - 1) throw e;
      }
    }

    let response = completion.choices[0]?.message?.content || "I apologize, Sir. Momentary lapse.";

    // Extract and execute actions
    const actionMatch = response.match(/[<\[]action[>\]]([\s\S]*?)[<\[]\/?action[>\]]/gi);
    const actions: { type: string; result: unknown }[] = [];

    if (actionMatch) {
      for (const match of actionMatch) {
        const jsonStr = match.replace(/[<\[]\/?action[>\]]/gi, "").trim();
        try {
          const action = JSON.parse(jsonStr);

          switch (action.type) {
            case "add": {
              const item: InventoryItem = {
                store_id: userId,
                product_name: String(action.product_name || action.name || "Unknown"),
                category: String(action.category || "General"),
                current_stock: parseInt(String(action.current_stock || action.quantity)) || 1,
                unit: String(action.unit || "pcs"),
                price: parseFloat(String(action.price)) || 0,
                brand: action.brand ? String(action.brand) : null,
                sku: action.sku ? String(action.sku) : null,
                supplier: action.supplier ? String(action.supplier) : null,
              };
              const result = await addProduct(item);
              if (result.duplicate) {
                response = `Sir, "${result.data.product_name}" already exists with ${result.data.current_stock} ${result.data.unit} at ₹${result.data.price}. Say "update" to change it.`;
                actions.push({ type: "duplicate", result });
              } else {
                actions.push({ type: "add", result });
              }
              break;
            }
            case "reduce": {
              const { data: found } = await supabase
                .from("inventory").select("*").eq("store_id", userId)
                .ilike("product_name", `%${action.product_name}%`).limit(1).single();
              if (found) {
                const newQty = Math.max(0, found.current_stock - (action.current_stock || action.quantity || 0));
                const result = await updateProduct(found.id, { current_stock: newQty });
                actions.push({ type: "reduce", result: { ...result, previousQty: found.current_stock, newQty } });
              } else {
                actions.push({ type: "reduce", result: { error: "Product not found" } });
              }
              break;
            }
            case "update": {
              let targetId = action.id;
              if (!targetId && action.product_name) {
                const { data: found } = await supabase.from("inventory").select("id").eq("store_id", userId)
                  .ilike("product_name", `%${action.product_name}%`).limit(1).single();
                targetId = found?.id;
              }
              if (targetId) {
                const result = await updateProduct(targetId, action.updates);
                actions.push({ type: "update", result });
              } else {
                actions.push({ type: "update", result: { error: "Product not found" } });
              }
              break;
            }
            case "delete": {
              let delId = action.id;
              if (!delId && action.product_name) {
                const { data: found } = await supabase.from("inventory").select("id").eq("store_id", userId)
                  .ilike("product_name", `%${action.product_name}%`).limit(1).single();
                delId = found?.id;
              }
              if (delId) {
                const result = await deleteProduct(delId);
                actions.push({ type: "delete", result });
              } else {
                actions.push({ type: "delete", result: { error: "Product not found" } });
              }
              break;
            }
            case "search": {
              const result = await searchProduct(userId, action.query);
              actions.push({ type: "search", result });
              break;
            }
            case "list": {
              const result = await getInventory(userId);
              actions.push({ type: "list", result });
              break;
            }
            case "open_url": {
              actions.push({ type: "open_url", result: { url: action.url } });
              break;
            }
            case "popup": {
              actions.push({ type: "popup", result: { title: action.title, content: action.content } });
              break;
            }
            // Feature actions — pass through to frontend to call the actual APIs
            case "product_analysis": {
              actions.push({ type: "product_analysis", result: { product: action.product } });
              break;
            }
            case "demand_analysis": {
              actions.push({ type: "demand_analysis", result: {} });
              break;
            }
            case "category_analysis": {
              actions.push({ type: "category_analysis", result: { category: action.category || "" } });
              break;
            }
            case "alerts": {
              actions.push({ type: "alerts", result: {} });
              break;
            }
            case "dashboard": {
              actions.push({ type: "navigate", result: { path: "/dashboard" } });
              break;
            }
            case "forecasts": {
              actions.push({ type: "navigate", result: { path: "/dashboard/forecasts" } });
              break;
            }
            case "purchase_list": {
              actions.push({ type: "navigate", result: { path: "/dashboard/purchase-list" } });
              break;
            }
          }
        } catch {
          // Skip malformed action
        }
      }

      // Clean action tags from response text
      response = response.replace(/[<\[]action[>\]][\s\S]*?[<\[]\/?action[>\]]/gi, "").trim();
    }

    return Response.json({
      response,
      actions,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    const errMsg = err?.message || err?.error?.message || String(err);
    console.error("Jarvis error:", errMsg, err);

    if (errMsg.includes("rate_limit") || errMsg.includes("429")) {
      return Response.json({
        response: "I'm being rate limited, Sir. Please wait a moment.",
        actions: [],
        timestamp: new Date().toISOString(),
      });
    }

    if (errMsg.includes("401") || errMsg.includes("auth")) {
      return Response.json({
        response: "Authentication issue, Sir. Please check the API key.",
        actions: [],
        timestamp: new Date().toISOString(),
      });
    }

    return Response.json({
      response: `Temporary glitch, Sir. Error: ${errMsg.slice(0, 100)}`,
      actions: [],
      timestamp: new Date().toISOString(),
    });
  }
}
