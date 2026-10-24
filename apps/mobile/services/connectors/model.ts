// Pure types, labels, normalizers and card-state logic for the data connectors (docs/data-connectors.md sections 5, 6, 7, 11).
// No React Native imports on purpose, so `tsx services/connectors/connectors.check.ts` can run it.

export type SourceId = 'healthkit' | 'health_connect' | 'google_health';
export type Metric = 'sleep' | 'hrv' | 'resting_hr' | 'heart_rate' | 'steps' | 'active_energy' | 'workouts' | 'weight';
export type Status = 'connecting' | 'connected' | 'partial' | 'stale' | 'needs_reauth' | 'collector_missing' | 'error' | 'not_connected';
export type Platform = 'ios' | 'android';

export const SOURCES: SourceId[] = ['healthkit', 'health_connect', 'google_health'];
export const SOURCE_LABEL: Record<SourceId, string> = { healthkit: 'Apple Health', health_connect: 'Health Connect', google_health: 'Google Health' };
export const METRIC_LABEL: Record<Metric, string> = {
  sleep: 'Sleep', hrv: 'HRV', resting_hr: 'Resting HR', heart_rate: 'Heart rate', steps: 'Steps', active_energy: 'Active energy', workouts: 'Workouts', weight: 'Weight',
};
/** Canonical unit per metric; the backend rejects anything else. */
export const METRIC_UNIT: Record<Metric, string> = { sleep: 'min', hrv: 'ms', resting_hr: 'bpm', heart_rate: 'bpm', steps: 'count', active_energy: 'kcal', workouts: 's', weight: 'kg' };
// ponytail: heart_rate is supported by both adapters but off by default: tens of thousands of raw samples a month and nothing reads it yet.
export const DEFAULT_METRICS: Metric[] = ['sleep', 'hrv', 'resting_hr', 'steps', 'active_energy', 'workouts', 'weight'];

export type Connection = {
  id: string;
  source: SourceId;
  status: Status;
  collectorDeviceId: string | null;
  collectorDeviceName: string | null;
  collectorLastSeenAt: string | null;
  grantedMetrics: Metric[];
  connectedAt: string;
  lastSyncAt: string | null;
  lastSyncError: { message?: string } | null;
  backfillCompletedAt: string | null;
};

/** What a collector uploads (mirrors apps/web/lib/connectors/metrics.ts SampleInput). */
export type SampleInput = {
  metric: Metric;
  variant?: 'sdnn' | 'rmssd' | null;
  value: number | null;
  unit: string;
  startAt: string;
  endAt: string;
  tzOffsetMinutes: number;
  originApp?: string | null;
  originDevice?: string | null;
  originId: string;
  payload?: Record<string, unknown> | null;
};

// ---------- normalizers ----------
const r1 = (n: number) => Math.round(n * 10) / 10;
const minutes = (a: string | Date, b: string | Date) => (new Date(b).getTime() - new Date(a).getTime()) / 60000;

/** Offset of the device at that moment, in minutes east of UTC. ponytail: not the offset where the sample was recorded; fine unless you travel. */
export const tzOf = (d: Date) => -d.getTimezoneOffset();
/** Enum name -> snake_case, e.g. traditionalStrengthTraining -> traditional_strength_training. */
export const snake = (s: string) => s.replace(/([A-Z])/g, '_$1').toLowerCase();

/** HKCategoryValueSleepAnalysis: inBed=0, asleepUnspecified=1, awake=2, asleepCore=3, asleepDeep=4, asleepREM=5. Stage names match resolve.ts. */
const HK_STAGE = ['inbed', 'asleep', 'awake', 'light', 'deep', 'rem'];
export function hkSleep(value: number, start: Date, end: Date) {
  const stage = HK_STAGE[value];
  return stage ? { value: r1(minutes(start, end)), payload: { stage } } : null;
}

/** Health Connect SleepStageType: UNKNOWN=0, AWAKE=1, SLEEPING=2, OUT_OF_BED=3, LIGHT=4, DEEP=5, REM=6. */
const HC_STAGE: Record<number, 'awake' | 'asleep' | 'light' | 'deep' | 'rem'> = { 1: 'awake', 2: 'asleep', 4: 'light', 5: 'deep', 6: 'rem' };
export function hcSleep(startTime: string, endTime: string, stages?: { startTime: string; endTime: string; stage: number }[]) {
  const total = minutes(startTime, endTime);
  if (!stages?.length) return { value: r1(total), payload: { stage: 'asleep', inBed: r1(total) } };
  const st = { deep: 0, rem: 0, light: 0, awake: 0, asleep: 0 };
  for (const s of stages) {
    const k = HC_STAGE[s.stage];
    if (k) st[k] += minutes(s.startTime, s.endTime);
  }
  const asleep = st.deep + st.rem + st.light || st.asleep;
  return {
    value: r1(asleep),
    payload: { stages: { deep: r1(st.deep), rem: r1(st.rem), light: r1(st.light), awake: r1(st.awake), asleep: r1(st.asleep) }, inBed: r1(total) },
  };
}

// ---------- card state (section 11 table) ----------
export type CardAction = 'connect' | 'fix' | 'reconnect' | 'move' | null;
export const ACTION_LABEL: Record<Exclude<CardAction, null>, string> = { connect: 'Connect', fix: 'Fix', reconnect: 'Reconnect', move: 'Move to this device' };
export const HOME_PLATFORM: Record<SourceId, Platform | null> = { healthkit: 'ios', health_connect: 'android', google_health: null };

export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'never';
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
}

export const missingMetrics = (c: Connection) => DEFAULT_METRICS.filter((m) => !c.grantedMetrics.includes(m));

export function describeCard(source: SourceId, c: Connection | undefined, platform: Platform, deviceId: string | null, now = Date.now()): { subtitle: string; action: CardAction } {
  const home = HOME_PLATFORM[source];
  const live = c && c.status !== 'not_connected' ? c : undefined;
  if (!live) {
    if (home && home !== platform) {
      return { subtitle: source === 'healthkit' ? 'Install HumanAudit on your iPhone to add Apple Health' : 'Available on Android', action: null };
    }
    return { subtitle: 'Not connected', action: 'connect' };
  }
  const device = source !== 'google_health';
  const mine = device && live.collectorDeviceId === deviceId;
  const phone = platform === 'ios' ? 'iPhone' : 'phone';
  const from = mine ? `this ${phone}` : live.collectorDeviceName ?? 'another device';
  // Only the collector (or Google Health, which has none) can fix a connection; a second phone just watches.
  const own = (a: CardAction): CardAction => (!device || mine ? a : null);
  const missing = missingMetrics(live).map((m) => METRIC_LABEL[m]).join(', ');
  switch (live.status) {
    case 'needs_reauth':
      return { subtitle: source === 'google_health' ? 'Google access expired' : source === 'health_connect' ? 'Permissions removed (reinstall?)' : 'Permissions removed', action: own('reconnect') };
    case 'collector_missing':
      return { subtitle: `${live.collectorDeviceName ?? 'The collector device'} not seen for 14 days`, action: device && home === platform && !mine ? 'move' : null };
    case 'partial':
      return {
        subtitle: !missing ? 'Partially connected' : source === 'google_health' ? `Missing scopes: ${missing}` : `Missing: ${missing}`,
        action: own(source === 'google_health' ? 'reconnect' : 'fix'),
      };
    case 'stale':
      if (!device) return { subtitle: `No new data since ${ago(live.lastSyncAt, now)}. Check the Google Health app sync`, action: null };
      return { subtitle: mine ? `Open HumanAudit on this ${phone} to sync` : `Syncing from ${from} · ${ago(live.collectorLastSeenAt, now)}`, action: null };
    case 'error':
      return { subtitle: `Sync failed: ${live.lastSyncError?.message ?? 'unknown error'}`, action: own('fix') };
    default: {
      const synced = `Synced ${ago(live.lastSyncAt, now)}`;
      if (!device) return { subtitle: synced, action: null };
      return { subtitle: mine ? `${synced} · this ${phone}` : `Syncing from ${from} · ${ago(live.lastSyncAt, now)}`, action: null };
    }
  }
}
