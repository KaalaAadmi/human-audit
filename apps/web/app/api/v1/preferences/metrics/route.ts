import { NextResponse } from 'next/server';
import { withAuth } from '../../../../../lib/route';
import { getPreferences } from '../../../../../lib/connectors/store';

export const GET = withAuth(async (_req, userId) => NextResponse.json({ preferences: await getPreferences(userId) }));
