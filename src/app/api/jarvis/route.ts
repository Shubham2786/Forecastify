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
  quantity: number;
  unit: string;
  price: number;
  sku?: string | null;
  brand?: string | null;
  supplier?: string | null;
  min_stock?: number;
  max_stock?: number;
  expiry_date?: string | null;
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
  // Check if product with same name already exists
  const { data: existing } = await supabase
    .from("inventory")
    .select("*")
    .eq("store_id", item.store_id)
    .ilike("product_name", `%${item.product_name}%`)
    .limit(1)
    .single();

  if (existing) {
    // REJECT — product already exists, don't add duplicate
    return { data: existing, error: null, duplicate: true };
  }

  // New product — insert
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
    const { message, userId, conversationHistory, weather, location, news } = body;

    if (!message || !userId) {
      return Response.json({ error: "message and userId required" }, { status: 400 });
    }

    const store = await getStoreProfile(userId);
    const inventory = await getInventory(userId);

    // Build compact inventory context (only name + qty + id)
    const inventoryContext = inventory.data?.length
      ? inventory.data.map((i: InventoryItem) =>
          `${i.product_name}|${i.category}|${i.quantity}${i.unit}|₹${i.price}|${i.id}`
        ).join("\n")
      : "Empty";

    const systemPrompt = `You are JARVIS, Tony Stark's AI. Store: "${store?.store_name || "Store"}" (${store?.store_category || "Retail"}) at ${store?.city || ""}.
${weather ? `Weather: ${weather.temp}°C ${weather.description}` : ""}

RULES:
- Reply 1-2 sentences MAX. Same language as user.
- Greeting: "Jarvis online, Sir. News, inventory, or trending products?"
- ALL DATA must go in POPUP action. NEVER print tables/lists/product details in your text response.
- Your spoken text = short confirmation only. Data = popup.
- Category/unit: YOU auto-decide. Never ask user.
- Add needs: name, quantity, price. Missing? Ask short.
- NEVER add a product that already exists. If it exists, say "already exists, use update."
- "sold/reduce/kam karo/bech diya" → REDUCE. "add" new product only → ADD. "update price/quantity" → UPDATE. "delete/hatao" → DELETE.

INVENTORY (${inventory.data?.length || 0}):
${inventoryContext}

ACTIONS — wrap in <action>{...}</action>:
ADD new product: <action>{"type":"add","product_name":"X","category":"Auto","quantity":10,"unit":"pcs","price":50}</action>
REDUCE qty: <action>{"type":"reduce","product_name":"X","quantity":5}</action>
UPDATE fields: <action>{"type":"update","product_name":"X","updates":{"price":60,"quantity":100}}</action>
DELETE: <action>{"type":"delete","product_name":"X"}</action>
SEARCH: <action>{"type":"search","query":"X"}</action>
LIST all: <action>{"type":"list"}</action>
OPEN URL: <action>{"type":"open_url","url":"https://..."}</action>
SHOW DATA POPUP: <action>{"type":"popup","title":"Title","content":"<table>...</table>"}</action>

IMPORTANT: When showing weather/news/product info/any data — put it inside a POPUP with proper HTML table. Keep spoken reply to 1 sentence.`;

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add only last 4 messages of history to save tokens
    if (conversationHistory?.length) {
      for (const msg of conversationHistory.slice(-4)) {
        messages.push({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        });
      }
    }

    messages.push({ role: "user", content: message });

    // Try each Groq key until one works
    let completion: any = null;
    for (let i = 0; i < GROQ_KEYS.length; i++) {
      try {
        const client = getGroqClient(i);
        completion = await client.chat.completions.create({
          messages,
          model: "llama-3.3-70b-versatile",
          temperature: 0.5,
          max_tokens: 500,
        });
        break; // success
      } catch (e: any) {
        console.log(`Groq key ${i + 1} failed:`, e.message);
        if (i === GROQ_KEYS.length - 1) throw e; // all keys failed
      }
    }

    let response = completion.choices[0]?.message?.content || "I apologize, Sir. I seem to be experiencing a momentary lapse.";

    // Extract and execute actions — handle <action>, [action], or malformed tags
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
                quantity: parseInt(String(action.quantity)) || 1,
                unit: String(action.unit || "pcs"),
                price: parseFloat(String(action.price)) || 0,
                brand: action.brand ? String(action.brand) : null,
                sku: action.sku ? String(action.sku) : null,
                supplier: action.supplier ? String(action.supplier) : null,
                min_stock: parseInt(String(action.min_stock || 10)),
                max_stock: parseInt(String(action.max_stock || 1000)),
              };
              const result = await addProduct(item);
              if (result.duplicate) {
                // Product exists — tell Jarvis to inform user
                response = `Sir, "${result.data.product_name}" already exists with ${result.data.quantity} ${result.data.unit} at ₹${result.data.price}. Say "update" to change it.`;
                actions.push({ type: "duplicate", result });
              } else {
                actions.push({ type: "add", result });
              }
              break;
            }
            case "reduce": {
              // Reduce quantity of existing product
              const { data: found } = await supabase
                .from("inventory")
                .select("*")
                .eq("store_id", userId)
                .ilike("product_name", `%${action.product_name}%`)
                .limit(1)
                .single();

              if (found) {
                const newQty = Math.max(0, found.quantity - (action.quantity || 0));
                const result = await updateProduct(found.id, { quantity: newQty });
                actions.push({ type: "reduce", result: { ...result, previousQty: found.quantity, newQty } });
              } else {
                actions.push({ type: "reduce", result: { error: "Product not found" } });
              }
              break;
            }
            case "update": {
              // Support both id and product_name lookup
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
              // Support both id and product_name lookup
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
          }
        } catch {
          // Skip malformed action
        }
      }

      // Clean action tags from response text (all variants)
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

    // Groq rate limit
    if (errMsg.includes("rate_limit") || errMsg.includes("429")) {
      return Response.json({
        response: "I'm being rate limited, Sir. Please wait a moment and try again.",
        actions: [],
        timestamp: new Date().toISOString(),
      });
    }

    // Groq API key issue
    if (errMsg.includes("401") || errMsg.includes("auth")) {
      return Response.json({
        response: "Authentication issue with my systems, Sir. Please check the API key.",
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
