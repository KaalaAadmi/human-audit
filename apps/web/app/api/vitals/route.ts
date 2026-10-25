import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { badRequest, isDate, withAuth } from '../../../lib/route';

/** Latest daily vitals row on or before ?date= (null until a wearable has synced). */
export const GET = withAuth(async (req, userId) => {
  const date = new URL(req.url).searchParams.get('date');
  if (!isDate(date)) return badRequest('date (YYYY-MM-DD) is required');
  const [vitals] = await query(
    'SELECT * FROM daily_vitals_summary WHERE user_id = $1 AND summary_date <= $2 ORDER BY summary_date DESC LIMIT 1',
    [userId, date]
  );
  // Sleep/HRV/RHR may fall back to the latest night, but strain is per-day: an older row's strain is not today's.
  if (vitals && vitals.summary_date !== date) Object.assign(vitals, { day_strain: 0, trimp_raw: 0 });
  return NextResponse.json({ success: true, vitals: vitals ?? null });
});

/** Upsert one or multiple daily vitals summary rows. */
export const POST = withAuth(async (req, userId) => {
  const body = await req.json();
  const items = Array.isArray(body.vitalsList) ? body.vitalsList : [body];
  // Parallel: a 50-row chunk done serially (one DB round trip each) outlasts the client's request timeout.
  const rows = await Promise.all(items.map(async (item: any) => {
    const summaryDate = item.summary_date ?? item.summaryDate ?? item.date;
    if (!isDate(summaryDate)) return null;

    const [saved] = await query(
      `INSERT INTO daily_vitals_summary (
        id, user_id, summary_date, readiness_tier, rhr_flag, trimp_raw, day_strain,
        sleep_score, sleep_need_seconds, sleep_debt_seconds, sleep_efficiency_pct, sleep_efficiency_label,
        sleep_duration_seconds, deep_sleep_seconds, rem_sleep_seconds, light_sleep_seconds, awake_seconds, time_in_bed_seconds,
        overnight_hrv_rmssd, resting_heart_rate, vo2max_ml_kg_min, fitness_age, scale_weight_kg, weight_source
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
      )
      ON CONFLICT (user_id, summary_date) DO UPDATE SET
        readiness_tier = COALESCE(EXCLUDED.readiness_tier, daily_vitals_summary.readiness_tier),
        rhr_flag = COALESCE(EXCLUDED.rhr_flag, daily_vitals_summary.rhr_flag),
        trimp_raw = COALESCE(EXCLUDED.trimp_raw, daily_vitals_summary.trimp_raw),
        day_strain = COALESCE(EXCLUDED.day_strain, daily_vitals_summary.day_strain),
        sleep_score = COALESCE(EXCLUDED.sleep_score, daily_vitals_summary.sleep_score),
        sleep_need_seconds = COALESCE(EXCLUDED.sleep_need_seconds, daily_vitals_summary.sleep_need_seconds),
        sleep_debt_seconds = COALESCE(EXCLUDED.sleep_debt_seconds, daily_vitals_summary.sleep_debt_seconds),
        sleep_efficiency_pct = COALESCE(EXCLUDED.sleep_efficiency_pct, daily_vitals_summary.sleep_efficiency_pct),
        sleep_efficiency_label = COALESCE(EXCLUDED.sleep_efficiency_label, daily_vitals_summary.sleep_efficiency_label),
        sleep_duration_seconds = COALESCE(EXCLUDED.sleep_duration_seconds, daily_vitals_summary.sleep_duration_seconds),
        deep_sleep_seconds = COALESCE(EXCLUDED.deep_sleep_seconds, daily_vitals_summary.deep_sleep_seconds),
        rem_sleep_seconds = COALESCE(EXCLUDED.rem_sleep_seconds, daily_vitals_summary.rem_sleep_seconds),
        light_sleep_seconds = COALESCE(EXCLUDED.light_sleep_seconds, daily_vitals_summary.light_sleep_seconds),
        awake_seconds = COALESCE(EXCLUDED.awake_seconds, daily_vitals_summary.awake_seconds),
        time_in_bed_seconds = COALESCE(EXCLUDED.time_in_bed_seconds, daily_vitals_summary.time_in_bed_seconds),
        overnight_hrv_rmssd = COALESCE(EXCLUDED.overnight_hrv_rmssd, daily_vitals_summary.overnight_hrv_rmssd),
        resting_heart_rate = COALESCE(EXCLUDED.resting_heart_rate, daily_vitals_summary.resting_heart_rate),
        vo2max_ml_kg_min = COALESCE(EXCLUDED.vo2max_ml_kg_min, daily_vitals_summary.vo2max_ml_kg_min),
        fitness_age = COALESCE(EXCLUDED.fitness_age, daily_vitals_summary.fitness_age),
        scale_weight_kg = COALESCE(EXCLUDED.scale_weight_kg, daily_vitals_summary.scale_weight_kg),
        weight_source = COALESCE(EXCLUDED.weight_source, daily_vitals_summary.weight_source)
      RETURNING *`,
      [
        crypto.randomUUID(),
        userId,
        summaryDate,
        item.readiness_tier ?? item.readinessTier ?? null,
        item.rhr_flag ?? item.rhrFlag ?? false,
        item.trimp_raw ?? item.trimpRaw ?? null,
        item.day_strain ?? item.dayStrain ?? null,
        item.sleep_score ?? item.sleepScore ?? null,
        item.sleep_need_seconds ?? item.sleepNeedSeconds ?? null,
        item.sleep_debt_seconds ?? item.sleepDebtSeconds ?? null,
        item.sleep_efficiency_pct ?? item.sleepEfficiencyPct ?? null,
        item.sleep_efficiency_label ?? item.sleepEfficiencyLabel ?? null,
        item.sleep_duration_seconds ?? item.sleepDurationSeconds ?? null,
        item.deep_sleep_seconds ?? item.deepSleepSeconds ?? null,
        item.rem_sleep_seconds ?? item.remSleepSeconds ?? null,
        item.light_sleep_seconds ?? item.lightSleepSeconds ?? null,
        item.awake_seconds ?? item.awakeSeconds ?? null,
        item.time_in_bed_seconds ?? item.timeInBedSeconds ?? null,
        item.overnight_hrv_rmssd ?? item.overnightHrvRmssd ?? null,
        item.resting_heart_rate ?? item.restingHeartRate ?? null,
        item.vo2max_ml_kg_min ?? item.vo2maxMlKgMin ?? null,
        item.fitness_age ?? item.fitnessAge ?? null,
        item.scale_weight_kg ?? item.scaleWeightKg ?? null,
        item.weight_source ?? item.weightSource ?? null,
      ]
    );
    return saved ?? null;
  }));
  const results = rows.filter(Boolean);

  return NextResponse.json({ success: true, vitals: results[0] ?? null, count: results.length });
});
