// Runnable check: ../../node_modules/.bin/tsx services/bodyAge.check.ts (kept out of bodyAge.ts: Metro cannot bundle node:assert)
import assert from 'node:assert/strict';
import { bodyAgeBreakdown } from './bodyAge';

assert.equal(bodyAgeBreakdown({ age: 30, sex: 'male', restingHrBpm: 55, waistCm: null, heightCm: 180 }), null, 'no waist -> no body age');
const b = bodyAgeBreakdown({ age: 30, sex: 'male', restingHrBpm: 58, waistCm: 82, heightCm: 172 })!;
assert.equal(b.rhr.years5, 2.2, '5 bpm lower resting HR = 0.155*5/0.35 years');
assert.equal(b.waist.years5, 5.3, '5 cm smaller waist = 0.369*5/0.35 years');
assert.equal(b.waist.band!.label, 'Healthy'); // 82/172 = 0.48
assert.equal(b.rhr.band.label, 'Excellent');
assert.ok(Math.abs(b.vo2.diff - (b.vo2.value - b.vo2.avg)) <= 0.1 + 1e-9, 'diff is from the unrounded average');
const older = bodyAgeBreakdown({ age: 30, sex: 'male', restingHrBpm: 58, waistCm: 110, heightCm: 172 })!;
assert.ok(older.bodyAge > b.bodyAge && older.waist.band!.tone === 'bad', 'bigger waist -> older body age');
assert.equal(bodyAgeBreakdown({ age: 30, sex: 'male', restingHrBpm: 58, waistCm: 82, heightCm: null })!.waist.band, null, 'no height -> no waist band');
console.log('bodyAge check: OK');
