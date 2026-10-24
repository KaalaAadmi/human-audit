import { NextResponse } from 'next/server';
import { withAuth } from '../../../../lib/route';
import { ingest } from '../../../../lib/connectors/store';

export const maxDuration = 60;

/** Batch upsert samples + tombstones from the collector device. Idempotent: ids are server-computed hashes. */
export const POST = withAuth(async (req, userId) => NextResponse.json(await ingest(userId, await req.json())));
