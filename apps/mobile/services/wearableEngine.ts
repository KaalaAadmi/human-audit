export interface HeartRateSample {
  timestamp: string;
  bpm: number;
}

export interface ZoneDurations {
  zone1Sec: number; // 50-60% HRR
  zone2Sec: number; // 60-70% HRR
  zone3Sec: number; // 70-80% HRR
  zone4Sec: number; // 80-90% HRR
  zone5Sec: number; // 90-100% HRR
  totalSec: number;
}

export interface WorkoutRecord {
  id: string;
  source: 'fitbit' | 'apple_health' | 'health_connect';
  activityName: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  caloriesBurned: number;
  avgHeartRate: number;
  maxHeartRate: number;
  strainScore: number; // 0.0 - 21.0
  zones: ZoneDurations;
  isDeduplicated?: boolean;
}

export interface SleepTelemetry {
  totalSleepMinutes: number;
  sleepPerformancePct: number; // e.g. 88%
  sleepNeedMinutes: number;
  remMinutes: number;
  deepMinutes: number;
  lightMinutes: number;
  awakeMinutes: number;
  respiratoryRate: number;
  restingHeartRate: number;
  hrvMs: number;
  skinTempDeviation: number; // e.g. -0.2 C
}

export const WearableEngine = {
  /**
   * Calculates Karvonen HRR Zone thresholds and aggregates time spent in Zones 1-5
   */
  calculateHRRZones(
    samples: HeartRateSample[],
    age: number = 28,
    restingHeartRate: number = 52
  ): ZoneDurations {
    const maxHeartRate = 220 - age;
    const hrr = maxHeartRate - restingHeartRate;

    // Thresholds
    const z1Min = restingHeartRate + 0.50 * hrr;
    const z2Min = restingHeartRate + 0.60 * hrr;
    const z3Min = restingHeartRate + 0.70 * hrr;
    const z4Min = restingHeartRate + 0.80 * hrr;
    const z5Min = restingHeartRate + 0.90 * hrr;

    let zone1Sec = 0;
    let zone2Sec = 0;
    let zone3Sec = 0;
    let zone4Sec = 0;
    let zone5Sec = 0;

    // Assuming 5-second interval between HR samples if not specified
    const sampleIntervalSec = 5;

    for (const sample of samples) {
      const bpm = sample.bpm;
      if (bpm >= z5Min) {
        zone5Sec += sampleIntervalSec;
      } else if (bpm >= z4Min) {
        zone4Sec += sampleIntervalSec;
      } else if (bpm >= z3Min) {
        zone3Sec += sampleIntervalSec;
      } else if (bpm >= z2Min) {
        zone2Sec += sampleIntervalSec;
      } else if (bpm >= z1Min) {
        zone1Sec += sampleIntervalSec;
      }
    }

    const totalSec = zone1Sec + zone2Sec + zone3Sec + zone4Sec + zone5Sec;

    return {
      zone1Sec,
      zone2Sec,
      zone3Sec,
      zone4Sec,
      zone5Sec,
      totalSec,
    };
  },

  /**
   * Calculates 0-21 Day Strain from Zone Durations
   */
  calculateStrain(zones: ZoneDurations): number {
    const rawWorkload =
      (zones.zone1Sec / 60) * 0.02 +
      (zones.zone2Sec / 60) * 0.05 +
      (zones.zone3Sec / 60) * 0.12 +
      (zones.zone4Sec / 60) * 0.28 +
      (zones.zone5Sec / 60) * 0.65;

    const k = 0.045;
    const strain = 21 * (1 - Math.exp(-k * rawWorkload));
    return Number(Math.min(21.0, Math.max(0.0, strain)).toFixed(1));
  },

  /**
   * Smart Deduplication: Prioritizes Fitbit > Apple Health > Health Connect
   * Discards data prior to firstLoginDate
   */
  deduplicateWorkouts(
    incomingWorkouts: WorkoutRecord[],
    firstLoginDate: Date,
    sourcePriority: ('fitbit' | 'apple_health' | 'health_connect')[] = ['fitbit', 'apple_health', 'health_connect']
  ): WorkoutRecord[] {
    // 1. Filter out historical records prior to first login baseline
    const filtered = incomingWorkouts.filter(w => new Date(w.startTime) >= firstLoginDate);

    // 2. Sort by startTime
    filtered.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    const result: WorkoutRecord[] = [];

    for (const current of filtered) {
      let isDuplicate = false;

      for (let i = 0; i < result.length; i++) {
        const existing = result[i];

        const curStart = new Date(current.startTime).getTime();
        const curEnd = new Date(current.endTime).getTime();
        const exStart = new Date(existing.startTime).getTime();
        const exEnd = new Date(existing.endTime).getTime();

        const overlapStart = Math.max(curStart, exStart);
        const overlapEnd = Math.min(curEnd, exEnd);
        const overlapDuration = Math.max(0, overlapEnd - overlapStart);

        const curDuration = curEnd - curStart;
        const exDuration = exEnd - exStart;

        // Check 50% overlap conflict
        if (overlapDuration / curDuration >= 0.5 || overlapDuration / exDuration >= 0.5) {
          const curPrio = sourcePriority.indexOf(current.source);
          const exPrio = sourcePriority.indexOf(existing.source);

          if (curPrio < exPrio) {
            // Current has higher priority, replace existing
            result[i] = current;
            isDuplicate = true;
            break;
          } else {
            // Existing has higher or equal priority, drop current
            isDuplicate = true;
            break;
          }
        }
      }

      if (!isDuplicate) {
        result.push(current);
      }
    }

    return result;
  },

  /**
   * Calculates Biological Body Age from biometrics
   */
  calculateBiologicalAge(
    chronologicalAge: number,
    rhr: number, // e.g. 52
    hrv: number, // e.g. 68
    sleepPerfPct: number, // e.g. 88
    weeklyStrain: number // e.g. 14.2
  ): { biologicalAge: number; deltaYears: number; rejuvenationPace: string } {
    let delta = 0;

    // RHR Impact: baseline 65 bpm
    delta += (rhr - 65) * 0.15;

    // HRV Impact: baseline 45 ms
    delta -= (hrv - 45) * 0.12;

    // Sleep Performance Impact: baseline 75%
    delta -= (sleepPerfPct - 75) * 0.08;

    // Weekly Strain optimal zone (12-16)
    if (weeklyStrain >= 12 && weeklyStrain <= 16) {
      delta -= 1.2;
    }

    const bioAge = Number((chronologicalAge + delta).toFixed(1));
    const deltaYears = Number((bioAge - chronologicalAge).toFixed(1));
    const rejuvenationPace = deltaYears < 0 ? 'Aging 18% Slower than Baseline' : 'Optimal Adaptation Window';

    return {
      biologicalAge: bioAge,
      deltaYears,
      rejuvenationPace,
    };
  }
};
