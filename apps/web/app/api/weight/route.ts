import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { withAuth } from '../../../lib/route';

/** Weight history (kg), oldest first: one synced reading per day from daily_vitals_summary. */
export const GET = withAuth(async (_req, userId) => {
  const rows = await query(
    `SELECT summary_date::text AS date, scale_weight_kg::float AS kg
       FROM daily_vitals_summary
      WHERE user_id = $1 AND scale_weight_kg IS NOT NULL
      ORDER BY summary_date DESC LIMIT 365`,
    [userId]
  );
  return NextResponse.json({ success: true, weights: rows.reverse() });
});
