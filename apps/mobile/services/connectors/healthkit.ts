// Apple Health collector (docs/data-connectors.md section 6). iOS only: the library is required lazily so Android never loads it.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getCursors, putCursor, upload } from './api';
import { DEFAULT_METRICS, METRIC_UNIT, hkSleep, snake, tzOf, type Connection, type Metric, type SampleInput } from './model';

const getHK = () => require('@kingstinct/react-native-healthkit') as typeof import('@kingstinct/react-native-healthkit');

const PAGE = 500;
const BACKFILL_DAYS = 30;
const DAY = 864e5;

type Kind = 'quantity' | 'category' | 'workout';
const TYPES: Record<Metric, { id: string; kind: Kind; unit?: string }> = {
  sleep: { id: 'HKCategoryTypeIdentifierSleepAnalysis', kind: 'category' },
  // HealthKit has SDNN only; there is no RMSSD type.
  hrv: { id: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN', kind: 'quantity', unit: 'ms' },
  resting_hr: { id: 'HKQuantityTypeIdentifierRestingHeartRate', kind: 'quantity', unit: 'count/min' },
  heart_rate: { id: 'HKQuantityTypeIdentifierHeartRate', kind: 'quantity', unit: 'count/min' },
  steps: { id: 'HKQuantityTypeIdentifierStepCount', kind: 'quantity', unit: 'count' },
  active_energy: { id: 'HKQuantityTypeIdentifierActiveEnergyBurned', kind: 'quantity', unit: 'kcal' },
  weight: { id: 'HKQuantityTypeIdentifierBodyMass', kind: 'quantity', unit: 'kg' },
  workouts: { id: 'HKWorkoutTypeIdentifier', kind: 'workout' },
};
// Sleep, HRV and resting HR are what the readiness score waits on; steps can lag an hour.
const URGENT: Metric[] = ['sleep', 'hrv', 'resting_hr'];

// ponytail: the library's generics are per-identifier; one loose shape keeps the three query kinds in one loop.
type Page = { samples: any[]; deletedSamples: { uuid: string }[]; newAnchor: string };

export const hkAvailable = async () => Platform.OS === 'ios' && (await getHK().isHealthDataAvailableAsync().catch(() => false));

/** Shows the permission sheet for these metrics. HealthKit never reveals a denial, so "granted" = "asked". */
export async function hkAuthorize(metrics: Metric[]): Promise<Metric[]> {
  await getHK().requestAuthorization({ toRead: metrics.map((m) => TYPES[m].id) as any });
  await rememberMetrics(metrics);
  return metrics;
}

async function fetchPage(metric: Metric, anchor: string | undefined, filter: object | undefined): Promise<Page> {
  const HK = getHK();
  const t = TYPES[metric];
  const opts = { anchor, filter, limit: PAGE };
  if (t.kind === 'workout') {
    const r = await HK.queryWorkoutSamplesWithAnchor(opts as any);
    return { samples: [...r.workouts], deletedSamples: [...r.deletedSamples], newAnchor: r.newAnchor };
  }
  const r: any = t.kind === 'category'
    ? await HK.queryCategorySamplesWithAnchor(t.id as any, opts as any)
    : await HK.queryQuantitySamplesWithAnchor(t.id as any, { ...opts, unit: t.unit } as any);
  return { samples: [...r.samples], deletedSamples: [...r.deletedSamples], newAnchor: r.newAnchor };
}

async function workoutSample(HK: ReturnType<typeof getHK>, w: any): Promise<SampleInput> {
  const start = w.startDate as Date;
  const end = w.endDate as Date;
  const durationSec = Math.round(w.duration?.quantity ?? (end.getTime() - start.getTime()) / 1000);
  const hr = await HK.queryStatisticsForQuantity('HKQuantityTypeIdentifierHeartRate', ['discreteAverage', 'discreteMax'], {
    filter: { date: { startDate: start, endDate: end } }, unit: 'count/min',
  }).catch(() => null);
  return {
    metric: 'workouts', value: durationSec, unit: METRIC_UNIT.workouts,
    startAt: start.toISOString(), endAt: end.toISOString(), tzOffsetMinutes: tzOf(start),
    originApp: w.sourceRevision?.source?.bundleIdentifier ?? null, originDevice: w.device?.name ?? w.device?.model ?? null, originId: w.uuid,
    payload: {
      type: snake(String((HK.WorkoutActivityType as any)[w.workoutActivityType] ?? 'unknown')),
      durationSec,
      activeCalories: Math.round(w.totalEnergyBurned?.quantity ?? 0),
      avgHr: hr?.averageQuantity ? Math.round(hr.averageQuantity.quantity) : null,
      maxHr: hr?.maximumQuantity ? Math.round(hr.maximumQuantity.quantity) : null,
    },
  };
}

async function normalize(metric: Metric, raw: any[], own: string): Promise<SampleInput[]> {
  const HK = getHK();
  // Backend rejects anything more than 5 minutes ahead; drop it here so one odd sample cannot fail a whole page.
  const limit = Date.now() + 4 * 60000;
  const rows = raw.filter((s) => s.sourceRevision?.source?.bundleIdentifier !== own && (s.endDate as Date).getTime() <= limit);
  if (metric === 'workouts') {
    const out: SampleInput[] = [];
    for (let i = 0; i < rows.length; i += 25) out.push(...(await Promise.all(rows.slice(i, i + 25).map((w) => workoutSample(HK, w)))));
    return out;
  }
  const out: SampleInput[] = [];
  for (const s of rows) {
    const start = s.startDate as Date;
    const end = s.endDate as Date;
    const sleep = metric === 'sleep' ? hkSleep(s.value, start, end) : null;
    if (metric === 'sleep' && !sleep) continue;
    out.push({
      metric, variant: metric === 'hrv' ? 'sdnn' : undefined,
      value: sleep ? sleep.value : s.quantity, unit: METRIC_UNIT[metric],
      startAt: start.toISOString(), endAt: end.toISOString(), tzOffsetMinutes: tzOf(start),
      originApp: s.sourceRevision?.source?.bundleIdentifier ?? null, originDevice: s.device?.name ?? s.device?.model ?? null, originId: s.uuid,
      payload: sleep?.payload ?? null,
    });
  }
  return out;
}

/** Anchored pull for one metric: upload, then save the anchor, then repeat while pages come back full. */
async function syncMetric(conn: Connection, deviceId: string, metric: Metric, saved: string | undefined, own: string) {
  const backfill = () => ({ date: { startDate: new Date(Date.now() - BACKFILL_DAYS * DAY), endDate: new Date() } });
  let anchor = saved;
  let filter: object | undefined = anchor ? undefined : backfill();
  for (;;) {
    let page: Page;
    try {
      page = await fetchPage(metric, anchor, filter);
    } catch (e) {
      if (!anchor) throw e;
      // v16 throws on an anchor it cannot decode instead of re-running the whole query: restart from a 30-day backfill.
      anchor = undefined;
      filter = backfill();
      continue;
    }
    const samples = await normalize(metric, page.samples, own);
    await upload(conn.id, deviceId, samples, page.deletedSamples.map((d) => ({ originId: d.uuid, metric })));
    if (page.newAnchor !== anchor) await putCursor(conn.id, metric, page.newAnchor);
    anchor = page.newAnchor;
    filter = undefined;
    if (page.samples.length < PAGE) return;
  }
}

/** Pulls every granted metric. Skips quietly while the phone is locked (HealthKit is unreadable); the next unlocked run catches up. */
export async function hkSync(conn: Connection, deviceId: string) {
  const HK = getHK();
  if (!(await HK.isProtectedDataAvailableAsync())) return;
  const own = HK.currentAppSource().bundleIdentifier;
  const cursors = await getCursors(conn.id);
  let failure: unknown;
  for (const metric of conn.grantedMetrics) {
    try {
      await syncMetric(conn, deviceId, metric, cursors.get(metric), own);
    } catch (e) {
      failure ??= e; // keep going: one bad type should not block sleep because steps failed
    }
  }
  if (failure) throw failure;
}

// ---------- background delivery ----------
// Subscriptions must exist when iOS launches the app in the background, before any screen mounts, so the enabled
// metrics are persisted locally and re-subscribed at module scope (docs section 6, "Background").
const KEY = 'humanaudit_hk_metrics';
const subs = new Map<Metric, { remove: () => void }>();
let onChange: (() => void) | null = null;

/** The orchestrator sets this; it avoids a circular import and keeps this file ignorant of throttling. */
export const onHealthKitChange = (fn: () => void) => { onChange = fn; };

async function rememberMetrics(metrics: Metric[]) {
  await SecureStore.setItemAsync(KEY, JSON.stringify(metrics));
  await subscribe(metrics);
}

export async function hkForget() {
  for (const s of subs.values()) s.remove();
  subs.clear();
  await SecureStore.deleteItemAsync(KEY);
}

async function subscribe(metrics: Metric[]) {
  const HK = getHK();
  for (const m of metrics) {
    if (subs.has(m)) continue;
    const t = TYPES[m];
    subs.set(m, HK.subscribeToChanges(t.id as any, () => onChange?.()));
    // ponytail: failure here only costs background wake-ups; foreground sync still works.
    await HK.enableBackgroundDelivery(t.id as any, URGENT.includes(m) ? HK.UpdateFrequency.immediate : HK.UpdateFrequency.hourly).catch(() => false);
  }
}

if (Platform.OS === 'ios') {
  SecureStore.getItemAsync(KEY)
    .then((v) => {
      const saved = v ? (JSON.parse(v) as Metric[]).filter((m) => DEFAULT_METRICS.includes(m) || m === 'heart_rate') : [];
      return saved.length ? subscribe(saved) : undefined;
    })
    .catch(() => undefined);
}
