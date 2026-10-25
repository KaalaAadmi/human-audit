import { NextResponse } from 'next/server';
import { badRequest, isDate, withAuth } from '../../../lib/route';
import { sleepNight } from '../../../lib/connectors/sleep';

/** Latest night on or before ?date= with its score, stage totals and stage timeline (null until a source has synced sleep). */
export const GET = withAuth(async (req, userId) => {
  const date = new URL(req.url).searchParams.get('date');
  if (!isDate(date)) return badRequest('date (YYYY-MM-DD) is required');
  return NextResponse.json({ sleep: await sleepNight(userId, date) });
});
