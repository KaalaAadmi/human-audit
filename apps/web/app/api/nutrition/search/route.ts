import { NextResponse } from 'next/server';
import { query as sql } from '../../../../lib/db';
import { withAuth } from '../../../../lib/route';

interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  servingSize: string;
  servingGrams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  source: 'openfoodfacts' | 'usda' | 'custom';
}

const UA = { 'User-Agent': 'HumanAudit/1.0 (dev@humanaudit.app)' };
const FIELDS = 'code,product_name,brands,serving_size,serving_quantity,nutriments';
const r1 = (n: number) => Math.round(n * 10) / 10;
const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : Number(v) || 0);

// Open Food Facts product (search hit or barcode lookup) -> per-serving FoodItem. Null if no calorie data.
function fromOff(p: any): FoodItem | null {
  const n = p?.nutriments ?? {};
  const kcal100 = num(n['energy-kcal_100g']) || (n['energy_100g'] ? num(n['energy_100g']) / 4.184 : 0);
  if (!p?.code || !p.product_name || !kcal100) return null;
  const grams = num(p.serving_quantity) || 100;
  const f = grams / 100;
  const per = (k: string) => r1(num(n[`${k}_100g`]) * f);
  return {
    id: `off_${p.code}`,
    name: p.product_name,
    brand: Array.isArray(p.brands) ? p.brands.join(', ') : p.brands || undefined,
    servingSize: p.serving_size || `${grams}g`,
    servingGrams: grams,
    calories: Math.round(kcal100 * f),
    proteinG: per('proteins'),
    carbsG: per('carbohydrates'),
    fatG: per('fat'),
    fiberG: per('fiber'),
    sugarG: per('sugars'),
    source: 'openfoodfacts',
  };
}

// Primary: Open Food Facts via Search-a-licious (the legacy cgi/search.pl and /api/v2/search endpoints are unreliable).
async function searchOff(q: string): Promise<FoodItem[]> {
  const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=24&langs=en&fields=${FIELDS}`;
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`OFF search ${res.status}`);
  const data = await res.json();
  return (data.hits ?? []).map(fromOff).filter((x: FoodItem | null): x is FoodItem => !!x).slice(0, 12);
}

// Fallback: USDA FoodData Central. Values are per 100 g.
async function searchUsda(q: string): Promise<FoodItem[]> {
  const key = process.env.USDA_API_KEY || 'DEMO_KEY';
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${key}&query=${encodeURIComponent(q)}&dataType=Foundation,SR%20Legacy&pageSize=12`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`USDA ${res.status}`);
  const data = await res.json();
  const out: FoodItem[] = [];
  for (const f of data.foods ?? []) {
    const get = (...ids: number[]) => {
      const n = (f.foodNutrients ?? []).find((x: any) => ids.includes(x.nutrientId) || ids.map(String).includes(String(x.nutrientNumber)));
      return n ? Math.max(0, r1(num(n.value))) : 0;
    };
    const calories = Math.round(get(1008, 2047, 2048));
    if (!calories) continue;
    out.push({
      id: `usda_${f.fdcId}`,
      name: f.description,
      brand: 'USDA',
      servingSize: '100g',
      servingGrams: 100,
      calories,
      proteinG: get(1003),
      carbsG: get(1005),
      fatG: get(1004),
      fiberG: get(1079),
      source: 'usda',
    });
  }
  return out;
}

export const GET = withAuth(async (req, userId) => {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q')?.trim();
  const barcode = searchParams.get('barcode')?.trim();

  if (barcode) {
    if (!/^\d{6,14}$/.test(barcode)) return NextResponse.json({ error: 'Invalid barcode' }, { status: 400 });
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${FIELDS}`, {
      headers: UA,
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    if (!res || res.status >= 500) return NextResponse.json({ error: 'Open Food Facts unavailable' }, { status: 502 });
    const data = res.ok ? await res.json() : null;
    const item = data?.status === 1 ? fromOff(data.product) : null;
    return NextResponse.json({ results: item ? [item] : [], source: 'openfoodfacts' });
  }

  if (!query) return NextResponse.json({ results: [] });

  // Foods added by any user are searchable (name only, no author); the caller's own lead.
  // Wrapped in try/catch: if the custom_foods table doesn't exist yet (migrations pending) we degrade
  // gracefully rather than returning a 500 for the whole search.
  let mine: FoodItem[] = [];
  try {
    mine = (
      await sql(`SELECT * FROM custom_foods f WHERE name ILIKE $2
         AND (user_id = $1 OR (NOT hidden AND NOT EXISTS (SELECT 1 FROM content_reports c WHERE c.user_id = $1 AND c.kind = 'food' AND c.item_id = f.id)))
         ORDER BY user_id = $1 DESC, name LIMIT 8`, [userId, `%${query.replace(/[%_\\]/g, '\\$&')}%`])
    ).map((r: any) => ({
      id: r.id, name: r.name, brand: r.brand ?? undefined, servingSize: `${Number(r.serving_size_g)}g`, servingGrams: Number(r.serving_size_g),
      calories: r.calories, proteinG: Number(r.protein_g), carbsG: Number(r.carbs_g), fatG: Number(r.fats_g), source: 'custom' as const,
    }));
  } catch (e) {
    console.warn('[CUSTOM_FOODS_SEARCH]', e);
  }

  let offErr = false;
  let results: FoodItem[] = [];
  try {
    results = await searchOff(query);
  } catch (e) {
    offErr = true;
    console.warn('[OFF_SEARCH]', e);
  }
  if (results.length > 0) return NextResponse.json({ results: [...mine, ...results], source: 'openfoodfacts' });

  try {
    results = await searchUsda(query);
  } catch (e) {
    console.warn('[USDA_SEARCH]', e);
    if (offErr) return NextResponse.json({ error: 'Food databases unavailable' }, { status: 502 });
  }
  return NextResponse.json({ results: [...mine, ...results], source: 'usda', fallback: true });
});
