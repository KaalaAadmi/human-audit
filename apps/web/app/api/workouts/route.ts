import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { badRequest, isDate, withAuth } from '../../../lib/route';

/** Active workouts that started on ?date= (UTC day; ponytail: pass a tz offset if local-day accuracy matters). */
export const GET = withAuth(async (req, userId) => {
  const date = new URL(req.url).searchParams.get('date');
  if (!isDate(date)) return badRequest('date (YYYY-MM-DD) is required');
  const workouts = await query(
    `SELECT * FROM workout_logs WHERE user_id = $1 AND deduped_status = 'active' AND start_time::date = $2 ORDER BY start_time`,
    [userId, date]
  );
  return NextResponse.json({ success: true, workouts });
});

/** Insert one or multiple workout logs. */
export const POST = withAuth(async (req, userId) => {
  const body = await req.json();
  const items = Array.isArray(body.workouts) ? body.workouts : [body];
  const results = [];

  for (const item of items) {
    const [saved] = await query(
      `INSERT INTO workout_logs (
        id, user_id, external_id, source, workout_type, start_time, end_time,
        duration_seconds, active_calories, avg_heart_rate, max_heart_rate,
        zone1_seconds, zone2_seconds, zone3_seconds, zone4_seconds, zone5_seconds, deduped_status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      ) RETURNING *`,
      [
        crypto.randomUUID(),
        userId,
        item.external_id ?? item.externalId ?? null,
        item.source ?? 'apple_health',
        item.workout_type ?? item.workoutType ?? 'workout',
        item.start_time ?? item.startTime ?? new Date().toISOString(),
        item.end_time ?? item.endTime ?? new Date().toISOString(),
        item.duration_seconds ?? item.durationSeconds ?? 0,
        item.active_calories ?? item.activeCalories ?? 0,
        item.avg_heart_rate ?? item.avgHeartRate ?? null,
        item.max_heart_rate ?? item.maxHeartRate ?? null,
        item.zone1_seconds ?? item.zone1Seconds ?? 0,
        item.zone2_seconds ?? item.zone2Seconds ?? 0,
        item.zone3_seconds ?? item.zone3Seconds ?? 0,
        item.zone4_seconds ?? item.zone4Seconds ?? 0,
        item.zone5_seconds ?? item.zone5Seconds ?? 0,
        item.deduped_status ?? item.dedupedStatus ?? 'active',
      ]
    );
    if (saved) results.push(saved);
  }

  return NextResponse.json({ success: true, workouts: results, count: results.length });
});
