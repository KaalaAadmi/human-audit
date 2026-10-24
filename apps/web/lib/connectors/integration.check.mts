// Run: DATABASE_URL=postgres://localhost:5544/ha npx tsx lib/connectors/integration.check.mts
// Needs a Postgres with packages/db/drizzle/apply_all.sql applied. Creates and deletes its own users.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { query } from '../db';
import { createConnection, disconnect, enqueue, ingest, putPreference, upsertDevice } from './store';
import { runJobs } from './jobs';
import type { SampleInput } from './metrics';

const U = `check_${randomUUID().slice(0, 8)}`, V = `check_${randomUUID().slice(0, 8)}`;
const mkUser = (id: string) => query(`INSERT INTO user_profiles (id, email, display_name, chronological_birthdate, height_cm) VALUES ($1,$2,'t','1990-01-01',180)`, [id, `${id}@x.test`]);
const reject = async (p: Promise<unknown>, status: number, msg: string) => assert.rejects(p, (e: any) => e.status === status, msg);
const drain = async () => { for (let i = 0; i < 5; i++) { const s = await runJobs(5000); if (!s.done && !s.retried) break; } };

try {
  await mkUser(U); await mkUser(V);
  const dev = randomUUID(), devOther = randomUUID();
  await upsertDevice(U, { id: dev, platform: 'ios', name: "Arnav's iPhone" });
  await upsertDevice(V, { id: devOther, platform: 'ios', name: 'other' });
  await reject(upsertDevice(V, { id: dev, platform: 'ios', name: 'steal' }), 409, 'another user cannot take over a device id');

  const hk = await createConnection(U, { source: 'healthkit', deviceId: dev, grantedMetrics: ['hrv', 'resting_hr', 'sleep', 'workouts', 'steps'] });
  await reject(createConnection(U, { source: 'google_health', deviceId: dev, grantedMetrics: [] }), 400, 'google_health is not device-bound');

  // 7 days of SDNN HRV + RHR so readiness has enough days (>=3), one night of staged sleep, one workout.
  const base = Date.parse('2026-03-01T00:00:00Z');
  const mk = (o: Partial<SampleInput> & Pick<SampleInput, 'metric' | 'originId' | 'unit' | 'startAt' | 'endAt'>): SampleInput =>
    ({ value: 1, tzOffsetMinutes: 0, originApp: 'com.apple.health.watch', originDevice: 'Apple Watch', variant: null, payload: null, ...o });
  const samples: SampleInput[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(base + i * 86_400_000).toISOString().slice(0, 10);
    samples.push(mk({ metric: 'hrv', variant: 'sdnn', value: 40 + i, unit: 'ms', originId: `hrv${i}`, startAt: `${d}T04:00:00Z`, endAt: `${d}T04:00:00Z` }));
    samples.push(mk({ metric: 'resting_hr', value: 55, unit: 'bpm', originId: `rhr${i}`, startAt: `${d}T05:00:00Z`, endAt: `${d}T05:00:00Z` }));
  }
  // Night of 2026-03-06 -> 03-07: segments straddle midnight, all belong to 03-07.
  const seg = (id: string, stage: string, a: string, b: string, min: number) =>
    mk({ metric: 'sleep', value: min, unit: 'min', originId: id, startAt: a, endAt: b, payload: { stage } });
  samples.push(seg('s1', 'light', '2026-03-06T23:00:00Z', '2026-03-07T01:00:00Z', 120), seg('s2', 'deep', '2026-03-07T01:00:00Z', '2026-03-07T02:30:00Z', 90),
    seg('s3', 'rem', '2026-03-07T02:30:00Z', '2026-03-07T04:00:00Z', 90), seg('s4', 'light', '2026-03-07T04:00:00Z', '2026-03-07T06:30:00Z', 150), seg('s5', 'awake', '2026-03-07T06:30:00Z', '2026-03-07T06:45:00Z', 15));
  samples.push(mk({ metric: 'workouts', value: 2700, unit: 's', originId: 'w1', startAt: '2026-03-06T17:00:00Z', endAt: '2026-03-06T17:45:00Z',
    payload: { type: 'running', durationSec: 2700, activeCalories: 400, avgHr: 150, maxHr: 175 } }));

  await reject(ingest(U, { connectionId: hk.id, deviceId: devOther, samples, deleted: [] }), 409, 'non-collector device gets 409');
  await reject(ingest(V, { connectionId: hk.id, deviceId: dev, samples, deleted: [] }), 404, 'other user cannot ingest into my connection');
  await reject(ingest(U, { connectionId: hk.id, deviceId: dev, samples: [{ ...samples[0]!, unit: 'bpm' }], deleted: [] }), 400, 'wrong unit rejected');
  await reject(ingest(U, { connectionId: hk.id, deviceId: dev, samples: [{ ...samples[0]!, startAt: '2999-01-01T00:00:00Z', endAt: '2999-01-01T00:00:00Z' }], deleted: [] }), 400, 'future sample rejected');
  await reject(ingest(U, { connectionId: hk.id, deviceId: dev, samples: [{ ...samples[0]!, variant: null }], deleted: [] }), 400, 'hrv without variant rejected');
  await reject(ingest(U, { connectionId: hk.id, deviceId: dev, samples: Array(1001).fill(samples[0]!), deleted: [] }), 400, 'over 1000 rejected');

  const r1 = await ingest(U, { connectionId: hk.id, deviceId: dev, samples, deleted: [] });
  assert.deepEqual(r1, { accepted: samples.length, duplicates: 0, tombstoned: 0 }, 'first upload accepted');
  const r2 = await ingest(U, { connectionId: hk.id, deviceId: dev, samples, deleted: [] });
  assert.deepEqual(r2, { accepted: 0, duplicates: samples.length, tombstoned: 0 }, 're-upload is a no-op');

  await drain();
  const [v] = await query<any>(`SELECT * FROM daily_vitals_summary WHERE user_id = $1 AND summary_date = '2026-03-07'`, [U]);
  assert.ok(v, 'legacy vitals row projected');
  assert.equal(Number(v.overnight_hrv_rmssd), 46, 'HRV value');
  assert.equal(v.hrv_variant, 'sdnn', 'HRV variant kept');
  assert.equal(v.hrv_source, 'healthkit');
  assert.equal(v.resting_heart_rate, 55);
  assert.equal(v.sleep_duration_seconds, (120 + 90 + 90 + 150) * 60, 'night assembled from segments across midnight');
  assert.equal(v.awake_seconds, 15 * 60);
  assert.ok(v.sleep_score > 0, 'sleep score computed');
  assert.ok(v.readiness_tier, 'readiness computed from 7 days of SDNN');
  const [{ n: sleepDays }] = await query<any>(`SELECT count(*)::int AS n FROM daily_vitals_summary WHERE user_id = $1 AND sleep_duration_seconds IS NOT NULL`, [U]);
  assert.equal(sleepDays, 1, 'sleep landed on exactly one day');

  const wl = await query<any>(`SELECT * FROM workout_logs WHERE user_id = $1`, [U]);
  assert.equal(wl.length, 1); assert.equal(wl[0].workout_type, 'running'); assert.equal(wl[0].source, 'apple_health'); assert.equal(wl[0].duration_seconds, 2700);
  assert.equal(wl[0].avg_heart_rate, 150);
  const sums = await query<any>(`SELECT * FROM daily_summaries WHERE user_id = $1 AND metric = 'hrv'`, [U]);
  assert.equal(sums.length, 7); assert.ok(sums.every((s) => s.connection_id === hk.id && s.variant === 'sdnn'));

  // Tombstone: workout leaves the Previous workouts list; deleted HRV day becomes "no data", not zero.
  const t = await ingest(U, { connectionId: hk.id, deviceId: dev, samples: [], deleted: [{ originId: 'w1', metric: 'workouts' }, { originId: 'hrv0', metric: 'hrv' }] });
  assert.equal(t.tombstoned, 2); await drain();
  assert.equal((await query(`SELECT 1 FROM workout_logs WHERE user_id = $1`, [U])).length, 0, 'tombstoned workout removed');
  assert.equal((await query(`SELECT 1 FROM daily_summaries WHERE user_id = $1 AND metric='hrv' AND local_date='2026-03-01'`, [U])).length, 0, 'tombstoned HRV day has no summary');

  // Preferences: another user's connection is rejected; own order is accepted and recomputes the full history.
  await reject(putPreference(V, 'hrv', [hk.id]), 400, 'cannot reference someone else\'s connection');
  await putPreference(U, 'hrv', [hk.id]); await drain();
  assert.equal((await query(`SELECT 1 FROM daily_summaries WHERE user_id = $1 AND metric='hrv'`, [U])).length, 6, 'full recompute after preference change');

  // Disconnect keeps samples but drops the source out of the order.
  await disconnect(U, hk.id, false); await drain();
  assert.equal((await query(`SELECT 1 FROM daily_summaries WHERE user_id = $1`, [U])).length, 0, 'disconnected source contributes nothing');
  assert.ok((await query(`SELECT 1 FROM samples WHERE user_id = $1`, [U])).length > 0, 'samples kept with deleteData=false');
  await disconnect(U, hk.id, true);
  assert.equal((await query(`SELECT 1 FROM samples WHERE user_id = $1`, [U])).length, 0, 'deleteData=true cascades to samples');

  // Job queue: a job that always fails is retried, then parked with failed_at (never loops forever).
  await enqueue('no_such_kind', {});
  for (let i = 0; i < 6; i++) { await query(`UPDATE jobs SET locked_until = NULL, run_at = now() WHERE kind = 'no_such_kind'`); await runJobs(2000); }
  const [dead] = await query<any>(`SELECT attempts, failed_at FROM jobs WHERE kind = 'no_such_kind'`);
  assert.equal(dead.attempts, 5); assert.ok(dead.failed_at, 'poison job parked after 5 attempts');

  console.log('integration.check: OK');
} finally {
  await query(`DELETE FROM jobs WHERE kind IN ('no_such_kind','summaries_recompute')`);
  await query(`DELETE FROM user_profiles WHERE id = ANY($1)`, [[U, V]]);
  process.exit(process.exitCode ?? 0);
}
