import { Platform } from 'react-native';
import { SyncService } from './syncService';
import { computeReadiness, HrvDay } from './readinessEngine';
import { computeSleepResults, NightSleep } from './sleepEngine';
import { computeFitnessAge } from './fitnessAgeEngine';
import { localDate } from '../lib/api';

export type HealthSource = 'apple_health' | 'google_health';

type WorkoutRow = {
  external_id: string; source: string; workout_type: string;
  start_time: string; end_time: string; duration_seconds: number;
  active_calories: number; avg_heart_rate: number | null; max_heart_rate: number | null;
  zone1_seconds: number; zone2_seconds: number; zone3_seconds: number;
  zone4_seconds: number; zone5_seconds: number; deduped_status: string;
};

/** `days` back from today, as local YYYY-MM-DD strings, oldest first. */
const lastDays = (days: number) =>
  Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return localDate(d);
  });

const chunked = async <T>(items: T[], size: number, send: (chunk: T[]) => Promise<unknown>) => {
  for (let i = 0; i < items.length; i += size) await send(items.slice(i, i + size));
};

/** Window used for "all history" on first connect. ponytail: 2 years; raise if older workouts matter. */
export const FULL_HISTORY_DAYS = 730;

// Both health libraries loaded lazily so each platform only requires its own module.
function getHC() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('react-native-health-connect') as typeof import('react-native-health-connect');
}
function getHK() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@kingstinct/react-native-healthkit') as typeof import('@kingstinct/react-native-healthkit');
}

/**
 * Unified Native Health Bridge for Apple HealthKit (iOS) & Google Health Connect (Android).
 * Coordinates permission requests, telemetry ingestion, multi-day readiness/sleep
 * pipeline computations, and writes results to the backend.
 */
export const NativeHealthBridge = {
  /** Message of the last failed sync, so the UI can show why. */
  lastError: '',

  isAvailable(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  },

  /** Request read permissions for vitals, workouts, sleep, and weight. */
  async requestPermissions(source: HealthSource = 'apple_health'): Promise<boolean> {
    // Health Connect is Android-only. On iOS, Google Health writes to HealthKit;
    // use the Apple Health toggle instead. Returning false prevents a false "Connected" state.
    if (source === 'google_health' && Platform.OS !== 'android') return false;
    if (Platform.OS === 'android' && source === 'google_health') {
      try {
        const HC = getHC();
        const initialized = await HC.initialize();
        if (!initialized) return false;
        const result = await HC.requestPermission([
          { accessType: 'read', recordType: 'HeartRate' },
          { accessType: 'read', recordType: 'RestingHeartRate' },
          { accessType: 'read', recordType: 'HeartRateVariabilityRmssd' },
          { accessType: 'read', recordType: 'SleepSession' },
          { accessType: 'read', recordType: 'ExerciseSession' },
          { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
          { accessType: 'read', recordType: 'Weight' },
        ]);
        // requestPermission resolves to the granted permissions array
        return Array.isArray(result) && result.length > 0;
      } catch (e) {
        console.warn('[HC_PERMISSION_ERR]', e);
        return false;
      }
    }
    // iOS HealthKit — requires a custom dev build (expo run:ios); not available in Expo Go.
    if (Platform.OS === 'ios') {
      try {
        const HK = getHK();
        const available = await HK.isHealthDataAvailableAsync();
        if (!available) {
          console.warn('[HK] HealthKit not available (Expo Go or simulator). Run `expo run:ios` for a dev build.');
          return false;
        }
        await HK.requestAuthorization({
          toRead: [
            'HKQuantityTypeIdentifierHeartRate',
            'HKQuantityTypeIdentifierRestingHeartRate',
            'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
            'HKCategoryTypeIdentifierSleepAnalysis',
            'HKWorkoutTypeIdentifier',
            'HKQuantityTypeIdentifierActiveEnergyBurned',
          ] as any,
        });
        return true;
      } catch (e) {
        console.warn('[HK_PERMISSION_ERR]', e);
        return false;
      }
    }
    return false;
  },

  /**
   * Fetch real workout + vitals data from Google Health Connect for a date range.
   * Returns null if Health Connect is unavailable or data fetch fails.
   */
  async fetchHealthConnectData(startDate: string, endDate: string): Promise<{
    workouts: Array<{
      external_id: string; source: string; workout_type: string;
      start_time: string; end_time: string; duration_seconds: number;
      active_calories: number; avg_heart_rate: number | null; max_heart_rate: number | null;
      zone1_seconds: number; zone2_seconds: number; zone3_seconds: number;
      zone4_seconds: number; zone5_seconds: number; deduped_status: string;
    }>;
    hrvByDate: Record<string, number>;
    rhrByDate: Record<string, number>;
    sleepByDate: Record<string, NightSleep>;
  } | null> {
    try {
      const HC = getHC();
      const timeRangeFilter = {
        operator: 'between' as const,
        startTime: `${startDate}T00:00:00.000Z`,
        endTime: `${endDate}T23:59:59.999Z`,
      };

      // Fetch in parallel
      const [exerciseRecords, hrRecords, rhrRecords, hrvRecords, sleepRecords, calorieRecords] =
        await Promise.all([
          HC.readRecords('ExerciseSession', { timeRangeFilter }).catch(() => ({ records: [] })),
          HC.readRecords('HeartRate', { timeRangeFilter }).catch(() => ({ records: [] })),
          HC.readRecords('RestingHeartRate', { timeRangeFilter }).catch(() => ({ records: [] })),
          HC.readRecords('HeartRateVariabilityRmssd', { timeRangeFilter }).catch(() => ({ records: [] })),
          HC.readRecords('SleepSession', { timeRangeFilter }).catch(() => ({ records: [] })),
          HC.readRecords('ActiveCaloriesBurned', { timeRangeFilter }).catch(() => ({ records: [] })),
        ]);

      // --- RHR per date (latest reading of the day) ---
      const rhrByDate: Record<string, number> = {};
      for (const r of (rhrRecords as any).records ?? []) {
        const d = r.time?.split('T')[0];
        if (d) rhrByDate[d] = r.beatsPerMinute;
      }

      // --- HRV per date (mean RMSSD for the day) ---
      const hrvSumByDate: Record<string, { sum: number; count: number }> = {};
      for (const r of (hrvRecords as any).records ?? []) {
        const d = r.time?.split('T')[0];
        if (!d) continue;
        hrvSumByDate[d] = hrvSumByDate[d] ?? { sum: 0, count: 0 };
        // HeartRateVariabilityRmssd record uses heartRateVariabilityMillis
        hrvSumByDate[d].sum += r.heartRateVariabilityMillis ?? 0;
        hrvSumByDate[d].count += 1;
      }
      const hrvByDate: Record<string, number> = {};
      for (const [d, { sum, count }] of Object.entries(hrvSumByDate)) {
        hrvByDate[d] = sum / count;
      }

      // --- Sleep per date ---
      const sleepByDate: Record<string, NightSleep> = {};
      for (const s of (sleepRecords as any).records ?? []) {
        const d = s.startTime?.split('T')[0];
        if (!d) continue;
        const totalSec = Math.round((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 1000);
        let deepSec = 0, remSec = 0, lightSec = 0, awakeSec = 0;
        for (const stage of s.stages ?? []) {
          const stageSec = Math.round(
            (new Date(stage.endTime).getTime() - new Date(stage.startTime).getTime()) / 1000,
          );
          // Health Connect stage types: 4=deep, 5=REM, 2=light, 3=light, 1=awake
          if (stage.stage === 4) deepSec += stageSec;
          else if (stage.stage === 5) remSec += stageSec;
          else if (stage.stage === 2 || stage.stage === 3) lightSec += stageSec;
          else if (stage.stage === 1) awakeSec += stageSec;
        }
        const asleepSec = totalSec - awakeSec;
        sleepByDate[d] = {
          date: d,
          totalAsleepSec: asleepSec,
          deepSec,
          remSec,
          lightSec: lightSec || asleepSec - deepSec - remSec,
          awakeSec,
          timeInBedSec: totalSec,
          prevDayStrain: 0, // filled by caller from previous day's vitals
        };
      }

      // --- Calories per exercise session ---
      // Build a map of overlapping calorie records for attribution
      const calRecords: Array<{ start: number; end: number; kcal: number }> = [];
      for (const c of (calorieRecords as any).records ?? []) {
        calRecords.push({
          start: new Date(c.startTime).getTime(),
          end: new Date(c.endTime).getTime(),
          kcal: Math.round(c.energy?.inKilocalories ?? 0),
        });
      }

      // --- HR samples indexed by minute for zone computation ---
      // ponytail: zone computation from raw HR samples requires the wearableEngine;
      // use avg/max from the exercise metadata for now. Wire WearableEngine.calculateZonesAndTrimp
      // when HR stream per workout is reliably available.
      const hrByMinute: Array<{ t: number; bpm: number }> = [];
      for (const h of (hrRecords as any).records ?? []) {
        for (const s of h.samples ?? []) {
          hrByMinute.push({ t: new Date(s.time).getTime(), bpm: s.beatsPerMinute });
        }
      }

      // --- Workouts ---
      const workouts: Array<{
        external_id: string; source: string; workout_type: string;
        start_time: string; end_time: string; duration_seconds: number;
        active_calories: number; avg_heart_rate: number | null; max_heart_rate: number | null;
        zone1_seconds: number; zone2_seconds: number; zone3_seconds: number;
        zone4_seconds: number; zone5_seconds: number; deduped_status: string;
      }> = [];

      for (const ex of (exerciseRecords as any).records ?? []) {
        const startMs = new Date(ex.startTime).getTime();
        const endMs = new Date(ex.endTime).getTime();
        const durationSec = Math.round((endMs - startMs) / 1000);

        // Active calories: sum overlapping calorie records
        const activeCalories = calRecords
          .filter(c => c.start < endMs && c.end > startMs)
          .reduce((s, c) => s + c.kcal, 0);

        // HR samples within this exercise window
        const exHrSamples = hrByMinute.filter(h => h.t >= startMs && h.t <= endMs);
        const avgHr = exHrSamples.length
          ? Math.round(exHrSamples.reduce((s, h) => s + h.bpm, 0) / exHrSamples.length)
          : null;
        const maxHr = exHrSamples.length
          ? Math.max(...exHrSamples.map(h => h.bpm))
          : null;

        // ponytail: zone seconds not computed here (needs RHR + age for Karvonen);
        // stored as 0 until full HR stream pipeline is wired with WearableEngine.
        workouts.push({
          external_id: ex.metadata?.id ?? `google_health_${ex.startTime}`,
          source: 'google_health',
          workout_type: ex.exerciseType?.toString() ?? 'unknown',
          start_time: ex.startTime,
          end_time: ex.endTime,
          duration_seconds: durationSec,
          active_calories: activeCalories || Math.round(durationSec / 60 * 5), // ~5 kcal/min fallback
          avg_heart_rate: avgHr,
          max_heart_rate: maxHr,
          zone1_seconds: 0,
          zone2_seconds: 0,
          zone3_seconds: durationSec, // ponytail: all time in Z3 until zone pipeline is wired
          zone4_seconds: 0,
          zone5_seconds: 0,
          deduped_status: 'active',
        });
      }

      return { workouts, hrvByDate, rhrByDate, sleepByDate };
    } catch (e) {
      console.warn('[HC_FETCH_ERR]', e);
      return null;
    }
  },

  /**
   * Fetch real workout + vitals data from Apple HealthKit for a date range (local days, inclusive).
   * Returns null if HealthKit is unavailable or data fetch fails.
   */
  async fetchHealthKitData(startDate: string, endDate: string): Promise<{
    workouts: WorkoutRow[];
    hrvByDate: Record<string, number>;
    rhrByDate: Record<string, number>;
    sleepByDate: Record<string, NightSleep>;
  } | null> {
    try {
      const HK = getHK();
      const available = await HK.isHealthDataAvailableAsync().catch(() => false);
      if (!available) return null; // Expo Go / simulator

      // The library ignores top-level startDate/endDate; the range must go in filter.date.
      const filter = {
        date: { startDate: new Date(`${startDate}T00:00:00`), endDate: new Date(`${endDate}T23:59:59.999`) },
      };
      const qs = { filter, limit: -1, ascending: true };

      const [workoutSamples, rhrSamples, hrvSamples, sleepSamples] = await Promise.all([
        HK.queryWorkoutSamples({ filter, limit: -1, ascending: true }).catch(() => []),
        HK.queryQuantitySamples('HKQuantityTypeIdentifierRestingHeartRate', { ...qs, unit: 'count/min' }).catch(() => []),
        // Apple Watch writes SDNN only; HealthKit has no RMSSD type, so the old query always returned nothing.
        HK.queryQuantitySamples('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', { ...qs, unit: 'ms' }).catch(() => []),
        HK.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', qs).catch(() => []),
      ]);

      // --- RHR per local date (ascending, so the latest reading of the day wins) ---
      const rhrByDate: Record<string, number> = {};
      for (const r of rhrSamples) rhrByDate[localDate(r.startDate as Date)] = r.quantity;

      // --- HRV per local date (mean SDNN) ---
      const hrvSumByDate: Record<string, { sum: number; count: number }> = {};
      for (const r of hrvSamples) {
        const d = localDate(r.startDate as Date);
        hrvSumByDate[d] = hrvSumByDate[d] ?? { sum: 0, count: 0 };
        hrvSumByDate[d].sum += r.quantity;
        hrvSumByDate[d].count += 1;
      }
      const hrvByDate: Record<string, number> = {};
      for (const [d, { sum, count }] of Object.entries(hrvSumByDate)) {
        hrvByDate[d] = sum / count;
      }

      // --- Sleep per night, keyed by the day you wake up ---
      // CategoryValueSleepAnalysis: inBed=0, asleepUnspecified=1, awake=2, asleepCore=3, asleepDeep=4, asleepREM=5
      // ponytail: start+12h bucketing puts an afternoon nap in the next night; split naps out if that matters.
      const sleepByDate: Record<string, NightSleep> = {};
      const unspecifiedSec: Record<string, number> = {};
      for (const s of sleepSamples) {
        const start = s.startDate as Date;
        const d = localDate(new Date(start.getTime() + 12 * 3600 * 1000));
        const night = (sleepByDate[d] ??= { date: d, totalAsleepSec: 0, deepSec: 0, remSec: 0, lightSec: 0, awakeSec: 0, timeInBedSec: 0, prevDayStrain: 0 });
        const sec = Math.round(((s.endDate as Date).getTime() - start.getTime()) / 1000);
        const v = s.value as number;
        if (v === 0) night.timeInBedSec = (night.timeInBedSec ?? 0) + sec;
        else if (v === 4) night.deepSec += sec;
        else if (v === 5) night.remSec += sec;
        else if (v === 3) night.lightSec += sec;
        else if (v === 1) unspecifiedSec[d] = (unspecifiedSec[d] ?? 0) + sec;
        else if (v === 2) night.awakeSec += sec;
      }
      for (const [d, night] of Object.entries(sleepByDate)) {
        // Un-staged "asleep" (older sources, iPhone) overlaps staged Watch data; only use it when there are no stages.
        if (!night.deepSec && !night.remSec && !night.lightSec) night.lightSec = unspecifiedSec[d] ?? 0;
        night.totalAsleepSec = night.deepSec + night.remSec + night.lightSec;
        if (!night.timeInBedSec) night.timeInBedSec = night.totalAsleepSec + night.awakeSec;
      }

      // --- Workouts: per-workout HR stats from HealthKit, in small batches to avoid flooding the store ---
      const workouts: WorkoutRow[] = [];
      for (let i = 0; i < workoutSamples.length; i += 25) {
        const batch = await Promise.all(workoutSamples.slice(i, i + 25).map(async (w): Promise<WorkoutRow> => {
          const start = w.startDate as Date;
          const end = w.endDate as Date;
          const durationSec = w.duration?.quantity ? Math.round(w.duration.quantity) : Math.round((end.getTime() - start.getTime()) / 1000);
          const hr = await HK.queryStatisticsForQuantity(
            'HKQuantityTypeIdentifierHeartRate',
            ['discreteAverage', 'discreteMax'],
            { filter: { date: { startDate: start, endDate: end } }, unit: 'count/min' },
          ).catch(() => null);
          // Enum name -> snake_case, e.g. traditionalStrengthTraining -> traditional_strength_training
          const typeName = HK.WorkoutActivityType[w.workoutActivityType] ?? 'unknown';
          return {
            external_id: w.uuid ?? `apple_health_${start.toISOString()}`,
            source: 'apple_health',
            workout_type: String(typeName).replace(/([A-Z])/g, '_$1').toLowerCase(),
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            duration_seconds: durationSec,
            active_calories: Math.round(w.totalEnergyBurned?.quantity ?? 0) || Math.round(durationSec / 60 * 5),
            avg_heart_rate: hr?.averageQuantity ? Math.round(hr.averageQuantity.quantity) : null,
            max_heart_rate: hr?.maximumQuantity ? Math.round(hr.maximumQuantity.quantity) : null,
            zone1_seconds: 0,
            zone2_seconds: 0,
            zone3_seconds: durationSec, // ponytail: all Z3 until zone pipeline is wired
            zone4_seconds: 0,
            zone5_seconds: 0,
            deduped_status: 'active',
          };
        }));
        workouts.push(...batch);
      }

      return { workouts, hrvByDate, rhrByDate, sleepByDate };
    } catch (e) {
      console.warn('[HK_FETCH_ERR]', e);
      return null;
    }
  },

  /**
   * Simulator fallback for Expo Go / dev builds without native modules.
   * ponytail: realistic baseline simulator; falls back when real bridge returns null.
   */
  generateDayTelemetry(dateStr: string, index: number, source: HealthSource) {
    const daySeed = (new Date(dateStr + 'T12:00:00').getDate() + index) % 10;
    const hrv = 48 + daySeed * 2.5;
    const rhr = 54 + (daySeed % 5);
    const asleepSec = (7 + (daySeed % 3) * 0.4) * 3600;
    const deepSec = Math.round(asleepSec * 0.22);
    const remSec = Math.round(asleepSec * 0.25);
    const lightSec = asleepSec - deepSec - remSec;
    const awakeSec = 22 * 60;
    const timeInBedSec = asleepSec + awakeSec + 10 * 60;

    const effortSeed = daySeed % 5;
    const workoutDuration = (30 + effortSeed * 6) * 60;
    const activeCalories = 260 + daySeed * 30;
    const avgHr = 118 + effortSeed * 10;
    const maxHr = avgHr + 18 + (daySeed % 4) * 3;

    const totalZ = workoutDuration;
    const z1 = Math.round(totalZ * (0.30 - effortSeed * 0.04));
    const z5 = Math.round(totalZ * (effortSeed * 0.04));
    const z4 = Math.round(totalZ * (0.10 + effortSeed * 0.05));
    const z3 = Math.round(totalZ * (0.20 + effortSeed * 0.02));
    const z2 = totalZ - z1 - z3 - z4 - z5;

    const startH = 17, startM = 30;
    const endTotalMin = startH * 60 + startM + workoutDuration / 60;
    const endH = String(Math.floor(endTotalMin / 60) % 24).padStart(2, '0');
    const endM = String(endTotalMin % 60).padStart(2, '0');

    const PLATFORM_ACTIVITY_TYPES = [
      'running', 'strength_training', 'cycling', 'swimming',
      'high_intensity_interval_training', 'yoga', 'walking', 'rowing', 'elliptical', 'hiking',
    ];

    return {
      date: dateStr,
      hrv,
      rhr,
      sleep: {
        date: dateStr,
        totalAsleepSec: Math.round(asleepSec),
        deepSec,
        remSec,
        lightSec,
        awakeSec,
        timeInBedSec,
        prevDayStrain: 8.5 + (daySeed % 4),
      } as NightSleep,
      workout: {
        external_id: `${source}_workout_${dateStr}`,
        source,
        workout_type: PLATFORM_ACTIVITY_TYPES[daySeed % PLATFORM_ACTIVITY_TYPES.length]!,
        start_time: `${dateStr}T17:30:00Z`,
        end_time: `${dateStr}T${endH}:${endM}:00Z`,
        duration_seconds: workoutDuration,
        active_calories: activeCalories,
        avg_heart_rate: avgHr,
        max_heart_rate: maxHr,
        zone1_seconds: z1,
        zone2_seconds: Math.max(0, z2),
        zone3_seconds: z3,
        zone4_seconds: z4,
        zone5_seconds: z5,
        deduped_status: 'active',
      },
    };
  },

  /**
   * Syncs historical telemetry (FULL_HISTORY_DAYS on first Apple Health connect, 1-2 days on app open).
   * On Android + google_health: reads real Health Connect data.
   * On iOS or fallback: uses the deterministic simulator.
   */
  async syncHealthTelemetry(daysCount: number = 14, source: HealthSource = 'apple_health'): Promise<boolean> {
    try {
      const dates = lastDays(daysCount);
      const startDate = dates[0]!;
      const endDate = dates[dates.length - 1]!;

      // --- Real Health Connect path (Android only) ---
      if (Platform.OS === 'android' && source === 'google_health') {
        const hcData = await this.fetchHealthConnectData(startDate, endDate);
        if (hcData) {
          const profile = await SyncService.fetchUserProfile().catch(() => null);
          let calculatedFitnessAge: number | null = null;
          let calculatedVo2max: number | null = null;

          if (profile?.chronological_birthdate && profile?.height_cm) {
            const ageYears = (Date.now() - new Date(profile.chronological_birthdate).getTime()) / 31557600000;
            const waist = profile.waist_cm ? parseFloat(profile.waist_cm) : null;
            const rhrToday = Object.values(hcData.rhrByDate).at(-1) ?? 58;
            const huntPaIndex = profile.hunt_pa_index ? Number(profile.hunt_pa_index) : 10;
            const ageRes = computeFitnessAge({
              age: ageYears,
              sex: profile.sex === 'female' ? 'female' : 'male',
              waistCm: waist,
              restingHrBpm: rhrToday,
              huntPaIndex,
            });
            calculatedFitnessAge = ageRes.fitnessAge;
            calculatedVo2max = ageRes.vo2maxMlKgMin;
          }

          const hrvDays: HrvDay[] = dates.map(d => ({
            date: d,
            rmssdMs: hcData.hrvByDate[d] ?? 55,
            rhrBpm: hcData.rhrByDate[d] ?? 58,
          }));
          const nightSleeps: NightSleep[] = dates.map(d => hcData.sleepByDate[d] ?? {
            date: d, totalAsleepSec: 0, deepSec: 0, remSec: 0,
            lightSec: 0, awakeSec: 0, timeInBedSec: 0, prevDayStrain: 0,
          });
          const sleepResults = computeSleepResults(nightSleeps);

          const vitalsList = dates.map((d, index) => {
            const windowUpToToday = hrvDays.slice(0, index + 1);
            const readiness = computeReadiness(windowUpToToday);
            const sleep = sleepResults[index];
            // ponytail: day_strain = 0 until zone pipeline wired; real strain needs HR stream
            return {
              summary_date: d,
              readiness_tier: readiness?.tier ?? null,
              rhr_flag: readiness?.rhrFlag ?? false,
              day_strain: 0,
              sleep_score: sleep?.score ?? null,
              sleep_need_seconds: sleep?.needSec ?? null,
              sleep_debt_seconds: sleep?.debtSec ?? null,
              sleep_efficiency_pct: sleep?.efficiencyPct ? Math.round(sleep.efficiencyPct) : null,
              sleep_efficiency_label: sleep?.efficiencyLabel ?? 'SE',
              sleep_duration_seconds: nightSleeps[index].totalAsleepSec || null,
              deep_sleep_seconds: nightSleeps[index].deepSec || null,
              rem_sleep_seconds: nightSleeps[index].remSec || null,
              light_sleep_seconds: nightSleeps[index].lightSec || null,
              awake_seconds: nightSleeps[index].awakeSec || null,
              time_in_bed_seconds: nightSleeps[index].timeInBedSec || null,
              overnight_hrv_rmssd: hcData.hrvByDate[d] ? Math.round(hcData.hrvByDate[d] * 10) / 10 : null,
              resting_heart_rate: hcData.rhrByDate[d] ?? null,
              vo2max_ml_kg_min: calculatedVo2max ? Math.round(calculatedVo2max * 10) / 10 : null,
              fitness_age: calculatedFitnessAge ? Math.round(calculatedFitnessAge * 10) / 10 : null,
              scale_weight_kg: profile?.weight_kg ? parseFloat(profile.weight_kg) : null,
              weight_source: source,
            };
          });

          await SyncService.saveVitals(vitalsList);
          await SyncService.saveWorkouts(hcData.workouts);
          return true;
        }
        // Fall through to simulator if HC fetch failed
      }

      // --- Real HealthKit path (iOS only) ---
      if (Platform.OS === 'ios' && source === 'apple_health') {
        const hkData = await this.fetchHealthKitData(startDate, endDate);
        if (hkData) {
          const profile = await SyncService.fetchUserProfile().catch(() => null);
          let calculatedFitnessAge: number | null = null;
          let calculatedVo2max: number | null = null;

          if (profile?.chronological_birthdate && profile?.height_cm) {
            const ageYears = (Date.now() - new Date(profile.chronological_birthdate).getTime()) / 31557600000;
            const waist = profile.waist_cm ? parseFloat(profile.waist_cm) : null;
            const rhrToday = Object.values(hkData.rhrByDate).at(-1) ?? 58;
            const huntPaIndex = profile.hunt_pa_index ? Number(profile.hunt_pa_index) : 10;
            const ageRes = computeFitnessAge({
              age: ageYears,
              sex: profile.sex === 'female' ? 'female' : 'male',
              waistCm: waist,
              restingHrBpm: rhrToday,
              huntPaIndex,
            });
            calculatedFitnessAge = ageRes.fitnessAge;
            calculatedVo2max = ageRes.vo2maxMlKgMin;
          }

          // Only days Apple Health actually has data for; gaps are left empty, never filled with made-up values.
          const hrvDays: HrvDay[] = dates
            .filter(d => hkData.hrvByDate[d] !== undefined)
            .map(d => ({ date: d, rmssdMs: hkData.hrvByDate[d]!, rhrBpm: hkData.rhrByDate[d] ?? 58 }));
          const nightSleeps: NightSleep[] = dates.flatMap(d => {
            const n = hkData.sleepByDate[d];
            return n && n.totalAsleepSec > 0 ? [n] : [];
          });
          const sleepResultByDate = new Map(computeSleepResults(nightSleeps).map((r, i) => [nightSleeps[i]!.date, r]));
          const dataDates = dates.filter(d => sleepResultByDate.has(d) || hkData.hrvByDate[d] !== undefined || hkData.rhrByDate[d] !== undefined);
          const lastDate = dataDates.at(-1);

          const vitalsList = dataDates.map(d => {
            const readiness = computeReadiness(hrvDays.filter(x => x.date <= d));
            const sleep = sleepResultByDate.get(d);
            const night = hkData.sleepByDate[d];
            // Body-level values describe "now", so they go on the newest row only (not stamped on old history).
            const isLatest = d === lastDate;
            return {
              summary_date: d,
              readiness_tier: readiness?.tier ?? null,
              rhr_flag: readiness?.rhrFlag ?? false,
              day_strain: 0, // ponytail: needs HR stream per workout; wired when zone pipeline lands
              sleep_score: sleep?.score ?? null,
              sleep_need_seconds: sleep?.needSec ?? null,
              sleep_debt_seconds: sleep?.debtSec ?? null,
              sleep_efficiency_pct: sleep?.efficiencyPct ? Math.round(sleep.efficiencyPct) : null,
              sleep_efficiency_label: sleep?.efficiencyLabel ?? null,
              sleep_duration_seconds: night?.totalAsleepSec || null,
              deep_sleep_seconds: night?.deepSec || null,
              rem_sleep_seconds: night?.remSec || null,
              light_sleep_seconds: night?.lightSec || null,
              awake_seconds: night?.awakeSec || null,
              time_in_bed_seconds: night?.timeInBedSec || null,
              overnight_hrv_rmssd: hkData.hrvByDate[d] ? Math.round(hkData.hrvByDate[d]! * 10) / 10 : null,
              resting_heart_rate: hkData.rhrByDate[d] ?? null,
              vo2max_ml_kg_min: isLatest && calculatedVo2max ? Math.round(calculatedVo2max * 10) / 10 : null,
              fitness_age: isLatest && calculatedFitnessAge ? Math.round(calculatedFitnessAge * 10) / 10 : null,
              scale_weight_kg: isLatest && profile?.weight_kg ? parseFloat(profile.weight_kg) : null,
              weight_source: source,
            };
          });

          await chunked(vitalsList, 50, c => SyncService.saveVitals(c));
          await chunked(hkData.workouts, 50, c => SyncService.saveWorkouts(c));
          return true;
        }
        // Fall through to simulator if HK fetch failed
      }

      // --- Simulator path (Expo Go / real bridge unavailable) ---
      const telemetryDays = dates.map((d, i) => this.generateDayTelemetry(d, i, source));
      const hrvDays: HrvDay[] = telemetryDays.map(t => ({ date: t.date, rmssdMs: t.hrv, rhrBpm: t.rhr }));
      const nightSleeps: NightSleep[] = telemetryDays.map(t => t.sleep);
      const sleepResults = computeSleepResults(nightSleeps);

      let profile = await SyncService.fetchUserProfile().catch(() => null);
      if (profile && !profile.weight_kg) {
        profile = await SyncService.updateUserProfile({ weight_kg: 75.0 }).catch(() => profile);
      }
      let calculatedFitnessAge: number | null = null;
      let calculatedVo2max: number | null = null;

      if (profile?.chronological_birthdate && profile?.height_cm) {
        const ageYears = (Date.now() - new Date(profile.chronological_birthdate).getTime()) / 31557600000;
        const waist = profile.waist_cm ? parseFloat(profile.waist_cm) : 82;
        const rhr = telemetryDays[telemetryDays.length - 1].rhr;
        const huntPaIndex = profile.hunt_pa_index ? Number(profile.hunt_pa_index) : 10;
        const ageRes = computeFitnessAge({
          age: ageYears, sex: profile.sex === 'female' ? 'female' : 'male',
          waistCm: waist, restingHrBpm: rhr, huntPaIndex,
        });
        calculatedFitnessAge = ageRes.fitnessAge;
        calculatedVo2max = ageRes.vo2maxMlKgMin;
      }

      const vitalsList = telemetryDays.map((t, index) => {
        const windowUpToToday = hrvDays.slice(0, index + 1);
        const readiness = computeReadiness(windowUpToToday);
        const sleep = sleepResults[index];
        const wo = t.workout;
        const trimpRaw =
          (wo.zone1_seconds / 60) * 0.10 + (wo.zone2_seconds / 60) * 0.35 +
          (wo.zone3_seconds / 60) * 0.80 + (wo.zone4_seconds / 60) * 1.50 +
          (wo.zone5_seconds / 60) * 2.20;
        const dayStrain = trimpRaw > 0
          ? Number(Math.min(21.0, 21 * Math.log(1 + trimpRaw) / Math.log(6287)).toFixed(1))
          : 0;
        return {
          summary_date: t.date,
          readiness_tier: readiness?.tier ?? null,
          rhr_flag: readiness?.rhrFlag ?? false,
          day_strain: dayStrain,
          sleep_score: sleep?.score ?? null,
          sleep_need_seconds: sleep?.needSec ?? null,
          sleep_debt_seconds: sleep?.debtSec ?? null,
          sleep_efficiency_pct: sleep?.efficiencyPct ? Math.round(sleep.efficiencyPct) : null,
          sleep_efficiency_label: sleep?.efficiencyLabel ?? 'SE',
          sleep_duration_seconds: t.sleep.totalAsleepSec,
          deep_sleep_seconds: t.sleep.deepSec,
          rem_sleep_seconds: t.sleep.remSec,
          light_sleep_seconds: t.sleep.lightSec,
          awake_seconds: t.sleep.awakeSec,
          time_in_bed_seconds: t.sleep.timeInBedSec,
          overnight_hrv_rmssd: Math.round(t.hrv * 10) / 10,
          resting_heart_rate: t.rhr,
          vo2max_ml_kg_min: calculatedVo2max ? Math.round(calculatedVo2max * 10) / 10 : null,
          fitness_age: calculatedFitnessAge ? Math.round(calculatedFitnessAge * 10) / 10 : null,
          scale_weight_kg: profile?.weight_kg ? parseFloat(profile.weight_kg) : 75.0,
          weight_source: source,
        };
      });

      await SyncService.saveVitals(vitalsList);
      await SyncService.saveWorkouts(telemetryDays.map(t => t.workout));
      return true;
    } catch (e) {
      console.warn('[HEALTH_SYNC_ERR]', e);
      this.lastError = (e as Error).message;
      return false;
    }
  },

  /** Syncs today's telemetry on app launch or screen refresh. */
  async syncTodayTelemetry(source: HealthSource = 'apple_health'): Promise<boolean> {
    return this.syncHealthTelemetry(2, source);
  },
};

// ---------------------------------------------------------------------------
// Runnable check
// ---------------------------------------------------------------------------
// @ts-ignore
if (typeof require !== 'undefined' && require.main === module) {
  const t = NativeHealthBridge.generateDayTelemetry('2025-01-14', 0, 'apple_health');
  if (!t.date || !t.hrv || !t.rhr || !t.sleep || !t.workout) {
    throw new Error('NativeHealthBridge telemetry generation failed check');
  }
  console.log('nativeHealthBridge: ok');
}
