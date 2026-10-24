import { NextResponse, type NextRequest } from 'next/server';
import { withAuth } from '../../../../../lib/route';
import { disconnect, patchConnection } from '../../../../../lib/connectors/store';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = (req: NextRequest, { params }: Ctx) =>
  withAuth(async (r, userId) => NextResponse.json({ connection: await patchConnection(userId, (await params).id, await r.json()) }))(req);

export const DELETE = (req: NextRequest, { params }: Ctx) =>
  withAuth(async (r, userId) => {
    await disconnect(userId, (await params).id, new URL(r.url).searchParams.get('deleteData') === 'true');
    return NextResponse.json({ success: true });
  })(req);
