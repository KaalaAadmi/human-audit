import { NextResponse } from 'next/server';
import { withAuth } from '../../../../lib/route';
import { createConnection, listConnections } from '../../../../lib/connectors/store';

export const GET = withAuth(async (_req, userId) => NextResponse.json({ connections: await listConnections(userId) }));

/** Collector device creates a device-bound connection (healthkit | health_connect). */
export const POST = withAuth(async (req, userId) =>
  NextResponse.json({ connection: await createConnection(userId, await req.json()) }, { status: 201 }));
