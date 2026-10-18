import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { badRequest, withAuth } from '../../../lib/route';

export const GET = withAuth(async (_req, userId) => {
  const foods = await query('SELECT * FROM custom_foods WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return NextResponse.json({ success: true, foods });
});

export const POST = withAuth(async (req, userId) => {
  const b = await req.json();
  if (!b.name || ![b.servingSizeG, b.calories, b.proteinG, b.carbsG, b.fatsG].every(Number.isFinite)) {
    return badRequest('name, servingSizeG, calories, proteinG, carbsG, fatsG are required');
  }
  const [food] = await query(
    `INSERT INTO custom_foods (user_id, name, brand, serving_size_g, calories, protein_g, carbs_g, fats_g, barcode)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
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
