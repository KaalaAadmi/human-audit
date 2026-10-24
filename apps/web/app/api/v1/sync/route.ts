import { NextResponse } from 'next/server';
import { withAuth } from '../../../../lib/route';
import { enqueue } from '../../../../lib/connectors/store';
import { query } from '../../../../lib/db';
import { FETCH } from '../../../../lib/connectors/googleHealth';
import type { Metric } from '../../../../lib/connectors/metrics';

/** App open / pull-to-refresh: queue a short Google Health fetch for this user (the worker does the work). */
export const POST = withAuth(async (_req, userId) => {
  const conns = await query<{ id: string; granted_metrics: Metric[] }>(
    `SELECT id, granted_metrics FROM connections WHERE user_id = $1 AND source = 'google_health' AND status IN ('connected','partial','stale','error')`, [userId]);
  const d = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  let queued = 0;
  for (const c of conns) for (const m of c.granted_metrics) if (FETCH[m]) { await enqueue('gh_fetch', { connectionId: c.id, metric: m, from: d(-2), to: d(1) }); queued++; }
  return NextResponse.json({ queued }, { status: 202 });
});
