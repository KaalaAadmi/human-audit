import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { withAuth } from '../../../lib/route';

/** Deletes all of the user's data (FKs cascade). The Clerk account itself is deleted client-side via user.delete(). */
export const DELETE = withAuth(async (_req, userId) => {
  await query('DELETE FROM user_profiles WHERE id = $1', [userId]);
  return NextResponse.json({ success: true });
});
