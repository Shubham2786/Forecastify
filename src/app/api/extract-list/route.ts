import Groq from "groq-sdk";

const GROQ_KEYS = [
  process.env.GROQ_API_KEY!,
  process.env.GROQ_API_KEY_2!,
  process.env.GROQ_API_KEY_3!,
].filter(Boolean);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const textInput = formData.get("text") as string | null;

    let rawText = textInput || "";

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());

      if (file.type === "application/pdf") {
        // PDF extraction
        const pdfModule = await import("pdf-parse");
        const pdfParse = (pdfModule as any).default || pdfModule;
        const pdfData = await pdfParse(buffer);
        rawText = pdfData.text;
      } else if (file.type.startsWith("image/")) {
        // OCR for images (handwritten/photo)
        const Tesseract = await import("tesseract.js");
        const worker = await Tesseract.createWorker("eng+hin");
        const { data } = await worker.recognize(buffer);
        rawText = data.text;
        await worker.terminate();
      } else if (file.type === "text/plain") {
        rawText = buffer.toString("utf-8");
      } else {
        return Response.json({ error: "Unsupported file type. Use PDF, image (JPG/PNG), or text file." }, { status: 400 });
      }
    }

    if (!rawText.trim()) {
      return Response.json({ error: "No text could be extracted. Please try again." }, { status: 400 });
    }

    // Use Groq to parse the raw text into structured product list
    const prompt = `Extract a product purchase list from this raw text. This might be handwritten OCR output, messy PDF text, or typed notes from a shopkeeper.

RAW TEXT:
"""
${rawText.slice(0, 3000)}
"""

Parse this into a structured JSON array. For each product found:
- Clean the product name (fix OCR errors, capitalize properly)
- Detect the quantity and unit if mentioned
- Detect brand if mentioned
- Auto-assign category (Groceries/Dairy/Beverages/Snacks/Ice Cream/Personal Care/Household/Masala & Spices/Oils/Biscuits/Chocolates/Instant Food/Health)

Return ONLY raw JSON:
{
  "products": [
    {
      "name": "Clean Product Name",
      "brand": "Brand or null",
      "category": "Auto Category",
      "quantity": 10,
      "unit": "kg/pcs/L/packets/bottles",
      "originalText": "what was written in the raw text"
    }
  ],
  "totalItems": 0,
  "unrecognized": ["any text that couldn't be parsed as a product"]
}

Be smart about OCR errors. "Amui Buttr" = "Amul Butter". "Tata Sait" = "Tata Salt". "Maggl" = "Maggi". Parse quantities like "5kg", "10 pcs", "2 dozen" etc.`;

    let completion: any = null;
    for (let i = 0; i < GROQ_KEYS.length; i++) {
      try {
        const groq = new Groq({ apiKey: GROQ_KEYS[i] });
        completion = await groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "llama-3.3-70b-versatile",
          temperature: 0.2,
          max_tokens: 2000,
        });
        break;
      } catch (e: any) {
        if (i === GROQ_KEYS.length - 1) throw e;
      }
    }

    const content = completion.choices[0]?.message?.content || "";
    let parsed;
    try {
      const match = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : content);
    } catch {
      return Response.json({ error: "Could not parse products from text", rawText: rawText.slice(0, 500) }, { status: 500 });
    }

    return Response.json({ ...parsed, rawText: rawText.slice(0, 1000) });
  } catch (err: any) {
    console.error("Extract error:", err.message);
    return Response.json({ error: err.message || "Extraction failed" }, { status: 500 });
  }
}
