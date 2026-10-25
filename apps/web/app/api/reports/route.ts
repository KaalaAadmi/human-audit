import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { badRequest, withAuth } from '../../../lib/route';

/** Distinct reporters after which a shared food / recipe disappears for everyone but its author. */
const REPORT_HIDE_THRESHOLD = 3;
/** Reasons offered by the app; anything else is stored as 'other' (free text from a client is not trusted). */
const REASONS = ['offensive', 'wrong_values', 'spam', 'other'];
const TABLE = { food: 'custom_foods', recipe: 'custom_recipes' } as const;

/** Report another user's shared food or recipe. The reporter stops seeing it at once (the list and search routes skip items the caller reported). */
export const POST = withAuth(async (req, userId) => {
  const b = await req.json();
  const kind = b.kind as keyof typeof TABLE;
  if (!(kind in TABLE) || typeof b.id !== 'string') return badRequest("kind ('food' | 'recipe') and id are required");
  const reason = REASONS.includes(b.reason) ? b.reason : 'other';

  const [item] = await query<{ user_id: string }>(`SELECT user_id FROM ${TABLE[kind]} WHERE id = $1`, [b.id]); // a non-uuid id -> 22P02 -> 400
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (item.user_id === userId) return badRequest('You cannot report your own item; delete it instead');

  await query(
    `INSERT INTO content_reports (user_id, kind, item_id, reason) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, kind, item_id) DO NOTHING`,
    [userId, kind, b.id, reason]);
  const hidden = await query(
    `UPDATE ${TABLE[kind]} SET hidden = true WHERE id = $1
       AND (SELECT count(*) FROM content_reports WHERE kind = $2 AND item_id = $1) >= $3 RETURNING id`,
    [b.id, kind, REPORT_HIDE_THRESHOLD]);
  return NextResponse.json({ success: true, hidden: hidden.length > 0 });
});
