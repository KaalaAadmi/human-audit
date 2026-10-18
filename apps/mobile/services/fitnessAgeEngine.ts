/**
 * Fitness Age engine — HUNT Fitness Age via Nes non-exercise VO₂max.
 *
 * Step 1: VO₂max (ml/kg/min) via Nes 2011 non-exercise equations (sex-split).
 *         Requires waist_cm. Returns null for both VO₂max and Fitness Age when
 *         waist_cm is not yet provided (user hasn't entered it).
 *
 * Step 2: HUNT Fitness Age from VO₂max vs age-matched population norms.
 *
 * Step 3: Pace of aging from a rolling 12-week Fitness Age trend (OLS slope).
 *         Returns null until ≥12 weekly data points exist.
 *
 * Sources: Nes et al. 2014; Loe et al. 2013 HUNT reference data.
 */

import type { Sex } from './wearableEngine';

// HUNT PA index scoring:
//   frequency (days/week) × intensity (1–4) × duration (1–5)
//   Nes 2011 Table 1: scored 1–100; values below are typical working values.
//   ponytail: full HUNT PA scoring table omitted; add onboarding questionnaire before using this
export type HuntPaIndex = number; // 1–100

export interface FitnessAgeInput {
  sex: Sex;
  age: number;              // chronological years
  restingHrBpm: number;     // from platform
  waistCm: number | null;   // null → VO₂max unavailable
  huntPaIndex: HuntPaIndex; // from onboarding questionnaire
}

export interface FitnessAgeResult {
  vo2maxMlKgMin: number | null; // null when waistCm is null
  fitnessAge: number | null;    // null when vo2maxMlKgMin is null
  deltaYears: number | null;    // fitnessAge − chronologicalAge
}

export interface FitnessAgePace {
  betaYearsPerYear: number; // OLS slope; <0 = improving, 0 = steady, >0 = ageing faster
  r2: number;
}

// Nes 2011 non-exercise VO₂max equations
// Men:   100.27 − 0.296·age + 0.226·PA − 0.369·WC − 0.155·RHR
// Women:  74.736 − 0.247·age + 0.198·PA − 0.259·WC − 0.114·RHR
// prefer_not_to_say: average of the two
const NES_COEF: Record<Sex, { intercept: number; age: number; pa: number; wc: number; rhr: number }> = {
  male:              { intercept: 100.270, age: -0.296, pa: 0.226, wc: -0.369, rhr: -0.155 },
  female:            { intercept:  74.736, age: -0.247, pa: 0.198, wc: -0.259, rhr: -0.114 },
  prefer_not_to_say: { intercept:  87.503, age: -0.2715, pa: 0.212, wc: -0.314, rhr: -0.1345 },
};

// HUNT norms: average VO₂max at age 25 and decline per decade
const HUNT_NORM: Record<Sex, { vo2At25: number; declinePerDecade: number }> = {
  male:              { vo2At25: 54.4, declinePerDecade: 3.5 },
  female:            { vo2At25: 43.0, declinePerDecade: 3.5 },
  prefer_not_to_say: { vo2At25: 48.7, declinePerDecade: 3.5 },
};

export function computeFitnessAge(input: FitnessAgeInput): FitnessAgeResult {
  if (input.waistCm === null) {
    return { vo2maxMlKgMin: null, fitnessAge: null, deltaYears: null };
  }

  const c = NES_COEF[input.sex];
  const vo2max = c.intercept
    + c.age * input.age
    + c.pa  * input.huntPaIndex
    + c.wc  * input.waistCm
    + c.rhr * input.restingHrBpm;

  const n = HUNT_NORM[input.sex];
  // FitnessAge = age where population average VO₂max equals this person's VO₂max
  // n.vo2At25 − 0.35 × (FitnessAge − 25) = vo2max  →  FitnessAge = 25 + (n.vo2At25 − vo2max) / 0.35
  const declinePerYear = n.declinePerDecade / 10;
  const fitnessAge = 25 + (n.vo2At25 - vo2max) / declinePerYear;

  return {
    vo2maxMlKgMin: Number(vo2max.toFixed(1)),
    fitnessAge: Number(fitnessAge.toFixed(1)),
    deltaYears: Number((fitnessAge - input.age).toFixed(1)),
  };
}

/**
 * OLS slope of Fitness Age over time.
 * points: array of { weekIndex: number (0,1,2,...), fitnessAge: number }
 * Returns null if fewer than 12 weekly points.
 */
export function computeAgingPace(points: { weekIndex: number; fitnessAge: number }[]): FitnessAgePace | null {
  if (points.length < 12) return null;

  const n = points.length;
  const meanX = points.reduce((s, p) => s + p.weekIndex, 0) / n;
  const meanY = points.reduce((s, p) => s + p.fitnessAge, 0) / n;

  let ssXX = 0, ssXY = 0, ssYY = 0;
  for (const p of points) {
    ssXX += (p.weekIndex - meanX) ** 2;
    ssXY += (p.weekIndex - meanX) * (p.fitnessAge - meanY);
    ssYY += (p.fitnessAge - meanY) ** 2;
  }

  if (ssXX === 0) return null;
  const betaWeeksPerWeek = ssXY / ssXX;
  const r2 = ssYY > 0 ? (ssXY ** 2) / (ssXX * ssYY) : 0;

  // Convert from "fitness years per calendar week" to "fitness years per calendar year"
  return {
    betaYearsPerYear: Number((betaWeeksPerWeek * 52).toFixed(3)),
    r2: Number(r2.toFixed(3)),
  };
}

// ---------------------------------------------------------------------------
// Runnable check (node services/fitnessAgeEngine.ts)
// ---------------------------------------------------------------------------
// @ts-ignore – Node-only check; stripped by the bundler at runtime
if (typeof require !== 'undefined' && require.main === module) {
  // null when no waist
  const noWaist = computeFitnessAge({ sex: 'male', age: 30, restingHrBpm: 55, waistCm: null, huntPaIndex: 40 });
  if (noWaist.fitnessAge !== null) throw new Error('expected null when waistCm is null');

  // 30yo male, waist 82cm, PA 40, RHR 55 → should give a reasonable VO₂max
  const res = computeFitnessAge({ sex: 'male', age: 30, restingHrBpm: 55, waistCm: 82, huntPaIndex: 40 });
  if (!res.vo2maxMlKgMin || res.vo2maxMlKgMin < 30 || res.vo2maxMlKgMin > 70)
    throw new Error(`vo2max out of expected range: ${res.vo2maxMlKgMin}`);
  console.log('fitnessAge 30yo male:', res);

  // Pace: needs ≥12 points
  const tooFew = computeAgingPace([{ weekIndex: 0, fitnessAge: 28 }, { weekIndex: 1, fitnessAge: 28.1 }]);
  if (tooFew !== null) throw new Error('expected null for <12 points');

  const trend = Array.from({ length: 13 }, (_, i) => ({ weekIndex: i, fitnessAge: 28 - i * 0.05 }));
  const pace = computeAgingPace(trend);
  if (!pace || pace.betaYearsPerYear >= 0) throw new Error('expected negative pace (improving)');
  console.log('fitnessAgeEngine check: OK', pace);
}
