import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { badRequest, withAuth } from '../../../lib/route';

export const GET = withAuth(async (_req, userId) => {
  const goals = await query('SELECT * FROM daily_macro_goals WHERE user_id = $1 ORDER BY day_of_week', [userId]);
  return NextResponse.json({ success: true, goals });
});

/** Upsert one weekday's goals (0 = Sunday ... 6 = Saturday). */
export const PUT = withAuth(async (req, userId) => {
  const { dayOfWeek: d, calories, proteinG, carbsG, fatG } = await req.json();
  if (!Number.isInteger(d) || d < 0 || d > 6 || ![calories, proteinG, carbsG, fatG].every(Number.isFinite)) {
    return badRequest('dayOfWeek (0-6), calories, proteinG, carbsG, fatG are required');
  }
  const [goal] = await query(
    `INSERT INTO daily_macro_goals (id, user_id, day_of_week, target_calories, target_protein_g, target_carbs_g, target_fats_g)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, day_of_week) DO UPDATE SET target_calories = EXCLUDED.target_calories,
       target_protein_g = EXCLUDED.target_protein_g, target_carbs_g = EXCLUDED.target_carbs_g, target_fats_g = EXCLUDED.target_fats_g
     RETURNING *`,
    [crypto.randomUUID(), userId, d, Math.round(calories), Math.round(proteinG), Math.round(carbsG), Math.round(fatG)]
  );
  return NextResponse.json({ success: true, goal });
});
