import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { badRequest, isDate, withAuth } from '../../../lib/route';

// One row per (user, local day) holding the day's total, so POST sets the total (idempotent) instead of appending.
export const GET = withAuth(async (req, userId) => {
  const date = new URL(req.url).searchParams.get('date');
  if (!isDate(date)) return badRequest('date (YYYY-MM-DD) is required');
  const [water] = await query('SELECT * FROM water_logs WHERE user_id = $1 AND log_date = $2', [userId, date]);
  return NextResponse.json({ success: true, water: water ?? { amount_ml: 0, log_date: date } });
});

export const POST = withAuth(async (req, userId) => {
  const { date, volumeMl } = await req.json();
  if (!isDate(date) || !Number.isInteger(volumeMl) || volumeMl < 0) return badRequest('date (YYYY-MM-DD) and integer volumeMl >= 0 are required');
  // UPDATE first; INSERT only when no row exists yet. Avoids ON CONFLICT which requires the unique
  // constraint to be present in the live DB (migrations may not have been applied yet).
  const [existing] = await query<{ id: string }>('SELECT id FROM water_logs WHERE user_id = $1 AND log_date = $2', [userId, date]);
  const [water] = existing
    ? await query('UPDATE water_logs SET amount_ml = $1, logged_at = NOW() WHERE id = $2 RETURNING *', [volumeMl, existing.id])
    : await query('INSERT INTO water_logs (id, user_id, log_date, amount_ml) VALUES ($1, $2, $3, $4) RETURNING *', [crypto.randomUUID(), userId, date, volumeMl]);
  return NextResponse.json({ success: true, water });
});
