import { NextResponse, type NextRequest } from 'next/server';
import { withAuth } from '../../../../../../lib/route';
import { putCursor } from '../../../../../../lib/connectors/store';

/** Collector saves the HealthKit anchor / Health Connect token only after /ingest returned 2xx. */
export const PUT = (req: NextRequest, { params }: { params: Promise<{ connectionId: string; metric: string }> }) =>
  withAuth(async (r, userId) => {
    const { connectionId, metric } = await params;
    await putCursor(userId, connectionId, metric, (await r.json()).cursor);
    return NextResponse.json({ success: true });
  })(req);
