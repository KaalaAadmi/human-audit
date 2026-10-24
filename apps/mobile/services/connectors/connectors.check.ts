// Run: npx tsx services/connectors/connectors.check.ts
import assert from 'node:assert/strict';
import { ago, describeCard, hcSleep, hkSleep, snake, type Connection } from './model';

const NOW = Date.parse('2025-03-10T12:00:00Z');
const min = (m: number) => new Date(NOW - m * 60000).toISOString();
const conn = (o: Partial<Connection>): Connection => ({
  id: 'c', source: 'healthkit', status: 'connected', collectorDeviceId: 'me', collectorDeviceName: 'My iPhone', collectorLastSeenAt: min(1),
  grantedMetrics: ['sleep', 'hrv', 'resting_hr', 'steps', 'active_energy', 'workouts', 'weight'], connectedAt: min(999), lastSyncAt: min(5), lastSyncError: null, backfillCompletedAt: null, ...o,
});

// HealthKit sleep: stage mapping and minutes
const s = new Date('2025-03-09T23:00:00Z');
assert.deepEqual(hkSleep(4, s, new Date(s.getTime() + 90 * 60000)), { value: 90, payload: { stage: 'deep' } });
assert.equal(hkSleep(99, s, s), null);

// Health Connect sleep: staged vs unstaged
const st = (a: number, b: number, stage: number) => ({ startTime: new Date(s.getTime() + a * 60000).toISOString(), endTime: new Date(s.getTime() + b * 60000).toISOString(), stage });
const staged = hcSleep(s.toISOString(), new Date(s.getTime() + 480 * 60000).toISOString(), [st(0, 60, 4), st(60, 120, 5), st(120, 150, 6), st(150, 160, 1)]);
assert.equal(staged.value, 150);
assert.deepEqual((staged.payload as any).stages, { deep: 60, rem: 30, light: 60, awake: 10, asleep: 0 });
assert.equal(hcSleep(s.toISOString(), new Date(s.getTime() + 420 * 60000).toISOString()).value, 420);

assert.equal(snake('traditionalStrengthTraining'), 'traditional_strength_training');
assert.equal(ago(min(5), NOW), '5 min ago');
assert.equal(ago(null), 'never');

// Card states (docs section 11)
assert.deepEqual(describeCard('healthkit', undefined, 'ios', 'me', NOW), { subtitle: 'Not connected', action: 'connect' });
assert.equal(describeCard('healthkit', undefined, 'android', 'me', NOW).action, null);
assert.match(describeCard('healthkit', conn({}), 'ios', 'me', NOW).subtitle, /Synced 5 min ago · this iPhone/);
assert.equal(describeCard('healthkit', conn({ status: 'needs_reauth' }), 'ios', 'me', NOW).action, 'reconnect');
assert.equal(describeCard('healthkit', conn({ status: 'needs_reauth' }), 'ios', 'other', NOW).action, null, 'a second phone cannot fix it');
assert.equal(describeCard('healthkit', conn({ status: 'collector_missing' }), 'ios', 'other', NOW).action, 'move');
assert.equal(describeCard('healthkit', conn({ grantedMetrics: ['sleep'] , status: 'partial' }), 'ios', 'me', NOW).action, 'fix');
assert.equal(describeCard('google_health', conn({ source: 'google_health', status: 'partial', collectorDeviceId: null, grantedMetrics: ['sleep'] }), 'ios', 'me', NOW).action, 'reconnect');
assert.match(describeCard('google_health', conn({ source: 'google_health', status: 'stale', collectorDeviceId: null }), 'ios', 'me', NOW).subtitle, /Check the Google Health app sync/);
assert.match(describeCard('healthkit', conn({ status: 'error', lastSyncError: { message: 'boom' } }), 'ios', 'me', NOW).subtitle, /boom/);
assert.equal(describeCard('healthkit', conn({ status: 'not_connected' }), 'ios', 'me', NOW).action, 'connect');
console.log('connectors.check: OK');
