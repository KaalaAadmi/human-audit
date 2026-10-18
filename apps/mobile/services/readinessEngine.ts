/**
 * Readiness engine — lnRMSSD 7-day rolling average vs smallest worthwhile change (SWC).
 *
 * Method: Australian Institute of Sport best-practice / Plews.
 * Requires ≥3 valid overnight RMSSD values in the 7-day window before showing a result.
 *
 * Secondary flag: RHR is also >0.5 SD above its 60-day baseline at the same time
 * HRV is below the band — combination flag, not a standalone rule.
 */

export type ReadinessTier = 'high' | 'normal' | 'low';

export interface ReadinessResult {
  tier: ReadinessTier;
  lnRmssd7Day: number;       // 7-day rolling average of ln(RMSSD)
  baselineMean: number;      // μ over ~60 days
  baselineSd: number;        // σ over ~60 days
  swcLow: number;            // μ − 0.5σ
  swcHigh: number;           // μ + 0.5σ
  rhrFlag: boolean;          // true = combined HRV-low + RHR-high flag
}

/** Input: daily overnight RMSSD (ms) in chronological order (oldest first). */
export interface HrvDay {
  date: string;   // YYYY-MM-DD
  rmssdMs: number;
  rhrBpm: number; // resting HR for the same night
}

const ROLLING_WINDOW = 7;
const BASELINE_WINDOW = 60;
const MIN_VALID_IN_WINDOW = 3;
const SWC_FACTOR = 0.5;
const RHR_SD_THRESHOLD = 0.5;

/**
 * Compute readiness for the most recent day, given a history of HRV days.
 * Returns null when there is not enough data (cold-start).
 * ponytail: uses all days in baseline window equally (no EMA weighting) — add EMA when desired
 */
export function computeReadiness(days: HrvDay[]): ReadinessResult | null {
  if (days.length < MIN_VALID_IN_WINDOW) return null;

  const lnValues = days.map(d => Math.log(d.rmssdMs));

  // 7-day rolling signal: last ROLLING_WINDOW entries
  const window7 = lnValues.slice(-ROLLING_WINDOW);
  if (window7.length < MIN_VALID_IN_WINDOW) return null;
  const lnRmssd7Day = window7.reduce((s, v) => s + v, 0) / window7.length;

  // 60-day baseline mean and SD
  const baseline = lnValues.slice(-BASELINE_WINDOW);
  const mean = baseline.reduce((s, v) => s + v, 0) / baseline.length;
  const sd = Math.sqrt(baseline.reduce((s, v) => s + (v - mean) ** 2, 0) / baseline.length);

  const swcLow  = mean - SWC_FACTOR * sd;
  const swcHigh = mean + SWC_FACTOR * sd;

  let tier: ReadinessTier;
  if (lnRmssd7Day < swcLow)       tier = 'low';
  else if (lnRmssd7Day > swcHigh) tier = 'high';
  else                             tier = 'normal';

  // Secondary RHR flag: only meaningful when HRV is also low
  let rhrFlag = false;
  if (tier === 'low' && days.length >= BASELINE_WINDOW) {
    const rhrValues = days.slice(-BASELINE_WINDOW).map(d => d.rhrBpm);
    const rhrMean = rhrValues.reduce((s, v) => s + v, 0) / rhrValues.length;
    const rhrSd = Math.sqrt(rhrValues.reduce((s, v) => s + (v - rhrMean) ** 2, 0) / rhrValues.length);
    const todayRhr = days[days.length - 1].rhrBpm;
    rhrFlag = rhrSd > 0 && (todayRhr - rhrMean) / rhrSd > RHR_SD_THRESHOLD;
  }

  return {
    tier,
    lnRmssd7Day: Number(lnRmssd7Day.toFixed(4)),
    baselineMean: Number(mean.toFixed(4)),
    baselineSd: Number(sd.toFixed(4)),
    swcLow: Number(swcLow.toFixed(4)),
    swcHigh: Number(swcHigh.toFixed(4)),
    rhrFlag,
  };
}

// ---------------------------------------------------------------------------
// Runnable check (node services/readinessEngine.ts)
// ---------------------------------------------------------------------------
// @ts-ignore – Node-only check; stripped by the bundler at runtime
if (typeof require !== 'undefined' && require.main === module) {
  // Build a realistic baseline with variance (rmssd oscillates ±5 around 50)
  const baseline = Array.from({ length: 60 }, (_, i) => ({
    date: new Date(Date.UTC(2024, 0, i + 1)).toISOString().slice(0, 10),
    rmssdMs: 50 + (i % 2 === 0 ? 5 : -5), // alternates 55/45, SD ≈ 5
    rhrBpm: 55,
  }));

  // Below-baseline HRV (last 7 days all 20ms): should be 'low'
  const lowDays = [...baseline, ...Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.UTC(2024, 2, i + 1)).toISOString().slice(0, 10),
    rmssdMs: 20,
    rhrBpm: 55,
  }))];
  const resLow = computeReadiness(lowDays);
  if (!resLow) throw new Error('should have result with enough days');
  if (resLow.tier !== 'low') throw new Error(`expected low, got ${resLow.tier}`);

  // Normal HRV: last 7 days at baseline mean → normal
  const normalDays = [...baseline, ...Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.UTC(2024, 2, i + 1)).toISOString().slice(0, 10),
    rmssdMs: 50,
    rhrBpm: 55,
  }))];
  const resNormal = computeReadiness(normalDays);
  if (!resNormal || resNormal.tier !== 'normal') throw new Error(`expected normal, got ${resNormal?.tier}`);

  // Cold-start: only 2 days → null
  const cold = computeReadiness([baseline[0], baseline[1]]);
  if (cold !== null) throw new Error('expected null for cold-start');

  console.log('readinessEngine check: OK', { low: resLow.tier, normal: resNormal.tier });
}
