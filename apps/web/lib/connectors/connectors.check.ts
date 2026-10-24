// Run: npx tsx lib/connectors/connectors.check.ts   (pure logic only: no DB, no network)
import assert from 'node:assert/strict';
import { decrypt, encrypt, signState, verifyState } from './crypto';
import { mapPoint, mapRollup, metricsForScopes, SCOPES } from './googleHealth';
import { dayOf, effectiveOrder, pickWorkouts, resolveDay, type Conn, type OriginMap, type Row } from './resolve';
import { sampleId } from './store';

process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.OAUTH_STATE_SIGNING_KEY = 'test-signing-key';

// ---- crypto ----
assert.equal(decrypt(encrypt('refresh-token')), 'refresh-token', 'AES-GCM round trip');
const blob = encrypt('x'); blob[blob.length - 1] ^= 1;
assert.throws(() => decrypt(blob), 'tampered ciphertext is rejected');
const st = signState('n1');
assert.equal(verifyState(st), 'n1', 'state round trip');
assert.equal(verifyState(st.slice(0, -2) + 'xx'), null, 'forged state');
assert.equal(verifyState(signState('n2', -1)), null, 'expired state');

// ---- ids ----
assert.equal(sampleId('healthkit', 'hrv', 'abc'), sampleId('healthkit', 'hrv', 'abc'), 'deterministic id');
assert.notEqual(sampleId('healthkit', 'hrv', 'abc'), sampleId('health_connect', 'hrv', 'abc'), 'source is part of the id');

// ---- day assignment ----
assert.equal(dayOf('steps', '2026-03-08T02:00:00Z', -480), '2026-03-07', 'UTC 02:00 at -08:00 is the previous local day');
assert.equal(dayOf('sleep', '2026-03-07T23:30:00Z', 0), '2026-03-08', 'night starting 23:30 belongs to the day you wake up');
assert.equal(dayOf('sleep', '2026-03-08T03:00:00Z', 0), '2026-03-08', 'segment after midnight, same night');

// ---- resolution ----
const HK: Conn = { id: 'hk', source: 'healthkit' };
const GH: Conn = { id: 'gh', source: 'google_health' };
const origins: OriginMap = new Map([['com.fitbit.FitbitMobile', 'google_health'], ['com.kaalaaadmi.humanaudit', null]]);
const row = (o: Partial<Row>): Row => ({ connection_id: 'hk', metric: 'steps', variant: null, value: 1, start_at: '2026-03-08T10:00:00Z', end_at: '2026-03-08T11:00:00Z',
  origin_app: null, origin_id: 'x', payload: null, local_date: '2026-03-08', ...o });

assert.equal(resolveDay('steps', [GH, HK], [row({ value: 500 })], origins).connectionId, 'hk', 'falls back when primary has no data');
assert.equal(resolveDay('steps', [GH, HK], [], origins).value, null, 'no data is null, not zero');
// primary = Google Health: HealthKit copy of Fitbit data is excluded (cross-path dedup), so the day is empty
assert.equal(resolveDay('steps', [GH, HK], [row({ origin_app: 'com.fitbit.FitbitMobile', value: 900 })], origins).value, null, 'mirrored origin excluded when GH outranks');
// primary = HealthKit: its own Fitbit-mirror rows are kept (the user chose Apple Health)
assert.equal(resolveDay('steps', [HK, GH], [row({ origin_app: 'com.fitbit.FitbitMobile', value: 900 })], origins).value, 900, 'primary is never filtered');
assert.equal(resolveDay('steps', [HK], [row({ origin_app: 'com.kaalaaadmi.humanaudit', value: 77 })], origins).value, null, 'own writes always excluded');
// steps: highest-total origin, not the sum across origins
assert.equal(resolveDay('steps', [HK], [row({ origin_app: 'watch', value: 8000 }), row({ origin_app: 'watch', value: 1000 }), row({ origin_app: 'phone', value: 7000 })], origins).value, 9000, 'highest origin total');
// hrv keeps its variant
assert.equal(resolveDay('hrv', [HK], [row({ metric: 'hrv', value: 40, variant: 'sdnn' })], origins).variant, 'sdnn');
// sleep: staged watch data wins over a larger un-staged phone total; overlap is never summed
const seg = (origin: string, stage: string, min: number, i: number) => row({ metric: 'sleep', origin_app: origin, value: min, origin_id: `${origin}${i}`, payload: { stage } });
const sleep = resolveDay('sleep', [HK], [seg('watch', 'deep', 60, 1), seg('watch', 'rem', 90, 2), seg('watch', 'light', 240, 3), seg('watch', 'awake', 30, 4), seg('phone', 'asleep', 200, 5)], origins);
assert.equal(sleep.value, 390, 'asleep = deep+rem+light of the best origin');
assert.equal((sleep.payload as any).awake, 30);
assert.equal(resolveDay('sleep', [HK], [seg('phone', 'asleep', 420, 1)], origins).value, 420, 'un-staged asleep counts when there are no stages');

// ---- workouts: >80% overlap is one session; the higher-priority origin is kept ----
const wo = (conn: string, id: string, a: string, b: string, o: string | null = null) =>
  row({ connection_id: conn, metric: 'workouts', origin_id: id, start_at: a, end_at: b, origin_app: o, payload: { durationSec: (Date.parse(b) - Date.parse(a)) / 1000 } });
const picked = pickWorkouts([GH, HK], [wo('hk', 'a', '2026-03-08T07:00:00Z', '2026-03-08T08:00:00Z'), wo('gh', 'b', '2026-03-08T07:02:00Z', '2026-03-08T08:00:00Z'), wo('hk', 'c', '2026-03-08T18:00:00Z', '2026-03-08T18:30:00Z')], origins);
assert.deepEqual(picked.kept.map((w) => w.origin_id).sort(), ['b', 'c'], 'GH outranks HK; distinct session kept');
assert.deepEqual(picked.dropped.map((w) => w.origin_id), ['a']);

// ---- order: preference first, other connections as fallback ----
const act = [{ ...HK, supports: ['hrv' as const] }, { ...GH, supports: ['hrv' as const, 'sleep' as const] }];
assert.deepEqual(effectiveOrder(['gh'], act, 'hrv').map((c) => c.id), ['gh', 'hk']);
assert.deepEqual(effectiveOrder(undefined, act, 'sleep').map((c) => c.id), ['gh'], 'only sources that support the metric');

// ---- Google mappers (shapes from the v4 discovery document) ----
const hrv = mapPoint('hrv', { dataPointName: 'p/hrv1', dailyHeartRateVariability: { date: { year: 2026, month: 3, day: 8 }, averageHeartRateVariabilityMilliseconds: 52.5 } })!;
assert.equal(hrv.variant, 'rmssd'); assert.equal(hrv.value, 52.5); assert.equal(dayOf('hrv', hrv.startAt, hrv.tzOffsetMinutes), '2026-03-08');
const rhr = mapPoint('resting_hr', { dataPointName: 'p/r', dailyRestingHeartRate: { date: { year: 2026, month: 3, day: 8 }, beatsPerMinute: '58' } })!;
assert.equal(rhr.value, 58, 'int64 string is parsed');
assert.equal(mapPoint('resting_hr', { dataPointName: 'p/r', dailyRestingHeartRate: { date: { year: 2026, month: 3, day: 8 } } }), null, 'missing value is skipped');
const gs = mapPoint('sleep', { dataPointName: 'p/s', sleep: { interval: { startTime: '2026-03-07T22:30:00Z', endTime: '2026-03-08T06:30:00Z', endUtcOffset: '-14400s' },
  summary: { minutesAsleep: '420', minutesInSleepPeriod: '480', stagesSummary: [{ type: 'DEEP', minutes: '70' }, { type: 'REM', minutes: '90' }, { type: 'LIGHT', minutes: '260' }, { type: 'AWAKE', minutes: '60' }] } } })!;
assert.equal(gs.value, 420); assert.equal(gs.tzOffsetMinutes, -240); assert.deepEqual((gs.payload as any).stages, { deep: 70, rem: 90, light: 260, awake: 60 });
const w = mapPoint('weight', { dataPointName: 'p/w', weight: { sampleTime: { physicalTime: '2026-03-08T07:00:00Z', utcOffset: '0s' }, weightGrams: 81250 } })!;
assert.equal(w.value, 81.25, 'grams -> kg');
const ex = mapPoint('workouts', { dataPointName: 'p/e', exercise: { interval: { startTime: '2026-03-08T07:00:00Z', endTime: '2026-03-08T07:45:00Z', startUtcOffset: '3600s' }, exerciseType: 'RUNNING',
  metricsSummary: { caloriesKcal: 420.4, averageHeartRateBeatsPerMinute: '151' } } })!;
assert.equal(ex.value, 2700); assert.equal((ex.payload as any).avgHr, 151); assert.equal((ex.payload as any).type, 'running');
assert.equal(mapRollup('steps', { civilStartTime: { date: { year: 2026, month: 3, day: 8 } }, steps: { countSum: '8430' } })!.value, 8430);
assert.equal(mapRollup('steps', { civilStartTime: { date: { year: 2026, month: 3, day: 8 } } }), null, 'no rollup value stays null');
assert.deepEqual(metricsForScopes([SCOPES[0]!]), ['sleep'], 'partial consent maps to granted metrics');
assert.deepEqual(metricsForScopes([]), []);

console.log('connectors.check: OK');
