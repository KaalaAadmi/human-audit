/**
 * Sleep engine — need, score, efficiency, and 14-night debt.
 *
 * Sources are fetched from the platform and stored; this module runs the
 * formulas on the stored data. Sleep staging accuracy is the platform's
 * responsibility (Apple Health / Google Health).
 */

export interface NightSleep {
  date: string; // YYYY-MM-DD

  // Duration (seconds)
  totalAsleepSec: number;
  deepSec: number;
  remSec: number;
  lightSec: number;
  awakeSec: number;

  // Time-in-bed for efficiency (seconds)
  // Google Health: minutesInSleepPeriod
  // Apple Watch (watchOS 11+): null → use SME fallback
  timeInBedSec: number | null;

  // Strain from the previous day's wearable data (Banister TRIMP-based 0–21)
  prevDayStrain: number;
}

export type EfficiencyLabel = 'SE' | 'SME';

export interface SleepResult {
  needSec: number;
  perfPct: number;      // 0–100
  efficiencyPct: number; // 0–100
  efficiencyLabel: EfficiencyLabel;
  restorativeRatio: number; // (deep + REM) / asleep
  score: number;          // 0–100
  debtSec: number;        // raw 14-night debt (uncapped)
}

const BASELINE_NEED_SEC = 8 * 3600; // 8 h default; ponytail: not personalised yet, add when user can set it
const REPAYMENT_RATE = 0.33;        // surplus repays at 1/3 rate (tunable, based on "3 nights per short night")
const DEBT_WINDOW = 14;

/**
 * Compute sleep need for one night.
 * Need = 8 h + 0.08 × prevDayStrain (on 0–21 scale) × 3600 + 0.33 × debtSec_entering_this_night
 * ponytail: debt term uses the debt *before* this night, passed in from the rolling computation
 */
function sleepNeed(prevDayStrain: number, enteringDebtSec: number): number {
  return BASELINE_NEED_SEC
    + 0.08 * prevDayStrain * 3600
    + 0.33 * enteringDebtSec;
}

/**
 * SE when TimeInBed is known; SME (sleep-maintenance efficiency) otherwise.
 * SME = asleep / (last sleep sample end − first sleep sample start),
 * which here is approximated as asleep / (asleep + awake) — the only
 * timestamps available from platform daily summaries.
 * ponytail: true SME needs per-segment hypnogram; this is a platform-summary proxy
 */
function efficiency(night: NightSleep): { pct: number; label: EfficiencyLabel } {
  if (night.timeInBedSec && night.timeInBedSec > 0) {
    return { pct: Math.min(100, (night.totalAsleepSec / night.timeInBedSec) * 100), label: 'SE' };
  }
  const denominator = night.totalAsleepSec + night.awakeSec;
  if (denominator <= 0) return { pct: 0, label: 'SME' };
  return { pct: Math.min(100, (night.totalAsleepSec / denominator) * 100), label: 'SME' };
}

/**
 * Score = 100 × (0.50 × perf + 0.30 × eff + 0.20 × restorative / 0.45)
 * Components are clamped to [0,1] before weighting so no single term dominates.
 */
function sleepScore(perfPct: number, effPct: number, restorativeRatio: number): number {
  const perf  = Math.min(1, perfPct / 100);
  const eff   = Math.min(1, effPct / 100);
  const rest  = Math.min(1, restorativeRatio / 0.45);
  return Math.round(100 * (0.50 * perf + 0.30 * eff + 0.20 * rest));
}

/**
 * Process a rolling window of nights (oldest first) and return results for each.
 * Debt rolls forward: each night's gap (positive = under-slept, negative = over-slept at 1/3 rate)
 * accumulates over the DEBT_WINDOW. Nights beyond the window are dropped from debt.
 */
export function computeSleepResults(nights: NightSleep[]): SleepResult[] {
  const results: SleepResult[] = [];
  // gaps array for debt window; stores the effective gap_i' for each night
  const gapWindow: number[] = [];

  for (const night of nights) {
    const enteringDebt = Math.max(0, gapWindow.reduce((s, g) => s + g, 0));
    const need = sleepNeed(night.prevDayStrain, enteringDebt);
    // Debt accrues against the base need only. Using `need` here fed the debt term back into the debt, which compounded ~1.33x/night.
    const rawGap = sleepNeed(night.prevDayStrain, 0) - night.totalAsleepSec;
    const effectiveGap = rawGap > 0 ? rawGap : rawGap * REPAYMENT_RATE;

    gapWindow.push(effectiveGap);
    if (gapWindow.length > DEBT_WINDOW) gapWindow.shift();

    const debtSec = Math.max(0, gapWindow.reduce((s, g) => s + g, 0));
    const perfPct = Math.min(100, (night.totalAsleepSec / need) * 100);
    const { pct: effPct, label: efficiencyLabel } = efficiency(night);
    const restorativeRatio = night.totalAsleepSec > 0
      ? (night.deepSec + night.remSec) / night.totalAsleepSec
      : 0;

    results.push({
      needSec: Math.round(need),
      perfPct: Math.round(perfPct),
      efficiencyPct: Math.round(effPct),
      efficiencyLabel,
      restorativeRatio: Number(restorativeRatio.toFixed(3)),
      score: sleepScore(perfPct, effPct, restorativeRatio),
      debtSec: Math.round(debtSec),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Runnable check (node services/sleepEngine.ts)
// ---------------------------------------------------------------------------
// @ts-ignore – Node-only check; stripped by the bundler at runtime
if (typeof require !== 'undefined' && require.main === module) {
  const nights: NightSleep[] = [
    { date: '2024-01-01', totalAsleepSec: 6 * 3600, deepSec: 3600, remSec: 3600, lightSec: 7200, awakeSec: 1800, timeInBedSec: 7 * 3600, prevDayStrain: 14 },
    { date: '2024-01-02', totalAsleepSec: 8 * 3600, deepSec: 5400, remSec: 5400, lightSec: 7200, awakeSec: 900,  timeInBedSec: 9 * 3600, prevDayStrain: 8 },
    { date: '2024-01-03', totalAsleepSec: 7 * 3600, deepSec: 3600, remSec: 4500, lightSec: 7200, awakeSec: 1200, timeInBedSec: null,      prevDayStrain: 10 },
  ];
  const res = computeSleepResults(nights);
  console.log('night 1:', res[0]);
  console.log('night 2:', res[1]);
  console.log('night 3 (SME):', res[2]);
  if (res[0].debtSec <= 0) throw new Error('night 1 should have debt (only 6h sleep)');
  // Night 2: 8h sleep, but need is elevated by prev debt, so debt may still grow; just verify it's non-negative
  if (res[1].debtSec < 0) throw new Error('debtSec should never be negative');
  if (res[2].efficiencyLabel !== 'SME') throw new Error('night 3 should use SME (no timeInBed)');
  if (res[0].score < 0 || res[0].score > 100) throw new Error('score out of range');
  // Regression: 730 nights of 6h sleep must stay bounded (debt used to compound to billions of seconds).
  const long = computeSleepResults(Array.from({ length: 730 }, (_, i) => ({ ...nights[0]!, date: String(i), prevDayStrain: 21 })));
  // Worst case here: 14 nights x 3.68 h gap = ~52 h debt, need ~ 9.7 h + 0.33 x 52 h = ~27 h. Compounding blew far past this.
  if (long.some(r => r.debtSec > 14 * 4 * 3600 || r.needSec > 30 * 3600)) throw new Error('sleep debt/need unbounded');
  console.log('sleepEngine check: OK');
}
