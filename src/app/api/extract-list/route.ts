import Groq from "groq-sdk";

const GROQ_KEYS = [
  process.env.GROQ_API_KEY!,
  process.env.GROQ_API_KEY_2!,
  process.env.GROQ_API_KEY_3!,
].filter(Boolean);

const PARSE_INSTRUCTIONS = `Parse into a purchase list. For each product:
- Clean the name (fix OCR/spelling: "Amui Buttr"="Amul Butter", "Tata Sait"="Tata Salt")
- Detect quantity, unit, price if mentioned
- If price not mentioned, estimate realistic Indian MRP
- Auto-assign category: Groceries/Dairy/Beverages/Snacks/Ice Cream/Personal Care/Household/Masala & Spices/Oils/Biscuits/Chocolates/Instant Food/Health
- Auto-detect brand from product name

Return ONLY raw JSON:
{"products":[{"name":"Product","brand":"Brand","category":"Cat","quantity":10,"unit":"pcs","price":0,"originalText":"raw"}],"totalItems":0,"unrecognized":[]}`;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const textInput = formData.get("text") as string | null;

    let rawText = textInput || "";
    let isImage = false;
    let imageBase64 = "";

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());

      if (file.type === "application/pdf") {
        const pdfModule = await import("pdf-parse");
        const pdfParse = (pdfModule as any).default || pdfModule;
        const pdfData = await pdfParse(buffer);
        rawText = pdfData.text;
      } else if (file.type.startsWith("image/")) {
        isImage = true;
        imageBase64 = `data:${file.type};base64,${buffer.toString("base64")}`;
      } else if (file.type === "text/plain") {
        rawText = buffer.toString("utf-8");
      } else {
        return Response.json({ error: "Unsupported file type. Use PDF, image (JPG/PNG), or text." }, { status: 400 });
      }
    }

    if (!rawText.trim() && !isImage) {
      return Response.json({ error: "No text provided." }, { status: 400 });
    }

    let completion: any = null;

    for (let i = 0; i < GROQ_KEYS.length; i++) {
      try {
        const groq = new Groq({ apiKey: GROQ_KEYS[i] });

        if (isImage) {
          // Use llama-4-scout for image OCR (supports vision)
          completion = await groq.chat.completions.create({
            messages: [{
              role: "user",
              content: [
                { type: "text", text: `Read ALL text from this shopkeeper's purchase list image (may be handwritten). Extract every product, quantity, and price you can see. ${PARSE_INSTRUCTIONS}` },
                { type: "image_url", image_url: { url: imageBase64 } },
              ],
            }],
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            temperature: 0.2,
            max_tokens: 2000,
          });
        } else {
          // Text/PDF — use fast versatile model
          completion = await groq.chat.completions.create({
            messages: [{
              role: "user",
              content: `Extract products from this text:\n"""\n${rawText.slice(0, 3000)}\n"""\n\n${PARSE_INSTRUCTIONS}`,
            }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.2,
            max_tokens: 2000,
          });
        }
        break;
      } catch (e: any) {
        console.log(`Extract key ${i + 1} failed:`, e.message?.slice(0, 100));
        if (i === GROQ_KEYS.length - 1) throw e;
      }
    }

    const content = completion.choices[0]?.message?.content || "";
    let parsed;
    try {
      const match = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : content);
    } catch {
      return Response.json({ error: "Could not parse products", rawText: content.slice(0, 500) }, { status: 500 });
    }

    return Response.json({ ...parsed, rawText: isImage ? "(image)" : rawText.slice(0, 500) });
  } catch (err: any) {
    console.error("Extract error:", err.message);
    return Response.json({ error: err.message || "Extraction failed" }, { status: 500 });
  }
}
