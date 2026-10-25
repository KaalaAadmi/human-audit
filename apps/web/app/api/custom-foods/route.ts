import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { badRequest, withAuth } from '../../../lib/route';

/** Every user's foods are shared (name only, no author); `mine` marks the caller's own, which are the only ones they can delete. */
export const GET = withAuth(async (_req, userId) => {
  // ponytail: fixed cap of 200, no pagination; add search/paging if the shared library outgrows it.
  const foods = await query(`SELECT f.*, f.user_id = $1 AS mine FROM custom_foods f
     WHERE f.user_id = $1 OR (NOT f.hidden AND NOT EXISTS (SELECT 1 FROM content_reports c WHERE c.user_id = $1 AND c.kind = 'food' AND c.item_id = f.id))
     ORDER BY mine DESC, created_at DESC LIMIT 200`, [userId]);
  return NextResponse.json({ success: true, foods });
});

export const POST = withAuth(async (req, userId) => {
  const b = await req.json();
  if (!b.name || ![b.servingSizeG, b.calories, b.proteinG, b.carbsG, b.fatsG].every(Number.isFinite)) {
    return badRequest('name, servingSizeG, calories, proteinG, carbsG, fatsG are required');
  }
  const [food] = await query(
    `INSERT INTO custom_foods (user_id, name, brand, serving_size_g, calories, protein_g, carbs_g, fats_g, barcode)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *, true AS mine`,
    [userId, b.name, b.brand ?? null, b.servingSizeG, Math.round(b.calories), b.proteinG, b.carbsG, b.fatsG, b.barcode ?? null]
  );
  return NextResponse.json({ success: true, food });
});

export const DELETE = withAuth(async (req, userId) => {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return badRequest('id is required');
  const rows = await query('DELETE FROM custom_foods WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
  return NextResponse.json({ success: rows.length > 0 });
});
