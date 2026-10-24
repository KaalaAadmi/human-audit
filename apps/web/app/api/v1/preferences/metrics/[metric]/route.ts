import { NextResponse, type NextRequest } from 'next/server';
import { withAuth } from '../../../../../../lib/route';
import { putPreference } from '../../../../../../lib/connectors/store';

/** Primary + fallbacks for one metric; enqueues a recompute of that metric's whole history. */
export const PUT = (req: NextRequest, { params }: { params: Promise<{ metric: string }> }) =>
  withAuth(async (r, userId) => {
    await putPreference(userId, (await params).metric, (await r.json()).connectionOrder);
    return NextResponse.json({ success: true });
  })(req);
