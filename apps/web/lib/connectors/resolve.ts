// Source priority, dedup and normalization (docs/data-connectors.md section 10). Pure functions: no DB, no env.
import type { Metric, Source } from './metrics';

export type Conn = { id: string; source: Source };
/** origin_app -> the direct source it mirrors; null = HumanAudit's own writes (always excluded). */
export type OriginMap = Map<string, Source | null>;

export type Row = {
  connection_id: string;
  metric: Metric;
  variant: string | null;
  value: number | null;
  start_at: Date | string;
  end_at: Date | string;
  origin_app: string | null;
  origin_id: string;
  payload: Record<string, any> | null;
  local_date: string;
};

export type Resolved = { value: number | null; variant: string | null; connectionId: string | null; payload: Record<string, unknown> | null };
const NONE: Resolved = { value: null, variant: null, connectionId: null, payload: null };

const t = (d: Date | string) => new Date(d).getTime();
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/**
 * Local calendar day of a sample: start time shifted by the offset recorded at that moment (handles travel).
 * Sleep is bucketed by start+12h (the night belongs to the day you wake up) rather than "day it ends":
 * HealthKit sleep arrives as stage segments, and one night's segments straddle midnight.
 * ponytail: an afternoon nap lands on the next day's night; split naps out if that matters.
 * Keep in sync with DAY_SQL in summaries.ts.
 */
export const dayOf = (metric: Metric, startIso: string, tzOffsetMinutes: number) =>
  new Date(Date.parse(startIso) + (tzOffsetMinutes + (metric === 'sleep' ? 720 : 0)) * 60_000).toISOString().slice(0, 10);

/** Rows of `conn` that may be used when `earlier` sources already rank above it. */
function usable(rows: Row[], conn: Conn, earlier: Set<Source>, origins: OriginMap): Row[] {
  return rows.filter((r) => {
    if (r.connection_id !== conn.id || (r.value === null && r.metric !== 'workouts')) return false;
    if (!r.origin_app || !origins.has(r.origin_app)) return true;
    const mirrors = origins.get(r.origin_app);
    return mirrors !== null && !(mirrors !== undefined && earlier.has(mirrors)); // null = own write
  });
}

const groupBy = <T>(xs: T[], key: (x: T) => string) => {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return [...m.values()];
};
const best = <T>(groups: T[][], score: (g: T[]) => number) => groups.reduce((a, b) => (score(b) > score(a) ? b : a));

function aggregate(metric: Metric, rows: Row[], connectionId: string): Resolved {
  const variant = rows[0]!.variant;
  const out = (value: number, payload: Record<string, unknown> | null = null): Resolved => ({ value, variant, connectionId, payload });
  const byStart = [...rows].sort((a, b) => t(a.start_at) - t(b.start_at));
  switch (metric) {
    case 'sleep': {
      // Overlapping data from phone + watch: use the single origin with the most asleep minutes, never the sum.
      const stagesOf = (g: Row[]) => {
        const t = { deep: 0, rem: 0, light: 0, awake: 0, asleep: 0, inBed: 0 };
        for (const r of g) {
          // Segment rows carry { stage } and value = minutes; session rows carry { stages: {...}, inBed }.
          const add = r.payload?.stages ?? { [String(r.payload?.stage)]: r.value ?? 0 };
          for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] += Number(add[k === 'inBed' ? 'inbed' : k] ?? 0);
          t.inBed += Number(r.payload?.inBed ?? 0);
        }
        // Un-staged "asleep" overlaps staged data, so it only counts when there are no stages.
        if (!t.deep && !t.rem && !t.light) t.light = t.asleep;
        return t;
      };
      const asleepMin = (g: Row[]) => { const t = stagesOf(g); return t.deep + t.rem + t.light; };
      const g = best(groupBy(rows, (r) => r.origin_app ?? ''), asleepMin);
      const t = stagesOf(g);
      const r1 = (n: number) => Math.round(n * 10) / 10;
      return out(r1(t.deep + t.rem + t.light), {
        deep: r1(t.deep), rem: r1(t.rem), light: r1(t.light), awake: r1(t.awake),
        inBed: r1(t.inBed || t.deep + t.rem + t.light + t.awake), origin: g[0]!.origin_app,
      });
    }
    case 'steps':
    case 'active_energy': {
      const g = best(groupBy(rows, (r) => r.origin_app ?? ''), (s) => sum(s.map((r) => r.value ?? 0)));
      return out(sum(g.map((r) => r.value ?? 0)), { origin: g[0]!.origin_app });
    }
    case 'hrv':
    case 'heart_rate': return out(sum(rows.map((r) => r.value!)) / rows.length);
    case 'resting_hr':
    case 'weight': return out(byStart.at(-1)!.value!);
    case 'workouts': return out(sum(rows.map((r) => Number(r.payload?.durationSec ?? r.value ?? 0))), { count: rows.length });
  }
}

/** First connection in `order` with usable data for the day wins; none -> null (no data, not zero). */
export function resolveDay(metric: Metric, order: Conn[], dayRows: Row[], origins: OriginMap): Resolved {
  for (let i = 0; i < order.length; i++) {
    const rows = usable(dayRows.filter((r) => r.metric === metric), order[i]!, new Set(order.slice(0, i).map((c) => c.source)), origins);
    if (rows.length) return aggregate(metric, rows, order[i]!.id);
  }
  return NONE;
}

/** Workouts overlapping by more than 80% of the shorter one are the same session; the higher-priority origin is kept. */
export function pickWorkouts(order: Conn[], rows: Row[], origins: OriginMap): { kept: Row[]; dropped: Row[] } {
  const kept: Row[] = [];
  const dropped: Row[] = [];
  order.forEach((c, i) => {
    const earlier = new Set(order.slice(0, i).map((x) => x.source));
    const mine = usable(rows.filter((r) => r.metric === 'workouts'), c, earlier, origins).sort((a, b) => t(a.start_at) - t(b.start_at));
    for (const w of mine) {
      const dup = kept.some((k) => {
        const overlap = Math.min(t(k.end_at), t(w.end_at)) - Math.max(t(k.start_at), t(w.start_at));
        return overlap > 0.8 * Math.min(t(k.end_at) - t(k.start_at), t(w.end_at) - t(w.start_at));
      });
      (dup ? dropped : kept).push(w);
    }
  });
  return { kept, dropped };
}

/** Preference order first, then any other active connection (as a fallback only, so a new source never takes over silently). */
export function effectiveOrder(pref: string[] | undefined, active: (Conn & { supports: Metric[] })[], metric: Metric): Conn[] {
  const ok = active.filter((c) => c.supports.includes(metric));
  const first = (pref ?? []).flatMap((id) => ok.filter((c) => c.id === id));
  return [...first, ...ok.filter((c) => !first.includes(c))].map(({ id, source }) => ({ id, source }));
}
