import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { badRequest, withAuth } from '../../../lib/route';

/** Every user's recipes are shared, labelled with the author's display name; `mine` marks the caller's own (the only deletable ones). */
export const GET = withAuth(async (_req, userId) => {
  try {
    // ponytail: fixed cap of 200, no pagination; add search/paging if the shared library outgrows it.
    const recipes = await query(
      `SELECT r.*, r.user_id = $1 AS mine, p.display_name AS author
       FROM custom_recipes r JOIN user_profiles p ON p.id = r.user_id
       WHERE r.user_id = $1 OR (NOT r.hidden AND NOT EXISTS (SELECT 1 FROM content_reports c WHERE c.user_id = $1 AND c.kind = 'recipe' AND c.item_id = r.id))
       ORDER BY mine DESC, r.created_at DESC LIMIT 200`, [userId]);
    return NextResponse.json({ success: true, recipes });
  } catch {
    // If migration 0001 has not yet been executed in live Supabase, return empty array gracefully
    return NextResponse.json({ success: true, recipes: [] });
  }
});

export const POST = withAuth(async (req, userId) => {
  const b = await req.json();
  if (!b.name || !Array.isArray(b.ingredients) || ![b.totalCalories, b.totalProteinG, b.totalCarbsG, b.totalFatsG].every(Number.isFinite)) {
    return badRequest('name, ingredients[], totalCalories, totalProteinG, totalCarbsG, totalFatsG are required');
  }
  const [recipe] = await query(
    `INSERT INTO custom_recipes (user_id, name, total_servings, total_calories, total_protein_g, total_carbs_g, total_fats_g, ingredients_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *, true AS mine, (SELECT display_name FROM user_profiles WHERE id = $1) AS author`,
    [userId, b.name, Math.max(1, Math.round(b.totalServings ?? 1)), Math.round(b.totalCalories), b.totalProteinG, b.totalCarbsG, b.totalFatsG, JSON.stringify(b.ingredients)]
  );
  return NextResponse.json({ success: true, recipe });
});

export const DELETE = withAuth(async (req, userId) => {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return badRequest('id is required');
  const rows = await query('DELETE FROM custom_recipes WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
  return NextResponse.json({ success: rows.length > 0 });
});
