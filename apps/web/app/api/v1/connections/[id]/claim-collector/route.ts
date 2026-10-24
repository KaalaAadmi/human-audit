import { NextResponse, type NextRequest } from 'next/server';
import { withAuth } from '../../../../../../lib/route';
import { claimCollector } from '../../../../../../lib/connectors/store';

/** New phone takes over a device-bound connection. */
export const POST = (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  withAuth(async (r, userId) => NextResponse.json({ connection: await claimCollector(userId, (await params).id, (await r.json()).deviceId) }))(req);
