import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { badRequest, withAuth } from '../../../lib/route';
import { enqueue } from '../../../lib/connectors/store';

// Whitelist = the only column names that ever reach the SQL text.
const FIELDS = [
  'email',
  'display_name',
  'chronological_birthdate',
  'height_cm',
  'weight_kg',
  'sex',
  'waist_cm',
  'water_goal_ml',
  'water_reminder_interval_mins',
  'water_reminder_enabled',
  'water_reminder_start_min',
  'water_reminder_end_min',
] as const;

export const GET = withAuth(async (_req, userId) => {
  const [profile] = await query('SELECT * FROM user_profiles WHERE id = $1', [userId]);
  return NextResponse.json({ success: true, profile: profile ?? null });
});

/** Create or partially update the caller's profile. Creating needs every NOT NULL field (else 400). */
export const POST = withAuth(async (req, userId) => {
  const body = await req.json();
  // numeric(5,1) column; 40-200 cm also rejects typos like 8.2 or 820.
  if (body.waist_cm != null && !(Number(body.waist_cm) >= 40 && Number(body.waist_cm) <= 200)) return badRequest('waist_cm must be between 40 and 200');
  const cols = FIELDS.filter((f) => body[f] !== undefined);
  const vals = cols.map((f) => body[f]);

  if (cols.length) {
    const set = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
    const [updated] = await query(`UPDATE user_profiles SET ${set}, updated_at = NOW() WHERE id = $1 RETURNING *`, [userId, ...vals]);
    if (updated) {
      // Fitness age / VO2max are derived from the waist: recompute so existing days pick it up.
      if (cols.includes('waist_cm')) await enqueue('summaries_recompute', { userId, dates: null });
      return NextResponse.json({ success: true, profile: updated });
    }
  }

  const marks = cols.map((_, i) => `$${i + 2}`).join(', ');
  const [created] = await query(
    `INSERT INTO user_profiles (id${cols.map((c) => `, ${c}`).join('')}) VALUES ($1${cols.length ? ', ' : ''}${marks}) RETURNING *`,
    [userId, ...vals]
  );
  return NextResponse.json({ success: true, profile: created });
});
