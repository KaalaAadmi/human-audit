export type WearableSource = 'fitbit' | 'apple_health' | 'google_health';
export type Sex = 'male' | 'female' | 'prefer_not_to_say';

export interface HeartRateSample {
  timestamp: string; // ISO 8601
  bpm: number;
}

// ACSM %HRR zone boundaries (lower inclusive, upper exclusive except Z5)
// Z1: 30–39%, Z2: 40–59%, Z3: 60–74%, Z4: 75–89%, Z5: ≥90%
const ZONE_LOWER = [0.30, 0.40, 0.60, 0.75, 0.90] as const;

export interface ZoneDurations {
  zone1Sec: number; // 30–39% HRR (Light)
  zone2Sec: number; // 40–59% HRR (Moderate)
  zone3Sec: number; // 60–74% HRR (Vigorous low)
  zone4Sec: number; // 75–89% HRR (Vigorous high)
  zone5Sec: number; // ≥90%  HRR (Near-maximal)
  totalSec: number;
}

export interface WorkoutRecord {
  id: string;
  source: WearableSource;
  activityName: string;
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  durationMinutes: number;
  caloriesBurned: number;
  avgHeartRate: number;
  maxHeartRate: number;
  trimpRaw: number;  // Banister TRIMP (the validated quantity)
  strainScore: number; // 0–21 cosmetic scale derived from TRIMP
  zones: ZoneDurations;
  isDeduplicated?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Tanaka HRmax. Override with measured max once available. */
export function hrMax(age: number, measuredMax?: number): number {
  const tanaka = 208 - 0.7 * age;
  return measuredMax && measuredMax > tanaka ? measuredMax : tanaka;
}

/** Classify a single HR reading into zone index 0–4 (-1 = below Z1). */
function zoneIndex(bpm: number, hrRest: number, hrMax: number): number {
  const pHRR = (bpm - hrRest) / (hrMax - hrRest);
  for (let z = 4; z >= 0; z--) {
    if (pHRR >= ZONE_LOWER[z]) return z;
  }
  return -1; // below 30% HRR — not counted
}

// ---------------------------------------------------------------------------
// Banister TRIMP constants by sex
// ponytail: prefer_not_to_say uses the mean of male/female constants — no published answer exists
// ---------------------------------------------------------------------------
const TRIMP_CONST: Record<Sex, { a: number; b: number }> = {
  male:              { a: 0.64, b: 1.92 },
  female:            { a: 0.86, b: 1.67 },
  prefer_not_to_say: { a: 0.75, b: 1.795 },
};

/** Banister TRIMP for a single Δt window (minutes). */
function trimpMinute(hrr: number, sex: Sex): number {
  const { a, b } = TRIMP_CONST[sex];
  return hrr * a * Math.exp(b * hrr);
}

// ---------------------------------------------------------------------------
// Public engine
// ---------------------------------------------------------------------------

export const WearableEngine = {
  /**
   * Karvonen %HRR zones (ACSM cut-points) + Banister TRIMP from raw HR samples.
   * Uses real timestamp deltas; caps gaps >300 s (5 min) to 0 to avoid inflating strain.
   * ponytail: gap cap is a heuristic; tune if platform exports long-gap data legitimately
   */
  calculateZonesAndTrimp(
    samples: HeartRateSample[],
    age: number,
    restingHeartRate: number,
    sex: Sex,
    measuredHrMax?: number,
  ): { zones: ZoneDurations; trimpRaw: number } {
    const maxHR  = hrMax(age, measuredHrMax);
    const hrr    = maxHR - restingHeartRate;

    const zones: ZoneDurations = { zone1Sec: 0, zone2Sec: 0, zone3Sec: 0, zone4Sec: 0, zone5Sec: 0, totalSec: 0 };
    let trimp = 0;

    for (let i = 0; i < samples.length; i++) {
      const bpm = samples[i].bpm;
      const dtMs = i === 0
        ? 0
        : new Date(samples[i].timestamp).getTime() - new Date(samples[i - 1].timestamp).getTime();
      const dtSec = Math.min(dtMs / 1000, 300); // cap gaps at 5 min
      if (dtSec <= 0) continue;

      const z = zoneIndex(bpm, restingHeartRate, maxHR);
      if (z >= 0) {
        const key = (['zone1Sec', 'zone2Sec', 'zone3Sec', 'zone4Sec', 'zone5Sec'] as const)[z];
        zones[key] += dtSec;
        zones.totalSec += dtSec;
      }

      const pHRR = (bpm - restingHeartRate) / hrr;
      if (pHRR >= 0.30) { // ignore sub-Z1 for TRIMP too
        trimp += (dtSec / 60) * trimpMinute(pHRR, sex);
      }
    }

    return { zones, trimpRaw: Number(trimp.toFixed(2)) };
  },

  /**
   * 0–21 cosmetic Strain from Banister TRIMP.
   * Formula: 21 × ln(1 + TRIMP) / ln(6287)   (ln(6287) ≈ 8.746)
   * ponytail: the 0–21 scale isn't validated; TRIMP itself is the training-load metric
   */
  trimpToStrain(trimpRaw: number): number {
    const raw = 21 * Math.log(1 + trimpRaw) / Math.log(6287);
    return Number(Math.min(21.0, Math.max(0.0, raw)).toFixed(1));
  },

  /**
   * Deduplicates workouts using the user's saved source priority order.
   * Rule: ≥50% overlap of either workout's duration → keep higher-priority source.
   * Same-priority tie → keep the existing (earlier-added) record.
   * Discards records before firstLoginDate.
   * ponytail: O(n²) scan — fine for typical wearable sync volumes (<200 workouts/day)
   */
  deduplicateWorkouts(
    incoming: WorkoutRecord[],
    firstLoginDate: Date,
    sourcePriority: WearableSource[] = ['fitbit', 'apple_health', 'google_health'],
  ): WorkoutRecord[] {
    const filtered = incoming.filter(w => new Date(w.startTime) >= firstLoginDate);
    filtered.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    const result: WorkoutRecord[] = [];

    for (const cur of filtered) {
      let absorbed = false;
      const curStart = new Date(cur.startTime).getTime();
      const curEnd   = new Date(cur.endTime).getTime();
      const curDur   = curEnd - curStart;

      for (let i = 0; i < result.length; i++) {
        const ex = result[i];
        const exStart = new Date(ex.startTime).getTime();
        const exEnd   = new Date(ex.endTime).getTime();
        const exDur   = exEnd - exStart;

        const overlapMs = Math.max(0, Math.min(curEnd, exEnd) - Math.max(curStart, exStart));
        if (overlapMs / curDur < 0.5 && overlapMs / exDur < 0.5) continue;

        // Conflict: keep higher priority (lower index). Tie → keep existing.
        const curPrio = sourcePriority.indexOf(cur.source);
        const exPrio  = sourcePriority.indexOf(ex.source);
        if (curPrio !== -1 && (exPrio === -1 || curPrio < exPrio)) {
          result[i] = cur; // replace with higher-priority record
        }
        absorbed = true;
        break;
      }

      if (!absorbed) result.push(cur);
    }

    return result;
  },
};

// ---------------------------------------------------------------------------
// Runnable check (node services/wearableEngine.ts)
// ---------------------------------------------------------------------------
// @ts-ignore – Node-only check; stripped by the bundler at runtime
if (typeof require !== 'undefined' && require.main === module) {
  const samples: HeartRateSample[] = [
    { timestamp: '2024-01-01T08:00:00Z', bpm: 130 },
    { timestamp: '2024-01-01T08:01:00Z', bpm: 155 },
    { timestamp: '2024-01-01T08:02:00Z', bpm: 170 },
  ];
  const { zones, trimpRaw } = WearableEngine.calculateZonesAndTrimp(samples, 30, 55, 'male');
  const strain = WearableEngine.trimpToStrain(trimpRaw);
  console.log('zones:', zones, 'trimp:', trimpRaw, 'strain:', strain);
  // 30yo male, HRmax=187, HRR=132; 130bpm≈57%HRR→Z2, 155≈76%→Z4, 170≈87%→Z4
  if (zones.zone4Sec === 0) throw new Error('zone4 should have time');
  if (trimpRaw <= 0) throw new Error('TRIMP should be positive');
  if (strain < 0 || strain > 21) throw new Error('strain out of range');
  console.log('wearableEngine check: OK');
}
