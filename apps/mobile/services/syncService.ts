import { api, localDate } from '../lib/api';
import { FoodLogItem, SearchFoodResult } from './nutritionService';
import type { CustomRecipe } from '../components/RecipeBuilderModal';

// The backend identifies the user from the Clerk token, so nothing here takes a user id.
// Failures throw: callers decide whether to retry or surface them (no silent local-only success).

// App-side source names -> the food_logs.source vocabulary in docs/DATABASE_SCHEMA.md.
const SOURCE: Record<FoodLogItem['source'], string> = {
  usda: 'usda',
  openfoodfacts: 'off',
  barcode: 'barcode',
  voice: 'voice',
  photo: 'photo_ai',
  custom: 'custom_food',
};

const SOURCE_BACK = Object.fromEntries(Object.entries(SOURCE).map(([k, v]) => [v, k])) as Record<string, FoodLogItem['source']>;

// food_logs row -> app item. serving_quantity holds the portion's grams, serving_unit the human portion text.
const toFoodLog = (r: any): FoodLogItem => ({
  id: r.id,
  name: r.food_name,
  mealType: r.meal_type,
  servingSize: r.serving_unit,
  servingGrams: Number(r.serving_quantity),
  servingsCount: 1,
  calories: r.calories,
  proteinG: Number(r.protein_g),
  carbsG: Number(r.carbs_g),
  fatG: Number(r.fats_g),
  source: SOURCE_BACK[r.source] ?? 'custom',
  loggedAt: new Date(r.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
});

export interface MacroGoals { calories: number; proteinG: number; carbsG: number; fatG: number }
/** Same defaults as the daily_macro_goals column defaults, used until the user saves a goal for that weekday. */
export const DEFAULT_GOALS: MacroGoals = { calories: 2300, proteinG: 180, carbsG: 220, fatG: 65 };

/** Baseline Mifflin-St Jeor TDEE & macro goals calculated from user profile. */
export function calculateProfileGoals(profile: any): MacroGoals {
  if (!profile) return DEFAULT_GOALS;
  const weight = profile.weight_kg ? parseFloat(profile.weight_kg) : 75;
  const height = profile.height_cm ? parseFloat(profile.height_cm) : 175;
  const ageYears = profile.chronological_birthdate
    ? (Date.now() - new Date(profile.chronological_birthdate).getTime()) / 31557600000
    : 28;
  const sex = profile.sex ?? 'prefer_not_to_say';

  // Mifflin-St Jeor BMR
  const sexOffset = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  const bmr = 10 * weight + 6.25 * height - 5 * ageYears + sexOffset;
  const tdee = Math.round(bmr * 1.375); // Light active baseline
  const calories = Math.max(1200, Math.min(4500, tdee));

  const proteinG = Math.round(weight * 1.8);
  const fatG = Math.round(weight * 0.8);
  const carbsG = Math.max(50, Math.round((calories - (proteinG * 4 + fatG * 9)) / 4));

  return { calories, proteinG, carbsG, fatG };
}

const toCustomFood = (r: any): SearchFoodResult => ({
  id: r.id,
  name: r.name,
  brand: r.brand ?? undefined,
  servingSize: `${Number(r.serving_size_g)}g`,
  servingGrams: Number(r.serving_size_g),
  calories: r.calories,
  proteinG: Number(r.protein_g),
  carbsG: Number(r.carbs_g),
  fatG: Number(r.fats_g),
  source: 'custom',
});

const toCustomRecipe = (r: any): CustomRecipe => {
  const n = r.total_servings || 1;
  const per = (v: number) => Math.round((Number(v) / n) * 10) / 10;
  return {
    id: r.id,
    name: r.name,
    servingsCount: n,
    ingredients: r.ingredients_json,
    perServingCalories: Math.round(r.total_calories / n),
    perServingProteinG: per(r.total_protein_g),
    perServingCarbsG: per(r.total_carbs_g),
    perServingFatG: per(r.total_fats_g),
    totalCalories: r.total_calories,
    totalProteinG: Number(r.total_protein_g),
    totalCarbsG: Number(r.total_carbs_g),
    totalFatG: Number(r.total_fats_g),
  };
};

export interface WearableSettings {
  priority1: string; priority2: string; priority3: string;
  humeScaleConnected: boolean; fittrConnected: boolean; fiteloConnected: boolean;
  appleHealthConnected: boolean; healthConnectConnected: boolean;
}
export const DEFAULT_WEARABLES: WearableSettings = {
  priority1: 'fitbit', priority2: 'apple_health', priority3: 'google_health',
  humeScaleConnected: false, fittrConnected: false, fiteloConnected: false,
  appleHealthConnected: false, healthConnectConnected: false,
};

export const SyncService = {
  async fetchCustomFoods(): Promise<SearchFoodResult[]> {
    return (await api('/api/custom-foods')).foods.map(toCustomFood);
  },
  async createCustomFood(f: SearchFoodResult): Promise<SearchFoodResult> {
    const { food } = await api('/api/custom-foods', {
      method: 'POST',
      body: { name: f.name, brand: f.brand, servingSizeG: f.servingGrams, calories: f.calories, proteinG: f.proteinG, carbsG: f.carbsG, fatsG: f.fatG },
    });
    return toCustomFood(food);
  },
  async deleteCustomFood(id: string) {
    await api(`/api/custom-foods?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async fetchCustomRecipes(): Promise<CustomRecipe[]> {
    return (await api('/api/custom-recipes')).recipes.map(toCustomRecipe);
  },
  async createCustomRecipe(r: CustomRecipe): Promise<CustomRecipe> {
    const { recipe } = await api('/api/custom-recipes', {
      method: 'POST',
      body: { name: r.name, totalServings: r.servingsCount, totalCalories: r.totalCalories, totalProteinG: r.totalProteinG, totalCarbsG: r.totalCarbsG, totalFatsG: r.totalFatG, ingredients: r.ingredients },
    });
    return toCustomRecipe(recipe);
  },
  async deleteCustomRecipe(id: string) {
    await api(`/api/custom-recipes?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async fetchWearableSettings(): Promise<WearableSettings> {
    const s = (await api('/api/wearable-settings')).settings;
    return s
      ? { priority1: s.priority_1, priority2: s.priority_2, priority3: s.priority_3, humeScaleConnected: s.hume_scale_connected, fittrConnected: s.fittr_connected, fiteloConnected: s.fitelo_connected, appleHealthConnected: s.apple_health_connected ?? false, healthConnectConnected: s.health_connect_connected ?? false }
      : DEFAULT_WEARABLES;
  },
  async saveWearableSettings(patch: Partial<WearableSettings>) {
    await api('/api/wearable-settings', { method: 'PUT', body: patch });
  },

  /** Deletes all server-side data for the signed-in user. */
  async deleteAccountData() {
    await api('/api/account', { method: 'DELETE' });
  },

  async fetchFoodLogs(date = localDate()): Promise<FoodLogItem[]> {
    return (await api(`/api/foods?date=${date}`)).foods.map(toFoodLog);
  },

  async deleteFoodLog(id: string) {
    await api(`/api/foods?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  /** Goals per weekday, index 0 = Sunday ... 6 = Saturday; missing days fall back to profile-derived baseline or DEFAULT_GOALS. */
  async fetchMacroGoals(profile?: any): Promise<MacroGoals[]> {
    const rows: any[] = (await api('/api/macro-goals')).goals;
    const baseGoals = calculateProfileGoals(profile);
    return Array.from({ length: 7 }, (_, d) => {
      const g = rows.find((r) => r.day_of_week === d);
      return g ? { calories: g.target_calories, proteinG: g.target_protein_g, carbsG: g.target_carbs_g, fatG: g.target_fats_g } : baseGoals;
    });
  },

  /** Latest vitals row on/before `date`, or null until a wearable has synced. */
  async fetchVitals(date = localDate()) {
    return (await api(`/api/vitals?date=${date}`)).vitals ?? null;
  },

  async saveVitals(vitalsData: Record<string, unknown> | Array<Record<string, unknown>>) {
    const body = Array.isArray(vitalsData) ? { vitalsList: vitalsData } : vitalsData;
    return (await api('/api/vitals', { method: 'POST', body })).vitals;
  },

  async fetchWorkouts(date = localDate()): Promise<{ today: any[]; recent: any[] }> {
    const r = await api(`/api/workouts?date=${date}&recent=1`);
    return { today: r.workouts ?? [], recent: r.recentWorkouts ?? [] };
  },

  async saveWorkouts(workoutsData: Record<string, unknown> | Array<Record<string, unknown>>) {
    const body = Array.isArray(workoutsData) ? { workouts: workoutsData } : workoutsData;
    return (await api('/api/workouts', { method: 'POST', body })).workouts;
  },

  async fetchUserProfile() {
    return (await api('/api/profile')).profile ?? null;
  },

  /** Partial update; the first call must carry email, display_name, chronological_birthdate and height_cm. */
  async updateUserProfile(updates: Record<string, unknown>) {
    return (await api('/api/profile', { method: 'POST', body: updates })).profile;
  },

  async fetchWaterLog(date = localDate()) {
    return (await api(`/api/water?date=${date}`)).water;
  },

  /** Sets the day's total (not an increment). */
  async syncWaterLog(date: string, volumeMl: number) {
    return (await api('/api/water', { method: 'POST', body: { date, volumeMl } })).water;
  },

  async syncFoodLog(item: FoodLogItem, date = localDate()) {
    const { food } = await api('/api/foods', {
      method: 'POST',
      body: {
        logDate: date,
        mealType: item.mealType,
        foodName: item.name,
        servingQuantity: item.servingGrams || 100,
        servingUnit: item.servingSize || 'serving',
        calories: item.calories,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatsG: item.fatG,
        source: SOURCE[item.source],
      },
    });
    return toFoodLog(food);
  },

  async updateFoodLog(item: FoodLogItem) {
    const { food } = await api('/api/foods', {
      method: 'PUT',
      body: {
        id: item.id,
        mealType: item.mealType,
        foodName: item.name,
        servingQuantity: item.servingGrams || 100,
        servingUnit: item.servingSize || 'serving',
        calories: item.calories,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatsG: item.fatG,
      },
    });
    return toFoodLog(food);
  },

  /** dayOfWeek: 0 = Sunday ... 6 = Saturday */
  async syncMacroGoals(dayOfWeek: number, calories: number, proteinG: number, carbsG: number, fatG: number) {
    return (await api('/api/macro-goals', { method: 'PUT', body: { dayOfWeek, calories, proteinG, carbsG, fatG } })).goal;
  },
};
