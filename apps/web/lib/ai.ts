// Shared AI plumbing for the photo-meal and voice-parse routes: prompts, provider call, output validation.
// Provider order: OpenAI, then Gemini. A key shorter than 20 chars is treated as an unset placeholder.

const real = (k?: string) => (k && k.length >= 20 ? k : null);

export class AiUnavailable extends Error {}

const SCHEMA = `{
  "mealName": string,          // short descriptive title
  "items": [{
    "name": string,            // specific food, e.g. "Grilled chicken breast", not "meat"
    "servingSize": string,     // human portion, e.g. "1 cup (158g)" or "2 large eggs"
    "servingGrams": number,    // grams (use ml for liquids) for the WHOLE portion in servingSize
    "calories": number,        // kcal for the whole portion
    "proteinG": number,        // grams for the whole portion
    "carbsG": number,
    "fatG": number,
    "confidence": number       // 0-1, your certainty in the identification and portion
  }]
}`;

const RULES = `Rules:
- Every nutrient value is for the entire portion in servingSize, not per 100g.
- Use standard reference values (USDA-style). Account for cooking method and added oil/sauce when visible or stated.
- Calories must roughly equal 4*protein + 4*carbs + 9*fat (within ~15%).
- Never invent items that were not shown or said. If a quantity is missing, assume one typical serving and lower confidence.
- If the input contains no food, return {"mealName": "", "items": []}.
- Output ONLY JSON in exactly this shape:
${SCHEMA}`;

export const PHOTO_PROMPT = `You are a sports-nutrition analyst. Identify every distinct food and drink in the photo, estimate each portion's weight from visual cues (plate/utensil size, depth, density), and report nutrition for it.\n${RULES}`;
export const VOICE_PROMPT = `You are a sports-nutrition analyst. The user describes what they ate or drank. Split it into distinct foods and report nutrition for each, honouring any quantities they state (e.g. "3 eggs", "200g chicken", "a scoop of whey").\n${RULES}`;

export interface AiItem {
  name: string; servingSize: string; servingGrams: number;
  calories: number; proteinG: number; carbsG: number; fatG: number; confidence: number;
}

const n = (v: unknown, max: number) => (typeof v === 'number' && isFinite(v) && v >= 0 && v <= max ? v : null);

/** Parses model output, drops malformed items. Throws on unusable output. */
export function validate(raw: string): { mealName: string; items: AiItem[] } {
  const j = JSON.parse(raw);
  const items: AiItem[] = [];
  for (const i of Array.isArray(j?.items) ? j.items : []) {
    const calories = n(i.calories, 5000), proteinG = n(i.proteinG, 500), carbsG = n(i.carbsG, 1000), fatG = n(i.fatG, 500);
    if (!i.name || typeof i.name !== 'string' || calories === null || proteinG === null || carbsG === null || fatG === null) continue;
    items.push({
      name: i.name.slice(0, 120),
      servingSize: typeof i.servingSize === 'string' ? i.servingSize.slice(0, 60) : '1 serving',
      servingGrams: n(i.servingGrams, 5000) || 100,
      calories: Math.round(calories), proteinG, carbsG, fatG,
      confidence: n(i.confidence, 1) ?? 0.5,
    });
  }
  return { mealName: typeof j?.mealName === 'string' ? j.mealName.slice(0, 120) : '', items };
}

/** Runs a JSON-returning prompt. `image` is a base64 JPEG (optionally a data: URL). Throws AiUnavailable when no key is configured. */
export async function askJson(system: string, text: string, image?: string): Promise<string> {
  const openai = real(process.env.OPENAI_API_KEY);
  const gemini = real(process.env.GEMINI_API_KEY);
  if (!openai && !gemini) throw new AiUnavailable('AI is not configured (set OPENAI_API_KEY or GEMINI_API_KEY)');
  const b64 = image?.replace(/^data:image\/\w+;base64,/, '');

  if (openai) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openai}` },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: image ? 'gpt-4o' : 'gpt-4o-mini',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: b64 ? [{ type: 'text', text }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }] : text },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    return (await res.json()).choices[0].message.content;
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gemini}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text }, ...(b64 ? [{ inline_data: { mime_type: 'image/jpeg', data: b64 } }] : [])] }],
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  return (await res.json()).candidates[0].content.parts[0].text;
}

/** askJson + validate, mapped to an HTTP response: 503 not configured, 502 provider/bad output. */
export async function runAi(system: string, text: string, image?: string): Promise<Response> {
  try {
    const out = validate(await askJson(system, text, image));
    return Response.json(out);
  } catch (e) {
    if (e instanceof AiUnavailable) return Response.json({ error: e.message }, { status: 503 });
    console.error('[AI]', e);
    return Response.json({ error: 'AI analysis failed, try again' }, { status: 502 });
  }
}
