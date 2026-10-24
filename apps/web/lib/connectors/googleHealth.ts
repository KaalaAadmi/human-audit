// Google Health API v4 client + mappers (docs/data-connectors.md section 8). Backend only: tokens never leave the server.
import { query } from '../db';
import { decrypt, encrypt } from './crypto';
import { HttpError } from './store';
import type { Metric, SampleInput } from './metrics';

const API = 'https://health.googleapis.com/v4';
export const SCOPE_PREFIX = 'https://www.googleapis.com/auth/googlehealth';
export const SCOPES = ['.sleep.readonly', '.health_metrics_and_measurements.readonly', '.activity_and_fitness.readonly'].map((s) => SCOPE_PREFIX + s);

/** Metrics each scope unlocks. heart_rate is not synced from Google in v1 (1 s resolution = tens of thousands of points/day). */
export const SCOPE_METRICS: Record<string, Metric[]> = {
  [SCOPE_PREFIX + '.sleep.readonly']: ['sleep'],
  [SCOPE_PREFIX + '.health_metrics_and_measurements.readonly']: ['hrv', 'resting_hr', 'weight'],
  [SCOPE_PREFIX + '.activity_and_fitness.readonly']: ['steps', 'active_energy', 'workouts'],
};
export const metricsForScopes = (scopes: string[]): Metric[] => [...new Set(scopes.flatMap((s) => SCOPE_METRICS[s] ?? []))];

type Fetcher = { path: string; field: string; kind: 'civil' | 'date' | 'physical' | 'rollup'; family: 'google-wearables' | 'google-sources' };
export const FETCH: Partial<Record<Metric, Fetcher>> = {
  sleep: { path: 'sleep', field: 'sleep.interval.civil_end_time', kind: 'civil', family: 'google-wearables' },
  hrv: { path: 'daily-heart-rate-variability', field: 'daily_heart_rate_variability.date', kind: 'date', family: 'google-wearables' },
  resting_hr: { path: 'daily-resting-heart-rate', field: 'daily_resting_heart_rate.date', kind: 'date', family: 'google-wearables' },
  workouts: { path: 'exercise', field: 'exercise.interval.civil_start_time', kind: 'civil', family: 'google-wearables' },
  weight: { path: 'weight', field: 'weight.sample_time.physical_time', kind: 'physical', family: 'google-sources' },
  steps: { path: 'steps', field: '', kind: 'rollup', family: 'google-wearables' },
  active_energy: { path: 'active-energy-burned', field: '', kind: 'rollup', family: 'google-wearables' },
};
/** Webhook dataType (kebab) -> metric. active-energy-burned has no webhook; it is polled. */
export const WEBHOOK_METRIC: Record<string, Metric> = {
  sleep: 'sleep', 'daily-heart-rate-variability': 'hrv', 'daily-resting-heart-rate': 'resting_hr', steps: 'steps', exercise: 'workouts', weight: 'weight',
};

// ---------- token handling ----------
type TokenRow = { refresh_token_enc: Buffer; access_token_enc: Buffer | null; access_token_expires_at: Date | null };

export async function exchangeCode(code: string) {
  return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: process.env.GOOGLE_HEALTH_REDIRECT_URI ?? '' });
}

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_HEALTH_CLIENT_ID ?? '', client_secret: process.env.GOOGLE_HEALTH_CLIENT_SECRET ?? '', ...params }),
  });
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string };
  if (!res.ok || !j.access_token) throw Object.assign(new Error(`token endpoint: ${j.error ?? res.status}`), { oauthError: j.error });
  return j as Required<Pick<typeof j, 'access_token'>> & typeof j;
}

export class NeedsReauth extends Error {}

/** Valid access token for the connection; refreshes on demand (no batch refresh cron). invalid_grant -> needs_reauth. */
export async function accessToken(connectionId: string): Promise<string> {
  const [t] = await query<TokenRow>('SELECT refresh_token_enc, access_token_enc, access_token_expires_at FROM oauth_tokens WHERE connection_id = $1', [connectionId]);
  if (!t) throw new NeedsReauth('no tokens stored');
  if (t.access_token_enc && t.access_token_expires_at && t.access_token_expires_at.getTime() > Date.now() + 60_000) return decrypt(t.access_token_enc);
  try {
    const j = await tokenRequest({ grant_type: 'refresh_token', refresh_token: decrypt(t.refresh_token_enc) });
    await query('UPDATE oauth_tokens SET access_token_enc = $2, access_token_expires_at = now() + make_interval(secs => $3) WHERE connection_id = $1',
      [connectionId, encrypt(j.access_token), j.expires_in ?? 3600]);
    return j.access_token;
  } catch (e) {
    if ((e as { oauthError?: string }).oauthError === 'invalid_grant') {
      await query(`UPDATE connections SET status = 'needs_reauth' WHERE id = $1`, [connectionId]);
      throw new NeedsReauth('refresh token revoked or expired');
    }
    throw e;
  }
}

async function gh<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API + path, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...init?.headers } });
    if (res.ok) return (await res.json()) as T;
    if ((res.status === 429 || res.status === 504) && attempt < 3) { await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt)); continue; }
    throw new HttpError(res.status === 401 ? 401 : 502, `google health ${path.split('?')[0]}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
}

/** `users/me/identity`. Returns null when the Google account is not linked to a Google Health account. */
export async function identity(token: string): Promise<{ healthUserId: string; legacyUserId?: string } | null> {
  const res = await fetch(`${API}/users/me/identity`, { headers: { authorization: `Bearer ${token}` } });
  if (res.status === 400 && (await res.text()).includes('ACCOUNT_NOT_LINKED')) return null;
  if (!res.ok) throw new HttpError(502, `identity: ${res.status}`);
  return (await res.json()) as { healthUserId: string; legacyUserId?: string };
}

// ---------- mappers (pure) ----------
type Civil = { date: { year: number; month: number; day: number }; time?: { hours?: number; minutes?: number; seconds?: number } };
type Interval = { startTime: string; endTime: string; startUtcOffset?: string; endUtcOffset?: string };
const offMin = (d?: string) => (d ? Math.round(parseFloat(d) / 60) : 0); // "-14400s" -> -240
const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: { year: number; month: number; day: number }) => `${d.year}-${pad(d.month)}-${pad(d.day)}`;
const num = (s: string | number | undefined) => (s === undefined ? NaN : Number(s)); // int64 arrives as a string

const GH = { originApp: 'google_health' } as const;
const base = { originApp: GH.originApp, originDevice: null };

/** Daily records carry only a date: pin to local noon so any offset keeps it on that date. */
const noon = (date: string) => ({ startAt: `${date}T12:00:00.000Z`, endAt: `${date}T12:00:00.000Z`, tzOffsetMinutes: 0 });

const STAGE_KEY: Record<string, 'deep' | 'rem' | 'light' | 'awake'> = { DEEP: 'deep', REM: 'rem', LIGHT: 'light', ASLEEP: 'light', RESTLESS: 'awake', AWAKE: 'awake' };

export function mapPoint(metric: Metric, p: any): SampleInput | null {
  const id = String(p.dataPointName ?? '');
  switch (metric) {
    case 'sleep': {
      const s = p.sleep;
      if (!s?.interval) return null;
      const stages = { deep: 0, rem: 0, light: 0, awake: 0 };
      for (const st of s.summary?.stagesSummary ?? []) { const k = STAGE_KEY[st.type]; if (k) stages[k] += num(st.minutes) || 0; }
      const asleep = num(s.summary?.minutesAsleep);
      return { ...base, metric, value: Number.isFinite(asleep) ? asleep : stages.deep + stages.rem + stages.light, unit: 'min', startAt: s.interval.startTime, endAt: s.interval.endTime,
        tzOffsetMinutes: offMin(s.interval.endUtcOffset), originId: id, payload: { stages, inBed: num(s.summary?.minutesInSleepPeriod) || null, type: s.type } };
    }
    case 'hrv': {
      const h = p.dailyHeartRateVariability;
      if (!h?.date || typeof h.averageHeartRateVariabilityMilliseconds !== 'number') return null;
      return { ...base, metric, variant: 'rmssd', value: h.averageHeartRateVariabilityMilliseconds, unit: 'ms', ...noon(ymd(h.date)), originId: id, payload: null };
    }
    case 'resting_hr': {
      const r = p.dailyRestingHeartRate;
      const v = num(r?.beatsPerMinute);
      if (!r?.date || !Number.isFinite(v)) return null;
      return { ...base, metric, value: v, unit: 'bpm', ...noon(ymd(r.date)), originId: id, payload: null };
    }
    case 'weight': {
      const w = p.weight;
      if (!w?.sampleTime?.physicalTime || typeof w.weightGrams !== 'number') return null;
      return { ...base, metric, value: w.weightGrams / 1000, unit: 'kg', startAt: w.sampleTime.physicalTime, endAt: w.sampleTime.physicalTime,
        tzOffsetMinutes: offMin(w.sampleTime.utcOffset), originId: id, payload: null };
    }
    case 'workouts': {
      const e = p.exercise as { interval?: Interval; exerciseType?: string; displayName?: string; activeDuration?: string; metricsSummary?: any } | undefined;
      if (!e?.interval) return null;
      const dur = Math.round((Date.parse(e.interval.endTime) - Date.parse(e.interval.startTime)) / 1000);
      const m = e.metricsSummary ?? {};
      return { ...base, metric, value: dur, unit: 's', startAt: e.interval.startTime, endAt: e.interval.endTime, tzOffsetMinutes: offMin(e.interval.startUtcOffset), originId: id,
        payload: { type: (e.exerciseType ?? 'workout').toLowerCase(), name: e.displayName ?? null, durationSec: dur, activeCalories: m.caloriesKcal ?? 0,
          avgHr: Number.isFinite(num(m.averageHeartRateBeatsPerMinute)) ? num(m.averageHeartRateBeatsPerMinute) : null, maxHr: null } };
    }
    default: return null;
  }
}

/** dailyRollUp points -> one sample per local day (steps countSum / active energy kcalSum). */
export function mapRollup(metric: 'steps' | 'active_energy', p: any): SampleInput | null {
  const date = p.civilStartTime?.date;
  const v = metric === 'steps' ? num(p.steps?.countSum) : p.activeEnergyBurned?.kcalSum;
  if (!date || typeof v !== 'number' || !Number.isFinite(v)) return null; // no data stays null, never 0
  return { ...base, metric, value: v, unit: metric === 'steps' ? 'count' : 'kcal', ...noon(ymd(date)), originId: `${metric}:${ymd(date)}`, payload: null };
}

// ---------- fetching ----------
const fmtFilter = (f: Fetcher, from: string, to: string) => {
  const q = (v: string) => `"${v}"`;
  const [a, b] = f.kind === 'physical' ? [`${from}T00:00:00Z`, `${to}T00:00:00Z`] : f.kind === 'civil' ? [`${from}T00:00:00`, `${to}T00:00:00`] : [from, to];
  return `${f.field} >= ${q(a)} AND ${f.field} < ${q(b)}`; // only >= and < joined with AND
};

const civilDate = (d: string) => { const [year, month, day] = d.split('-').map(Number); return { date: { year, month, day }, time: { hours: 0, minutes: 0, seconds: 0 } }; };

/** All points for one metric in [from, to) (YYYY-MM-DD), following nextPageToken. */
export async function fetchMetric(token: string, metric: Metric, from: string, to: string): Promise<SampleInput[]> {
  const f = FETCH[metric];
  if (!f) return [];
  const out: SampleInput[] = [];
  const family = `users/me/dataSourceFamilies/${f.family}`;
  if (f.kind === 'rollup') {
    // Rollup ranges are capped (14 days for some types), so chunk to 14.
    for (let a = from; a < to; ) {
      const b = new Date(Math.min(Date.parse(a) + 14 * 86_400_000, Date.parse(to))).toISOString().slice(0, 10);
      let pageToken: string | undefined;
      do {
        const r = await gh<{ rollupDataPoints?: any[]; nextPageToken?: string }>(token, `/users/me/dataTypes/${f.path}/dataPoints:dailyRollUp`, {
          method: 'POST', body: JSON.stringify({ range: { start: civilDate(a), end: civilDate(b) }, windowSizeDays: 1, dataSourceFamily: family, pageToken }) });
        for (const p of r.rollupDataPoints ?? []) { const s = mapRollup(metric as 'steps' | 'active_energy', p); if (s) out.push(s); }
        pageToken = r.nextPageToken || undefined;
      } while (pageToken);
      a = b;
    }
    return out;
  }
  let pageToken: string | undefined;
  do {
    const qs = new URLSearchParams({ dataSourceFamily: family, filter: fmtFilter(f, from, to), ...(pageToken ? { pageToken } : {}) });
    const r = await gh<{ dataPoints?: any[]; nextPageToken?: string }>(token, `/users/me/dataTypes/${f.path}/dataPoints:reconcile?${qs}`);
    for (const p of r.dataPoints ?? []) { const s = mapPoint(metric, p); if (s) out.push(s); }
    pageToken = r.nextPageToken || undefined;
  } while (pageToken);
  return out;
}
