// summaries_recompute: raw samples -> daily_summaries (docs section 10) -> legacy daily_vitals_summary / workout_logs
// so the existing dashboard and Previous-workouts list keep working unchanged.
//
// Scoring engines are shared with the mobile app by relative import (single copy, pure TS, no RN imports).
// ponytail: move them to packages/core if a third consumer appears.
import { query } from '../db';
import { computeReadiness, type HrvDay } from '../../../mobile/services/readinessEngine';
import { computeSleepResults, type NightSleep } from '../../../mobile/services/sleepEngine';
import { computeFitnessAge } from '../../../mobile/services/fitnessAgeEngine';
import { METRICS, METRIC_UNITS, type Metric, type Source } from './metrics';
import { dayOf, effectiveOrder, pickWorkouts, resolveDay, type Conn, type OriginMap, type Resolved, type Row } from './resolve';

/** Must match dayOf() in resolve.ts. */
const DAY_SQL = `((start_at AT TIME ZONE 'UTC') + (tz_offset_minutes + CASE WHEN metric = 'sleep' THEN 720 ELSE 0 END) * interval '1 minute')::date`;

const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
const LEGACY_SOURCE: Record<Source, string> = { healthkit: 'apple_health', health_connect: 'google_health', google_health: 'google_health' };

type ConnRow = { id: string; source: Source; granted_metrics: Metric[] };

export async function recompute(userId: string, dates: string[] | null) {
  // Disconnected sources keep their samples but drop out of every order.
  const conns = await query<ConnRow>(
    `SELECT id, source, granted_metrics FROM connections WHERE user_id = $1 AND status <> 'not_connected'`, [userId]);
  const active = conns.map((c) => ({ id: c.id, source: c.source, supports: c.granted_metrics }));
  const prefs = new Map((await query<{ metric: Metric; connection_order: string[] }>(
    'SELECT metric, connection_order FROM metric_preferences WHERE user_id = $1', [userId])).map((p) => [p.metric, p.connection_order]));
  const origins: OriginMap = new Map((await query<{ origin_app: string; mirrors_source: Source | null }>(
    'SELECT origin_app, mirrors_source FROM origin_map')).map((o) => [o.origin_app, o.mirrors_source]));

  const wanted = dates ?? (await query<{ d: string }>(
    `SELECT DISTINCT ${DAY_SQL}::text AS d FROM samples WHERE user_id = $1 AND deleted_at IS NULL`, [userId])).map((r) => r.d);
  if (!wanted.length) {
    if (dates === null) await query('DELETE FROM daily_summaries WHERE user_id = $1', [userId]);
    return { dates: 0 };
  }
  // Workouts straddling midnight and the 80% overlap rule look one day either side.
  const from = addDays(wanted.reduce((a, b) => (a < b ? a : b)), -1);
  const to = addDays(wanted.reduce((a, b) => (a > b ? a : b)), 1);

  const rows = await query<Row>(
    `SELECT connection_id, metric, variant, value, start_at, end_at, origin_app, origin_id, payload, ${DAY_SQL}::text AS local_date
     FROM samples WHERE user_id = $1 AND deleted_at IS NULL AND ${DAY_SQL} BETWEEN $2 AND $3`, [userId, from, to]);
  const byDay = new Map<string, Row[]>();
  for (const r of rows) byDay.set(r.local_date, [...(byDay.get(r.local_date) ?? []), r]);

  const orderFor = (m: Metric): Conn[] => effectiveOrder(prefs.get(m), active, m);
  const out = new Map<string, Map<Metric, Resolved>>(); // date -> metric -> resolved
  const sums: unknown[][] = [];
  for (const date of wanted) {
    const dayRows = byDay.get(date) ?? [];
    const m = new Map<Metric, Resolved>();
    for (const metric of METRICS) {
      const r = metric === 'workouts' ? NO_WORKOUT_SUMMARY(dayRows, orderFor(metric), origins) : resolveDay(metric, orderFor(metric), dayRows, origins);
      if (r.connectionId) {
        m.set(metric, r);
        sums.push([userId, date, metric, r.value, METRIC_UNITS[metric], r.connectionId, r.variant, r.payload]);
      }
    }
    out.set(date, m);
  }

  // Rewrite exactly the requested days: stale rows (e.g. after a preference change) must not linger.
  await query('DELETE FROM daily_summaries WHERE user_id = $1 AND local_date = ANY($2::date[])', [userId, wanted]);
  if (sums.length) {
    await query(
      `INSERT INTO daily_summaries (user_id, local_date, metric, value, unit, connection_id, variant, payload)
       SELECT $1, r.local_date, r.metric, r.value, r.unit, r.connection_id, r.variant, r.payload
       FROM jsonb_to_recordset($2::jsonb) AS r(local_date date, metric text, value double precision, unit text, connection_id uuid, variant text, payload jsonb)`,
      [userId, JSON.stringify(sums.map(([, d, m, v, u, c, vr, p]) => ({ local_date: d, metric: m, value: v, unit: u, connection_id: c, variant: vr, payload: p })))]
    );
  }

  await projectWorkouts(userId, rows, orderFor('workouts'), origins, conns);
  await projectVitals(userId, wanted, conns);
  return { dates: wanted.length };
}

/** Workouts day summary = total duration + count; the sessions themselves go to workout_logs. */
function NO_WORKOUT_SUMMARY(dayRows: Row[], order: Conn[], origins: OriginMap): Resolved {
  const { kept } = pickWorkouts(order, dayRows, origins);
  if (!kept.length) return { value: null, variant: null, connectionId: null, payload: null };
  const sec = kept.reduce((s, w) => s + Number(w.payload?.durationSec ?? w.value ?? 0), 0);
  return { value: sec, variant: null, connectionId: kept[0]!.connection_id, payload: { count: kept.length } };
}

async function projectWorkouts(userId: string, rows: Row[], order: Conn[], origins: OriginMap, conns: ConnRow[]) {
  const all = rows.filter((r) => r.metric === 'workouts');
  const { kept, dropped } = pickWorkouts(order, all, origins);
  const src = new Map(conns.map((c) => [c.id, c.source]));
  const rec = (w: Row) => {
    const p = w.payload ?? {};
    const dur = Math.round(Number(p.durationSec ?? w.value ?? 0));
    return {
      external_id: w.origin_id, source: LEGACY_SOURCE[src.get(w.connection_id)!], workout_type: String(p.type ?? 'workout'),
      start_time: new Date(w.start_at).toISOString(), end_time: new Date(w.end_at).toISOString(), duration_seconds: dur,
      active_calories: Math.round(Number(p.activeCalories ?? 0)), avg_heart_rate: p.avgHr ?? null, max_heart_rate: p.maxHr ?? null,
    };
  };
  if (kept.length) {
    await query(
      `INSERT INTO workout_logs (user_id, external_id, source, workout_type, start_time, end_time, duration_seconds, active_calories,
         avg_heart_rate, max_heart_rate, zone3_seconds, deduped_status)
       SELECT $1, r.external_id, r.source, r.workout_type, r.start_time, r.end_time, r.duration_seconds, r.active_calories,
         r.avg_heart_rate, r.max_heart_rate, r.duration_seconds, 'active'
       FROM jsonb_to_recordset($2::jsonb) AS r(external_id text, source text, workout_type text, start_time timestamptz, end_time timestamptz,
         duration_seconds int, active_calories int, avg_heart_rate int, max_heart_rate int)
       ON CONFLICT (user_id, external_id) WHERE external_id IS NOT NULL DO UPDATE SET workout_type = EXCLUDED.workout_type,
         start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, duration_seconds = EXCLUDED.duration_seconds,
         active_calories = EXCLUDED.active_calories, avg_heart_rate = EXCLUDED.avg_heart_rate, max_heart_rate = EXCLUDED.max_heart_rate,
         zone3_seconds = EXCLUDED.duration_seconds, deduped_status = 'active'`,
      [userId, JSON.stringify(kept.map(rec))]
    );
  }
  const losers = dropped.map((w) => w.origin_id);
  if (losers.length) await query(`UPDATE workout_logs SET deduped_status = 'duplicate' WHERE user_id = $1 AND external_id = ANY($2)`, [userId, losers]);
  // Tombstoned workouts disappear from the Previous workouts list.
  await query(
    `DELETE FROM workout_logs w USING samples s WHERE w.user_id = $1 AND s.user_id = $1 AND s.metric = 'workouts'
       AND s.deleted_at IS NOT NULL AND w.external_id = s.origin_id`, [userId]);
}

async function projectVitals(userId: string, dates: string[], conns: ConnRow[]) {
  const first = dates.reduce((a, b) => (a < b ? a : b));
  const last = dates.reduce((a, b) => (a > b ? a : b));
  const hist = await query<{ local_date: string; metric: Metric; value: number; variant: string | null; connection_id: string; payload: any }>(
    `SELECT local_date::text, metric, value, variant, connection_id, payload FROM daily_summaries
     WHERE user_id = $1 AND metric IN ('sleep','hrv','resting_hr','weight') AND local_date BETWEEN $2 AND $3 ORDER BY local_date`,
    [userId, addDays(first, -60), last]);
  const at = (m: Metric) => new Map(hist.filter((h) => h.metric === m).map((h) => [h.local_date, h]));
  const sleep = at('sleep'), hrv = at('hrv'), rhr = at('resting_hr'), weight = at('weight');
  const src = new Map(conns.map((c) => [c.id, c.source]));

  // Readiness per HRV variant: SDNN and RMSSD are never mixed in one baseline (docs section 10).
  const hrvDays = (variant: string | null, upTo: string): HrvDay[] =>
    [...hrv.values()].filter((h) => h.variant === variant && h.local_date <= upTo)
      .map((h) => ({ date: h.local_date, rmssdMs: h.value, rhrBpm: rhr.get(h.local_date)?.value ?? 58 }));

  // Sleep debt rolls over a 14-night window, so feed it the nights before the first requested day too.
  const nights: NightSleep[] = [...sleep.values()].filter((s) => s.value > 0).map((s) => ({
    date: s.local_date, totalAsleepSec: s.value * 60, deepSec: (s.payload?.deep ?? 0) * 60, remSec: (s.payload?.rem ?? 0) * 60,
    lightSec: (s.payload?.light ?? 0) * 60, awakeSec: (s.payload?.awake ?? 0) * 60, timeInBedSec: (s.payload?.inBed ?? 0) * 60 || null, prevDayStrain: 0,
  }));
  const sleepRes = new Map(computeSleepResults(nights).map((r, i) => [nights[i]!.date, { r, n: nights[i]! }]));

  const [profile] = await query<{ chronological_birthdate: string; sex: any; waist_cm: string | null }>(
    'SELECT chronological_birthdate, sex, waist_cm FROM user_profiles WHERE id = $1', [userId]);
  const newestRhr = [...rhr.values()].at(-1);

  for (const d of dates) {
    const h = hrv.get(d), r = rhr.get(d), s = sleepRes.get(d), w = weight.get(d);
    if (!h && !r && !s && !w) continue;
    const readiness = h ? computeReadiness(hrvDays(h.variant, d)) : null;
    const isNewest = d === (newestRhr?.local_date ?? last);
    const fit = isNewest && r && profile?.waist_cm
      ? computeFitnessAge({ age: (Date.now() - Date.parse(profile.chronological_birthdate)) / 31_557_600_000, sex: profile.sex === 'female' ? 'female' : 'male',
          waistCm: Number(profile.waist_cm), restingHrBpm: r.value, huntPaIndex: 10 }) // ponytail: no hunt_pa_index column yet, 10 as before
      : null;
    await query(
      `INSERT INTO daily_vitals_summary (user_id, summary_date, readiness_tier, rhr_flag, sleep_score, sleep_need_seconds, sleep_debt_seconds,
         sleep_efficiency_pct, sleep_efficiency_label, sleep_duration_seconds, deep_sleep_seconds, rem_sleep_seconds, light_sleep_seconds,
         awake_seconds, time_in_bed_seconds, overnight_hrv_rmssd, resting_heart_rate, hrv_variant, sleep_source, hrv_source, rhr_source,
         vo2max_ml_kg_min, fitness_age, scale_weight_kg, weight_source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
       ON CONFLICT (user_id, summary_date) DO UPDATE SET
         readiness_tier = EXCLUDED.readiness_tier, rhr_flag = EXCLUDED.rhr_flag, sleep_score = EXCLUDED.sleep_score,
         sleep_need_seconds = EXCLUDED.sleep_need_seconds, sleep_debt_seconds = EXCLUDED.sleep_debt_seconds,
         sleep_efficiency_pct = EXCLUDED.sleep_efficiency_pct, sleep_efficiency_label = EXCLUDED.sleep_efficiency_label,
         sleep_duration_seconds = EXCLUDED.sleep_duration_seconds, deep_sleep_seconds = EXCLUDED.deep_sleep_seconds,
         rem_sleep_seconds = EXCLUDED.rem_sleep_seconds, light_sleep_seconds = EXCLUDED.light_sleep_seconds,
         awake_seconds = EXCLUDED.awake_seconds, time_in_bed_seconds = EXCLUDED.time_in_bed_seconds,
         overnight_hrv_rmssd = EXCLUDED.overnight_hrv_rmssd, resting_heart_rate = EXCLUDED.resting_heart_rate,
         hrv_variant = EXCLUDED.hrv_variant, sleep_source = EXCLUDED.sleep_source, hrv_source = EXCLUDED.hrv_source, rhr_source = EXCLUDED.rhr_source,
         vo2max_ml_kg_min = COALESCE(EXCLUDED.vo2max_ml_kg_min, daily_vitals_summary.vo2max_ml_kg_min),
         fitness_age = COALESCE(EXCLUDED.fitness_age, daily_vitals_summary.fitness_age),
         scale_weight_kg = COALESCE(EXCLUDED.scale_weight_kg, daily_vitals_summary.scale_weight_kg),
         weight_source = COALESCE(EXCLUDED.weight_source, daily_vitals_summary.weight_source)`,
      [userId, d, readiness?.tier ?? null, readiness?.rhrFlag ?? false,
        s?.r.score ?? null, s?.r.needSec ?? null, s?.r.debtSec ?? null, s?.r.efficiencyPct ?? null, s?.r.efficiencyLabel ?? null,
        s ? Math.round(s.n.totalAsleepSec) : null, s ? Math.round(s.n.deepSec) : null, s ? Math.round(s.n.remSec) : null,
        s ? Math.round(s.n.lightSec) : null, s ? Math.round(s.n.awakeSec) : null, s?.n.timeInBedSec ? Math.round(s.n.timeInBedSec) : null,
        h ? Math.round(h.value * 10) / 10 : null, r ? Math.round(r.value) : null, h?.variant ?? null,
        s ? src.get(sleep.get(d)!.connection_id) ?? null : null, h ? src.get(h.connection_id) ?? null : null, r ? src.get(r.connection_id) ?? null : null,
        fit?.vo2maxMlKgMin ? Math.round(fit.vo2maxMlKgMin * 10) / 10 : null, fit?.fitnessAge ? Math.round(fit.fitnessAge * 10) / 10 : null,
        w ? Math.round(w.value * 100) / 100 : null, w ? LEGACY_SOURCE[src.get(w.connection_id)!] : null]
    );
  }
}

export { dayOf };
