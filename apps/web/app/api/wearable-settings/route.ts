import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { badRequest, withAuth } from '../../../lib/route';

export const GET = withAuth(async (_req, userId) => {
  const [settings] = await query('SELECT * FROM wearable_settings WHERE user_id = $1', [userId]);
  return NextResponse.json({ success: true, settings: settings ?? null });
});

const COLS: Record<string, string> = {
  priority1: 'priority_1', priority2: 'priority_2', priority3: 'priority_3',
  humeScaleConnected: 'hume_scale_connected', fittrConnected: 'fittr_connected', fiteloConnected: 'fitelo_connected',
  appleHealthConnected: 'apple_health_connected', healthConnectConnected: 'health_connect_connected',
};

/** Partial upsert; only whitelisted fields are written, the rest keep their DB defaults / current values. */
export const PUT = withAuth(async (req, userId) => {
  const b = await req.json();
  const keys = Object.keys(COLS).filter((k) => b[k] !== undefined);
  if (!keys.length) return badRequest('no settings provided');
  const cols = keys.map((k) => COLS[k]);
  const [settings] = await query(
    `INSERT INTO wearable_settings (user_id, ${cols.join(', ')}) VALUES ($1, ${keys.map((_, i) => `$${i + 2}`).join(', ')})
     ON CONFLICT (user_id) DO UPDATE SET ${cols.map((c) => `${c} = EXCLUDED.${c}`).join(', ')}, updated_at = now() RETURNING *`,
    [userId, ...keys.map((k) => b[k])]
  );
  return NextResponse.json({ success: true, settings });
});
