import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { localDate } from '../lib/api';
import { FoodLogItem } from '../services/nutritionService';
import { DEFAULT_GOALS, MacroGoals, SyncService } from '../services/syncService';

/**
 * Everything the Home / Diary / Activity screens show for a given date.
 * When `date` is omitted it defaults to today and refreshes on screen focus.
 * When `date` is provided (diary navigation) it fetches on mount and date changes.
 */
export function useToday(date?: string) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [goals, setGoals] = useState<MacroGoals | null>(null);
  const [foods, setFoods] = useState<FoodLogItem[]>([]);
  const [waterMl, setWaterMl] = useState(0);
  const [vitals, setVitals] = useState<any>(null);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);

  // Prevent concurrent fetches and infinite dependency loops
  const isFetchingRef = useRef(false);

  const refresh = useCallback(async (d?: string) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    const target = d ?? localDate();
    const dayOfWeek = new Date(target + 'T12:00:00').getDay();
    setLoading(true);

    try {
      // Retry once if token is temporarily unavailable on cold start
      let p: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          p = await SyncService.fetchUserProfile();
          break;
        } catch (err) {
          if ((err as Error).message === 'Not signed in' && attempt < 2) {
            await new Promise((res) => setTimeout(res, 350));
            continue;
          }
          if ((err as Error).message === 'Not signed in') throw err;
          break;
        }
      }

      if (p) setProfile(p);

      const [g, f, w, v, wo] = await Promise.all([
        SyncService.fetchMacroGoals(p),
        SyncService.fetchFoodLogs(target),
        SyncService.fetchWaterLog(target),
        SyncService.fetchVitals(target),
        // Workouts are secondary: if they fail, still show the rest of the screen.
        SyncService.fetchWorkouts(target).catch((e) => {
          console.warn('[WORKOUTS_LOAD_ERR]', e);
          return { today: [], recent: [] };
        }),
      ]);

      if (g && g[dayOfWeek]) {
        setGoals(g[dayOfWeek]);
      } else {
        setGoals(DEFAULT_GOALS);
      }

      setFoods(f ?? []);
      setWaterMl(Number(w?.amount_ml) || 0);
      setVitals(v ?? null);
      setWorkouts(wo?.today ?? []);
      setRecentWorkouts(wo?.recent ?? []);
      setError(null);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg !== 'Not signed in') {
        setError(msg);
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  // Initial mount & date prop change
  useEffect(() => {
    refresh(date);
  }, [date, refresh]);

  // Refetch when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refresh(date);
    }, [date, refresh])
  );

  return { loading, error, profile, goals, foods, setFoods, waterMl, vitals, workouts, recentWorkouts, refresh };
}
