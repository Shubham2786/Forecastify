import Groq from "groq-sdk";

const GROQ_KEYS = [
  process.env.GROQ_API_KEY!,
  process.env.GROQ_API_KEY_2!,
  process.env.GROQ_API_KEY_3!,
].filter(Boolean);

function getGroqClient(idx: number) {
  return new Groq({ apiKey: GROQ_KEYS[idx] });
}

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
        // Use Groq vision instead of slow Tesseract OCR
        isImage = true;
        imageBase64 = `data:${file.type};base64,${buffer.toString("base64")}`;
      } else if (file.type === "text/plain") {
        rawText = buffer.toString("utf-8");
      } else {
        return Response.json({ error: "Unsupported file type. Use PDF, image (JPG/PNG), or text file." }, { status: 400 });
      }
    }

    if (!rawText.trim() && !isImage) {
      return Response.json({ error: "No text provided." }, { status: 400 });
    }

    // Build the prompt
    const jsonFormat = `{
  "products": [
    {"name":"Clean Product Name","brand":"Brand or null","category":"Auto","quantity":10,"unit":"pcs","price":0,"originalText":"raw text"}
  ],
  "totalItems": 0,
  "unrecognized": []
}`;

    const parseInstructions = `Parse into a purchase list. For each product:
- Clean the name (fix OCR/spelling errors: "Amui Buttr"="Amul Butter", "Tata Sait"="Tata Salt")
- Detect quantity, unit, price if mentioned
- If price not mentioned, estimate realistic Indian MRP
- Auto-assign category: Groceries/Dairy/Beverages/Snacks/Ice Cream/Personal Care/Household/Masala & Spices/Oils/Biscuits/Chocolates/Instant Food/Health
- Auto-detect brand from product name

Return ONLY raw JSON:\n${jsonFormat}`;

    let completion: any = null;

    for (let i = 0; i < GROQ_KEYS.length; i++) {
      try {
        const groq = getGroqClient(i);

        if (isImage) {
          // Vision model for image OCR — much faster than Tesseract
          completion = await groq.chat.completions.create({
            messages: [{
              role: "user",
              content: [
                { type: "text", text: `This is a photo of a shopkeeper's purchase/product list (possibly handwritten). Read ALL text from it and ${parseInstructions}` },
                { type: "image_url", image_url: { url: imageBase64 } },
              ],
            }],
            model: "llama-3.2-90b-vision-preview",
            temperature: 0.2,
            max_tokens: 2000,
          });
        } else {
          completion = await groq.chat.completions.create({
            messages: [{
              role: "user",
              content: `Extract products from this text:\n"""\n${rawText.slice(0, 3000)}\n"""\n\n${parseInstructions}`,
            }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.2,
            max_tokens: 2000,
          });
        }
        break;
      } catch (e: any) {
        console.log(`Extract key ${i + 1} failed:`, e.message);
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
