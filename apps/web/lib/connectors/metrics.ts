// Metric catalogue + shared types (docs/data-connectors.md section 5). No imports: Node can run this file directly in checks.

export const SOURCES = ['healthkit', 'health_connect', 'google_health'] as const;
export type Source = (typeof SOURCES)[number];

export const STATUSES = ['connecting', 'connected', 'partial', 'stale', 'needs_reauth', 'collector_missing', 'error', 'not_connected'] as const;
export type Status = (typeof STATUSES)[number];

/** Canonical unit per metric. Sleep samples are stage segments (minutes); workouts carry duration in seconds. */
export const METRIC_UNITS = {
  sleep: 'min',
  hrv: 'ms',
  resting_hr: 'bpm',
  heart_rate: 'bpm',
  steps: 'count',
  active_energy: 'kcal',
  workouts: 's',
  weight: 'kg',
} as const;
export type Metric = keyof typeof METRIC_UNITS;
export const METRICS = Object.keys(METRIC_UNITS) as Metric[];

export const isMetric = (m: unknown): m is Metric => typeof m === 'string' && Object.hasOwn(METRIC_UNITS, m);
export const isSource = (s: unknown): s is Source => (SOURCES as readonly unknown[]).includes(s);

/** What a collector uploads. The server adds id, userId, connectionId, source, ingestedAt. */
export type SampleInput = {
  metric: Metric;
  variant?: 'sdnn' | 'rmssd' | null;
  value: number | null;
  unit: string;
  startAt: string; // ISO 8601
  endAt: string;
  tzOffsetMinutes: number;
  originApp?: string | null;
  originDevice?: string | null;
  originId: string;
  /** sleep: { stage }; workouts: { type, activeCalories, avgHr, maxHr } */
  payload?: Record<string, unknown> | null;
};
