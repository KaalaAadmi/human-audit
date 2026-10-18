import { api } from '../lib/api';

export interface FoodLogItem {
  id: string;
  name: string;
  brand?: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  servingSize: string;
  servingGrams: number;
  servingsCount: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  source: 'usda' | 'openfoodfacts' | 'barcode' | 'voice' | 'photo' | 'custom';
  loggedAt: string;
}

export interface SearchFoodResult {
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

// All methods throw on network/server failure (callers show the error); there is no canned offline data.
const toResult = (prefix: string) => (item: any, idx: number): SearchFoodResult => ({
  id: `${prefix}_${Date.now()}_${idx}`,
  name: item.name,
  servingSize: item.servingSize,
  servingGrams: item.servingGrams || 100,
  calories: item.calories,
  proteinG: item.proteinG,
  carbsG: item.carbsG,
  fatG: item.fatG,
  source: 'custom',
});

export const NutritionService = {
  /** Open Food Facts first, USDA fallback (decided server-side; `fallback` is true when USDA answered). */
  async searchFoods(query: string): Promise<{ results: SearchFoodResult[]; fallback: boolean }> {
    const data = await api(`/api/nutrition/search?q=${encodeURIComponent(query)}`);
    return { results: data.results ?? [], fallback: !!data.fallback };
  },

  async lookupBarcode(barcode: string): Promise<SearchFoodResult | null> {
    const data = await api(`/api/nutrition/search?barcode=${encodeURIComponent(barcode)}`);
    return data.results?.[0] ?? null;
  },

  async parseVoice(transcript: string): Promise<SearchFoodResult[]> {
    const data = await api('/api/ai/voice-parse', { method: 'POST', body: { transcript }, timeoutMs: 40000 });
    return (data.items ?? []).map(toResult('voice'));
  },

  async analyzePhoto(base64Jpeg: string): Promise<{ mealName: string; items: SearchFoodResult[] }> {
    const data = await api('/api/ai/photo-meal', { method: 'POST', body: { image: base64Jpeg }, timeoutMs: 40000 });
    return { mealName: data.mealName || 'Detected meal', items: (data.items ?? []).map(toResult('photo')) };
  },
};
