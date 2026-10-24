import { NextResponse } from 'next/server';
import { badRequest, isDate, withAuth } from '../../../../lib/route';
import { summaries } from '../../../../lib/connectors/store';
import { METRICS, isMetric } from '../../../../lib/connectors/metrics';

export const GET = withAuth(async (req, userId) => {
  const q = new URL(req.url).searchParams;
  const from = q.get('from'), to = q.get('to');
  if (!isDate(from) || !isDate(to)) return badRequest('from and to (YYYY-MM-DD) are required');
  const wanted = q.get('metrics')?.split(',').filter(Boolean) ?? METRICS;
  if (!wanted.every(isMetric)) return badRequest('unknown metric in metrics');
  return NextResponse.json({ summaries: await summaries(userId, from, to, wanted) });
});
