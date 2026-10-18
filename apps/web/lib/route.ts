import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from './auth';

type Handler = (req: NextRequest, userId: string) => Promise<Response>;

export const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });

/** True for a real calendar date in YYYY-MM-DD form (clients send their *local* day; the server never guesses a timezone). */
export const isDate = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().startsWith(s);

/** Route handler wrapper: 401 without a valid Clerk token; the handler gets the verified Clerk user id. */
export const withAuth = (handler: Handler) => async (req: NextRequest) => {
  const userId = await authenticate(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return await handler(req, userId);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    // Bad JSON body, or Postgres class 22/23 (bad value, constraint violation e.g. no profile row yet).
    if (e instanceof SyntaxError || /^2[23]/.test(err.code ?? '')) return badRequest(err.message ?? 'Bad request');
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
};
