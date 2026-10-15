import { NextRequest, NextResponse } from 'next/server';

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
  source: 'usda' | 'openfoodfacts' | 'custom';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');
  const barcode = searchParams.get('barcode');

  try {
    // 1. Direct Barcode Lookup via Open Food Facts API (Live, No key required)
    if (barcode) {
      const offRes = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`, {
        headers: { 'User-Agent': 'HumanAudit - HealthOS - MobileApp' }
      });
      if (offRes.ok) {
        const data = await offRes.json();
        if (data.status === 1 && data.product) {
          const p = data.product;
          const nutriments = p.nutriments || {};
          const servingGrams = parseFloat(p.serving_quantity) || 100;
          const factor = servingGrams / 100;

          const item: FoodItem = {
            id: `off_${p.code || barcode}`,
            name: p.product_name || p.generic_name || 'Branded Food',
            brand: p.brands || p.brand_owner || 'Unknown Brand',
            servingSize: p.serving_size || `${servingGrams}g`,
            servingGrams,
            calories: Math.round(nutriments['energy-kcal_serving'] || (nutriments['energy-kcal_100g'] || 0) * factor),
            proteinG: Math.round(nutriments['proteins_serving'] || (nutriments['proteins_100g'] || 0) * factor),
            carbsG: Math.round(nutriments['carbohydrates_serving'] || (nutriments['carbohydrates_100g'] || 0) * factor),
            fatG: Math.round(nutriments['fat_serving'] || (nutriments['fat_100g'] || 0) * factor),
            fiberG: Math.round(nutriments['fiber_serving'] || (nutriments['fiber_100g'] || 0) * factor),
            source: 'openfoodfacts',
          };
          return NextResponse.json({ results: [item] });
        }
      }
      return NextResponse.json({ results: [] });
    }

    if (!query) {
      return NextResponse.json({ results: [] });
    }

    const results: FoodItem[] = [];

    // 2. Query Live USDA FoodData Central (FDC) API
    // Uses USDA_API_KEY from env or default 'DEMO_KEY'
    const usdaApiKey = process.env.USDA_API_KEY || 'DEMO_KEY';
    try {
      const usdaRes = await fetch(
        `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${usdaApiKey}&query=${encodeURIComponent(query)}&dataType=Foundation,SR%20Legacy&pageSize=6`,
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (usdaRes.ok) {
        const usdaData = await usdaRes.json();
        if (usdaData.foods && Array.isArray(usdaData.foods)) {
          for (const f of usdaData.foods) {
            const nutrients = f.foodNutrients || [];
            const getNutrient = (id: number) => {
              const n = nutrients.find((item: any) => item.nutrientId === id || item.nutrientNumber === String(id));
              return n ? Math.round(n.value) : 0;
            };

            // Nutrient IDs in FDC:
            // 1008 = Energy (kcal), 1003 = Protein (g), 1005 = Carbs (g), 1004 = Total Fat (g), 1079 = Fiber (g)
            const calories = getNutrient(1008);
            const proteinG = getNutrient(1003);
            const carbsG = getNutrient(1005);
            const fatG = getNutrient(1004);
            const fiberG = getNutrient(1079);

            if (calories > 0 || proteinG > 0 || carbsG > 0) {
              results.push({
                id: `usda_${f.fdcId}`,
                name: f.description,
                brand: 'USDA Whole Food',
                servingSize: '100g',
                servingGrams: 100,
                calories,
                proteinG,
                carbsG,
                fatG,
                fiberG,
                source: 'usda',
              });
            }
          }
        }
      }
    } catch {
      // Fallback to local curated whole foods below
    }

    // 3. Query Open Food Facts for branded packaged items
    try {
      const offSearchUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=8`;
      const offRes = await fetch(offSearchUrl, {
        headers: { 'User-Agent': 'HumanAudit - HealthOS - MobileApp' }
      });
      if (offRes.ok) {
        const data = await offRes.json();
        if (data.products && Array.isArray(data.products)) {
          for (const p of data.products.slice(0, 8)) {
            const nutriments = p.nutriments || {};
            const servingGrams = parseFloat(p.serving_quantity) || 100;
            const factor = servingGrams / 100;
            const cals = Math.round(nutriments['energy-kcal_serving'] || (nutriments['energy-kcal_100g'] || 0) * factor);
            if (cals > 0 || nutriments['proteins_100g'] !== undefined) {
              results.push({
                id: `off_${p.code || Math.random().toString(36).substring(7)}`,
                name: p.product_name || 'Branded Food Item',
                brand: p.brands || 'Branded',
                servingSize: p.serving_size || `${servingGrams}g`,
                servingGrams,
                calories: cals,
                proteinG: Math.round(nutriments['proteins_serving'] || (nutriments['proteins_100g'] || 0) * factor),
                carbsG: Math.round(nutriments['carbohydrates_serving'] || (nutriments['carbohydrates_100g'] || 0) * factor),
                fatG: Math.round(nutriments['fat_serving'] || (nutriments['fat_100g'] || 0) * factor),
                fiberG: Math.round(nutriments['fiber_serving'] || (nutriments['fiber_100g'] || 0) * factor),
                source: 'openfoodfacts',
              });
            }
          }
        }
      }
    } catch {
      // Offline fallback
    }

    // 4. Curated Whole Foods Fallback Dictionary
    if (results.length === 0) {
      const genericWholeFoods: FoodItem[] = [
        { id: 'usda_1', name: 'Chicken Breast, Grilled (Boneless, Skinless)', servingSize: '100g', servingGrams: 100, calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6, source: 'usda' },
        { id: 'usda_2', name: 'Eggs, Whole Large', servingSize: '1 large (50g)', servingGrams: 50, calories: 72, proteinG: 6.3, carbsG: 0.4, fatG: 4.8, source: 'usda' },
        { id: 'usda_3', name: 'Egg Whites, Liquid', servingSize: '100g', servingGrams: 100, calories: 52, proteinG: 11, carbsG: 0.7, fatG: 0.2, source: 'usda' },
        { id: 'usda_4', name: 'White Rice, Cooked Jasmine', servingSize: '1 cup (158g)', servingGrams: 158, calories: 205, proteinG: 4.2, carbsG: 45, fatG: 0.4, source: 'usda' },
        { id: 'usda_5', name: 'Brown Rice, Cooked', servingSize: '1 cup (195g)', servingGrams: 195, calories: 218, proteinG: 4.5, carbsG: 46, fatG: 1.6, source: 'usda' },
        { id: 'usda_6', name: 'Avocado, Raw Hass', servingSize: '1/2 medium (100g)', servingGrams: 100, calories: 160, proteinG: 2, carbsG: 8.5, fatG: 14.7, fiberG: 6.7, source: 'usda' },
        { id: 'usda_7', name: 'Oatmeal, Rolled Oats (Dry)', servingSize: '1/2 cup (40g)', servingGrams: 40, calories: 150, proteinG: 5, carbsG: 27, fatG: 2.5, fiberG: 4, source: 'usda' },
        { id: 'usda_8', name: 'Banana, Fresh Medium', servingSize: '1 medium (118g)', servingGrams: 118, calories: 105, proteinG: 1.3, carbsG: 27, fatG: 0.3, fiberG: 3.1, source: 'usda' },
        { id: 'usda_9', name: 'Whey Protein Isolate Powder', servingSize: '1 scoop (30g)', servingGrams: 30, calories: 120, proteinG: 25, carbsG: 2, fatG: 1, source: 'usda' },
        { id: 'usda_10', name: 'Greek Yogurt, 0% Nonfat Plain', servingSize: '170g', servingGrams: 170, calories: 100, proteinG: 18, carbsG: 6, fatG: 0, source: 'usda' },
        { id: 'usda_11', name: 'Salmon Fillet, Wild Atlantic Baked', servingSize: '100g', servingGrams: 100, calories: 208, proteinG: 22, carbsG: 0, fatG: 13, source: 'usda' },
        { id: 'usda_12', name: 'Ribeye Steak, Lean Trimmed Grilled', servingSize: '100g', servingGrams: 100, calories: 250, proteinG: 26, carbsG: 0, fatG: 16, source: 'usda' },
        { id: 'usda_13', name: 'Almonds, Raw Whole', servingSize: '1 oz (28g)', servingGrams: 28, calories: 164, proteinG: 6, carbsG: 6, fatG: 14, fiberG: 3.5, source: 'usda' },
        { id: 'usda_14', name: 'Sweet Potato, Baked with Skin', servingSize: '1 medium (114g)', servingGrams: 114, calories: 103, proteinG: 2.3, carbsG: 24, fatG: 0.2, fiberG: 3.8, source: 'usda' },
        { id: 'usda_15', name: 'Broccoli, Steamed', servingSize: '1 cup (156g)', servingGrams: 156, calories: 55, proteinG: 3.7, carbsG: 11, fatG: 0.6, fiberG: 5.1, source: 'usda' },
      ];
      const qLower = query.toLowerCase();
      const matchedGeneric = genericWholeFoods.filter(f => f.name.toLowerCase().includes(qLower));
      results.push(...matchedGeneric);
    }

    return NextResponse.json({ results });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message || 'Search failed' }, { status: 500 });
  }
}
