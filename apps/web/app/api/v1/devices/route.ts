import { NextResponse } from 'next/server';
import { withAuth } from '../../../../lib/route';
import { upsertDevice } from '../../../../lib/connectors/store';

/** Register/refresh this phone. The id is generated on first launch and kept in expo-secure-store. */
export const POST = withAuth(async (req, userId) => {
  const b = await req.json();
  return NextResponse.json({ device: await upsertDevice(userId, b) });
});
