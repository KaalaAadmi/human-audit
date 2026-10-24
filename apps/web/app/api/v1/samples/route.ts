import { NextResponse } from 'next/server';
import { badRequest, isDate, withAuth } from '../../../../lib/route';
import { rawSamples } from '../../../../lib/connectors/store';
import { isMetric } from '../../../../lib/connectors/metrics';

export const GET = withAuth(async (req, userId) => {
  const q = new URL(req.url).searchParams;
  const metric = q.get('metric'), from = q.get('from'), to = q.get('to');
  if (!isMetric(metric)) return badRequest('metric is required');
  if (!isDate(from) || !isDate(to)) return badRequest('from and to (YYYY-MM-DD) are required');
  return NextResponse.json({ samples: await rawSamples(userId, metric, from, to) });
});
