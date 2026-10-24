// Health Connect collector (docs/data-connectors.md section 7). Android only; the library is required lazily.
// NOT TESTED on a device: written against react-native-health-connect 4.1.3 typings.
import { Platform } from 'react-native';
import { getCursors, putCursor, upload } from './api';
import { METRIC_UNIT, hcSleep, snake, tzOf, type Connection, type Metric, type SampleInput } from './model';

const getHC = () => require('react-native-health-connect') as typeof import('react-native-health-connect');

const OWN_PACKAGE = 'com.kaalaaadmi.humanaudit';
const PAGE = 500;
const BACKFILL_DAYS = 30;
const DAY = 864e5;
/** An expired changes token (Health Connect keeps them ~30 days) re-reads from the last sync minus this margin. */
const MARGIN = 2 * DAY;

const RECORD: Record<Metric, string> = {
  sleep: 'SleepSession', hrv: 'HeartRateVariabilityRmssd', resting_hr: 'RestingHeartRate', heart_rate: 'HeartRate',
  steps: 'Steps', active_energy: 'ActiveCaloriesBurned', workouts: 'ExerciseSession', weight: 'Weight',
};

export async function hcStatus(): Promise<'available' | 'update_required' | 'unavailable'> {
  if (Platform.OS !== 'android') return 'unavailable';
  const HC = getHC();
  const s = await HC.getSdkStatus();
  if (s === HC.SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
  return s === HC.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED ? 'update_required' : 'unavailable';
}

/** Metrics the user has actually granted (the sheet can be partially accepted). */
export async function hcGranted(): Promise<Metric[]> {
  const HC = getHC();
  if (!(await HC.initialize())) return [];
  const have = new Set((await HC.getGrantedPermissions()).filter((p: any) => p.accessType === 'read').map((p: any) => p.recordType));
  return (Object.keys(RECORD) as Metric[]).filter((m) => have.has(RECORD[m]));
}

export async function hcAuthorize(metrics: Metric[]): Promise<Metric[]> {
  const HC = getHC();
  if (!(await HC.initialize())) return [];
  await HC.requestPermission([
    ...metrics.map((m) => ({ accessType: 'read' as const, recordType: RECORD[m] as any })),
    { accessType: 'read', recordType: 'BackgroundAccessPermission' } as any,
  ]);
  return hcGranted();
}

const exerciseNames = () => {
  const names: Record<number, string> = {};
  for (const [k, v] of Object.entries(getHC().ExerciseType as Record<string, number>)) names[v] = k;
  return names;
};

async function workoutPayload(r: any, names: Record<number, string>) {
  const HC = getHC();
  const durationSec = Math.round((Date.parse(r.endTime) - Date.parse(r.startTime)) / 1000);
  const range = { operator: 'between' as const, startTime: r.startTime, endTime: r.endTime };
  const [hr, kcal] = await Promise.all([
    HC.aggregateRecord({ recordType: 'HeartRate', timeRangeFilter: range }).catch(() => null),
    HC.aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter: range }).catch(() => null),
  ]);
  return {
    value: durationSec,
    payload: {
      type: snake(names[r.exerciseType] ?? r.title ?? 'unknown'),
      durationSec,
      activeCalories: Math.round((kcal as any)?.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? 0),
      avgHr: (hr as any)?.BPM_AVG ? Math.round((hr as any).BPM_AVG) : null,
      maxHr: (hr as any)?.BPM_MAX ? Math.round((hr as any).BPM_MAX) : null,
    },
  };
}

async function normalize(metric: Metric, records: any[]): Promise<SampleInput[]> {
  const limit = Date.now() + 4 * 60000; // backend rejects >5 min in the future
  const names = metric === 'workouts' ? exerciseNames() : {};
  const out: SampleInput[] = [];
  for (const r of records) {
    const origin = r.metadata?.dataOrigin ?? null;
    const id = r.metadata?.id;
    if (!id || origin === OWN_PACKAGE) continue;
    const base = {
      metric, unit: METRIC_UNIT[metric], originApp: origin,
      originDevice: [r.metadata?.device?.manufacturer, r.metadata?.device?.model].filter(Boolean).join(' ') || null,
    };
    const at = (iso: string, endIso = iso) => ({ startAt: new Date(iso).toISOString(), endAt: new Date(endIso).toISOString() });
    const tz = (iso: string) => (r.zoneOffset ? Math.round(r.zoneOffset.totalSeconds / 60) : tzOf(new Date(iso)));
    if (Date.parse(r.endTime ?? r.time) > limit) continue;
    switch (metric) {
      case 'sleep': {
        const s = hcSleep(r.startTime, r.endTime, r.stages);
        out.push({ ...base, ...at(r.startTime, r.endTime), tzOffsetMinutes: tz(r.startTime), originId: id, value: s.value, payload: s.payload });
        break;
      }
      case 'workouts': {
        const w = await workoutPayload(r, names);
        out.push({ ...base, ...at(r.startTime, r.endTime), tzOffsetMinutes: tz(r.startTime), originId: id, ...w });
        break;
      }
      case 'heart_rate':
        // One record holds many samples; the sample time makes each origin id unique.
        for (const s of r.samples ?? []) out.push({ ...base, ...at(s.time), tzOffsetMinutes: tz(s.time), originId: `${id}:${s.time}`, value: s.beatsPerMinute });
        break;
      default: {
        const instant = r.time !== undefined;
        const start = instant ? r.time : r.startTime;
        const value =
          metric === 'hrv' ? r.heartRateVariabilityMillis
          : metric === 'resting_hr' ? r.beatsPerMinute
          : metric === 'steps' ? r.count
          : metric === 'active_energy' ? r.energy?.inKilocalories
          : r.weight?.inKilograms;
        if (typeof value !== 'number') continue;
        out.push({
          ...base, variant: metric === 'hrv' ? 'rmssd' : undefined, ...at(start, instant ? start : r.endTime),
          tzOffsetMinutes: tz(start), originId: id, value,
        });
      }
    }
  }
  return out;
}

/** Reads [from, now] page by page and uploads each page. */
async function readRange(conn: Connection, deviceId: string, metric: Metric, from: Date) {
  const HC = getHC();
  let pageToken: string | undefined;
  do {
    const res: any = await HC.readRecords(RECORD[metric] as any, {
      timeRangeFilter: { operator: 'between', startTime: from.toISOString(), endTime: new Date().toISOString() },
      pageSize: PAGE, pageToken,
    });
    await upload(conn.id, deviceId, await normalize(metric, res.records), []);
    pageToken = res.pageToken || undefined;
  } while (pageToken);
}

async function syncMetric(conn: Connection, deviceId: string, metric: Metric, token: string | undefined) {
  const HC = getHC();
  const recordTypes = [RECORD[metric]] as any;
  const fresh = async (from: Date) => {
    // Take the token first: anything written while the backfill runs then shows up in the first changes call.
    const next = (await HC.getChanges({ recordTypes })).nextChangesToken;
    await readRange(conn, deviceId, metric, from);
    await putCursor(conn.id, metric, next);
  };
  if (!token) return fresh(new Date(Date.now() - BACKFILL_DAYS * DAY));

  for (;;) {
    const r = await HC.getChanges({ changesToken: token });
    if (r.changesTokenExpired) {
      const since = conn.lastSyncAt ? Date.parse(conn.lastSyncAt) - MARGIN : Date.now() - BACKFILL_DAYS * DAY;
      return fresh(new Date(Math.max(since, Date.now() - BACKFILL_DAYS * DAY)));
    }
    // ponytail: heart_rate tombstones use the record id, but its samples are keyed `${id}:${time}`, so they do not match.
    await upload(conn.id, deviceId, await normalize(metric, r.upsertionChanges.map((c) => c.record)), r.deletionChanges.map((d) => ({ originId: d.recordId, metric })));
    await putCursor(conn.id, metric, r.nextChangesToken);
    token = r.nextChangesToken;
    if (!r.hasMore) return;
  }
}

export async function hcSync(conn: Connection, deviceId: string) {
  const HC = getHC();
  if (!(await HC.initialize())) throw new Error('Health Connect is not available');
  const granted = await hcGranted();
  const cursors = await getCursors(conn.id);
  let failure: unknown;
  for (const metric of conn.grantedMetrics.filter((m) => granted.includes(m))) {
    try {
      await syncMetric(conn, deviceId, metric, cursors.get(metric));
    } catch (e) {
      failure ??= e;
    }
  }
  if (failure) throw failure;
}
