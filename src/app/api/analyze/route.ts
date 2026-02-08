import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const image = form.get("image") as File | null;
    const portion = (form.get("portion") as string | null) ?? "";
    const name = (form.get("name") as string | null) ?? "";

    if (!image) {
      return new Response(JSON.stringify({ error: "No image uploaded" }), { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), { status: 500 });
    }

    const bytes = Buffer.from(await image.arrayBuffer());
    const b64 = bytes.toString("base64");
    const mime = image.type || "image/jpeg";

    const prompt = `
You are a nutrition assistant. Identify foods in the image and estimate calories + macros.
User name: ${name || "N/A"}
Portion/weight info from user: ${portion || "Not provided (give ranges and assumptions)"}

Return STRICT JSON only (no extra text, no markdown formatting), format:
{
  "items":[
    {"name":"...","estimated_grams":0,"kcal":0,"protein_g":0,"carb_g":0,"fat_g":0,"confidence":"low|medium|high","notes":"..."}
  ],
  "total":{"kcal":0,"protein_g":0,"carb_g":0,"fat_g":0},
  "assumptions":["..."]
}
Rules:
- If portion is unclear, give reasonable ranges and explain in assumptions.
- Use typical nutrition averages (do not invent package labels).
- Keep numbers realistic.
`;

    const resp = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: `data:${mime};base64,${b64}` },
          ],
        },
      ],
    });

    const text = resp.output_text;

    // The model sometimes wraps JSON in markdown fences (```json ... ```).
    // Extract the first JSON object we can find.
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const maybeJson = start !== -1 && end !== -1 && end > start ? text.slice(start, end + 1) : text;

    let data: any;
    try {
      data = JSON.parse(maybeJson);
    } catch {
      // Return the raw text to help debugging on the client.
      return new Response(
        JSON.stringify({
          error: "Model did not return valid JSON",
          raw: text,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), { status: 500 });
  }
}