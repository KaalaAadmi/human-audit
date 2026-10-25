import { query } from '../db';
import { DAY_SQL } from './summaries';
import { sleepSegments, type Row, type SleepSegment } from './resolve';

export type SleepNight = { date: string; vitals: Record<string, any>; segments: SleepSegment[]; start: string | null; end: string | null };

/** Most recent night on or before `date`: the scored summary row plus the stage timeline of the source that won the day. */
export async function sleepNight(userId: string, date: string): Promise<SleepNight | null> {
  const [day] = await query<{ local_date: string; connection_id: string; payload: { origin?: string } | null }>(
    `SELECT local_date::text, connection_id, payload FROM daily_summaries
     WHERE user_id = $1 AND metric = 'sleep' AND local_date <= $2 ORDER BY local_date DESC LIMIT 1`, [userId, date]);
  if (!day) return null;
  const [vitals] = await query('SELECT * FROM daily_vitals_summary WHERE user_id = $1 AND summary_date = $2', [userId, day.local_date]);
  const rows = await query<Row>(
    `SELECT connection_id, metric, variant, value, start_at, end_at, origin_app, origin_id, payload, ${DAY_SQL}::text AS local_date
     FROM samples WHERE user_id = $1 AND metric = 'sleep' AND deleted_at IS NULL AND connection_id = $2
       AND origin_app IS NOT DISTINCT FROM $3 AND ${DAY_SQL} = $4`,
    [userId, day.connection_id, day.payload?.origin ?? null, day.local_date]);
  const segments = sleepSegments(rows);
  return { date: day.local_date, vitals: vitals ?? {}, segments, start: segments[0]?.start ?? null, end: segments.at(-1)?.end ?? null };
}
