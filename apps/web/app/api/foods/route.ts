import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { badRequest, isDate, withAuth } from '../../../lib/route';

export const GET = withAuth(async (req, userId) => {
  const date = new URL(req.url).searchParams.get('date');
  if (!isDate(date)) return badRequest('date (YYYY-MM-DD) is required');
  const foods = await query('SELECT * FROM food_logs WHERE user_id = $1 AND log_date = $2 ORDER BY logged_at', [userId, date]);
  return NextResponse.json({ success: true, foods });
});

export const POST = withAuth(async (req, userId) => {
  const b = await req.json();
  if (!isDate(b.logDate) || !b.foodName || !Number.isFinite(b.calories)) return badRequest('logDate (YYYY-MM-DD), foodName and calories are required');
  const [food] = await query(
    `INSERT INTO food_logs (id, user_id, log_date, meal_type, food_name, serving_quantity, serving_unit, calories, protein_g, carbs_g, fats_g, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
    [
      crypto.randomUUID(), userId, b.logDate, b.mealType ?? 'snack', b.foodName,
      b.servingQuantity ?? 100, b.servingUnit ?? 'g', Math.round(b.calories),
      b.proteinG ?? 0, b.carbsG ?? 0, b.fatsG ?? 0, b.source ?? 'custom',
    ]
  );
  return NextResponse.json({ success: true, food });
});

export const PUT = withAuth(async (req, userId) => {
  const b = await req.json();
  if (!b.id) return badRequest('id is required');
  const [food] = await query(
    `UPDATE food_logs SET
      meal_type = COALESCE($3, meal_type),
      food_name = COALESCE($4, food_name),
      serving_quantity = COALESCE($5, serving_quantity),
      serving_unit = COALESCE($6, serving_unit),
      calories = COALESCE($7, calories),
      protein_g = COALESCE($8, protein_g),
      carbs_g = COALESCE($9, carbs_g),
      fats_g = COALESCE($10, fats_g)
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [
      b.id,
      userId,
      b.mealType ?? null,
      b.foodName ?? null,
      b.servingQuantity ?? null,
      b.servingUnit ?? null,
      b.calories !== undefined ? Math.round(b.calories) : null,
      b.proteinG ?? null,
      b.carbsG ?? null,
      b.fatsG ?? null,
    ]
  );
  return NextResponse.json({ success: true, food });
});

export const DELETE = withAuth(async (req, userId) => {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return badRequest('id is required');
  const rows = await query('DELETE FROM food_logs WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
  return NextResponse.json({ success: rows.length > 0 });
});
