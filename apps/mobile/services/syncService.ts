import { supabase } from '../lib/supabase';
import { FoodLogItem } from './nutritionService';
import { WorkoutRecord } from './wearableEngine';

export interface DailySyncPayload {
  userId: string;
  date: string; // YYYY-MM-DD
  waterMl: number;
  waterGoalMl: number;
  foodLogs: FoodLogItem[];
  workouts: WorkoutRecord[];
  dayStrain: number;
  readinessScore: number;
  biologicalAge: number;
}

export const SyncService = {
  /**
   * Sync daily hydration volume to Supabase
   */
  async syncWaterLog(userId: string, date: string, volumeMl: number, goalMl: number) {
    try {
      const { data, error } = await supabase
        .from('water_logs')
        .upsert(
          {
            user_id: userId,
            logged_date: date,
            amount_ml: volumeMl,
            goal_ml: goalMl,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,logged_date' }
        );

      if (error) {
        console.warn('[SYNC_WATER_ERROR]', error.message);
        return { success: false, error: error.message };
      }
      return { success: true, data };
    } catch (err: any) {
      console.warn('[SYNC_WATER_EXCEPTION]', err.message);
      return { success: false, error: err.message };
    }
  },

  /**
   * Sync food logs to Supabase
   */
  async syncFoodLog(userId: string, item: FoodLogItem) {
    try {
      const { data, error } = await supabase
        .from('food_logs')
        .insert({
          id: item.id,
          user_id: userId,
          food_name: item.name,
          brand_name: item.brand || null,
          meal_type: item.mealType,
          serving_size: item.servingSize,
          serving_grams: item.servingGrams,
          servings_count: item.servingsCount,
          calories: item.calories,
          protein_g: item.proteinG,
          carbs_g: item.carbsG,
          fat_g: item.fatG,
          source: item.source,
          logged_at: new Date().toISOString(),
        });

      if (error) {
        console.warn('[SYNC_FOOD_ERROR]', error.message);
        return { success: false, error: error.message };
      }
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Sync Day-of-Week Macro Goals
   */
  async syncMacroGoals(userId: string, dayOfWeek: number, calories: number, proteinG: number, carbsG: number, fatG: number) {
    try {
      const { data, error } = await supabase
        .from('daily_macro_goals')
        .upsert(
          {
            user_id: userId,
            day_of_week: dayOfWeek,
            calorie_target: calories,
            protein_g: proteinG,
            carbs_g: carbsG,
            fat_g: fatG,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,day_of_week' }
        );

      if (error) return { success: false, error: error.message };
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Pull active profile and today's telemetry from Supabase
   */
  async fetchTodayTelemetry(userId: string, date: string) {
    try {
      const [waterRes, foodsRes, vitalsRes] = await Promise.all([
        supabase.from('water_logs').select('*').eq('user_id', userId).eq('logged_date', date).single(),
        supabase.from('food_logs').select('*').eq('user_id', userId),
        supabase.from('daily_vitals_summary').select('*').eq('user_id', userId).eq('date', date).single(),
      ]);

      return {
        water: waterRes.data,
        foods: foodsRes.data || [],
        vitals: vitalsRes.data,
      };
    } catch (err: any) {
      return { water: null, foods: [], vitals: null };
    }
  }
};
