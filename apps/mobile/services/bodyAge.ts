/**
 * Body age page numbers: the fitness age plus what moves it.
 * Pure TS (no RN imports) so it can be checked with `npx tsx services/bodyAge.ts`.
 */
import { computeFitnessAge } from './fitnessAgeEngine';
import type { Sex } from './wearableEngine';

export type Tone = 'good' | 'ok' | 'bad';
export type Band = { label: string; tone: Tone };

export type BodyAgeInput = { age: number; sex: Sex; restingHrBpm: number | null; waistCm: number | null; heightCm: number | null };

const PA = 10;                  // HUNT activity index; must match summaries.ts (no activity questionnaire yet)
const DECLINE_PER_YEAR = 0.35;  // ml/kg/min of average VO2max lost per year of age (HUNT norms in fitnessAgeEngine)
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const r1 = (n: number) => Math.round(n * 10) / 10;

// General guides, not diagnoses. `fill` (0..1) only positions the bar; it carries no extra meaning.
const rhrBand = (bpm: number): Band => (bpm < 60 ? { label: 'Excellent', tone: 'good' } : bpm < 70 ? { label: 'Good', tone: 'good' } : bpm < 80 ? { label: 'Fair', tone: 'ok' } : { label: 'High', tone: 'bad' });
// Waist-to-height under 0.5 is the usual "healthy" line, and unlike waist cutoffs it needs no sex.
const whtrBand = (r: number): Band => (r < 0.5 ? { label: 'Healthy', tone: 'good' } : r < 0.6 ? { label: 'Elevated', tone: 'ok' } : { label: 'High', tone: 'bad' });
const vo2Band = (diff: number): Band => (diff >= 2 ? { label: 'Above average', tone: 'good' } : diff >= -2 ? { label: 'Average', tone: 'ok' } : { label: 'Below average', tone: 'bad' });

export function bodyAgeBreakdown(i: BodyAgeInput) {
  if (i.restingHrBpm === null || i.waistCm === null) return null;
  const args = { sex: i.sex, age: i.age, restingHrBpm: i.restingHrBpm, waistCm: i.waistCm, huntPaIndex: PA };
  const base = computeFitnessAge(args);
  if (base.fitnessAge === null || base.vo2maxMlKgMin === null) return null;
  const { fitnessAge, vo2maxMlKgMin: vo2 } = { fitnessAge: base.fitnessAge, vo2maxMlKgMin: base.vo2maxMlKgMin };
  /** Years of body age gained by changing one input. */
  const yearsFor = (patch: Partial<typeof args>) => r1(fitnessAge - computeFitnessAge({ ...args, ...patch }).fitnessAge!);

  const avgVo2 = vo2 + DECLINE_PER_YEAR * (fitnessAge - i.age); // average VO2max at your chronological age
  const vo2Diff = r1(vo2 - avgVo2);
  const whtr = i.heightCm ? i.waistCm / i.heightCm : null;
  return {
    bodyAge: fitnessAge,
    delta: r1(fitnessAge - i.age), // negative = younger than your age
    vo2: { value: vo2, avg: r1(avgVo2), diff: vo2Diff, band: vo2Band(vo2Diff), fill: clamp01(vo2 / (avgVo2 * 1.5)) },
    rhr: { value: i.restingHrBpm, band: rhrBand(i.restingHrBpm), fill: clamp01((100 - i.restingHrBpm) / 60), years5: yearsFor({ restingHrBpm: i.restingHrBpm - 5 }) },
    waist: { value: i.waistCm, whtr: whtr === null ? null : Math.round(whtr * 100) / 100, band: whtr === null ? null : whtrBand(whtr), fill: whtr === null ? 0 : clamp01((0.65 - whtr) / 0.25), years5: yearsFor({ waistCm: i.waistCm - 5 }) },
  };
}

/** Body age from the raw profile + vitals rows the screens already hold; `age` is null until a birthdate is set. */
export function bodyAgeFor(profile: any, vitals: any) {
  const n = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
  const age: number | null = profile?.chronological_birthdate ? (Date.now() - new Date(profile.chronological_birthdate).getTime()) / 31557600000 : null;
  const b = age === null ? null : bodyAgeBreakdown({
    age, sex: profile?.sex === 'male' || profile?.sex === 'female' ? profile.sex : 'prefer_not_to_say',
    restingHrBpm: n(vitals?.resting_heart_rate), waistCm: n(profile?.waist_cm), heightCm: n(profile?.height_cm),
  });
  return { age, b };
}
