import { NextResponse, type NextRequest } from 'next/server';
import { withAuth } from '../../../../../lib/route';
import { getCursors } from '../../../../../lib/connectors/store';

export const GET = (req: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) =>
  withAuth(async (_r, userId) => NextResponse.json({ cursors: await getCursors(userId, (await params).connectionId) }))(req);
