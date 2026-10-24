import { NextResponse, after } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { runJobs } from '../../../../../lib/connectors/jobs';

export const maxDuration = 60;
const BUDGET_MS = 50_000; // stop taking new jobs after ~50 s so a run ends before the next minute's call

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Wake-up call from any scheduler (Vercel Cron, pg_cron + pg_net, cron-job.org): header x-worker-secret. Responds first, works after. */
export async function POST(req: Request) {
  const secret = process.env.WORKER_SECRET;
  if (!secret || !same(req.headers.get('x-worker-secret') ?? '', secret)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  after(async () => { console.log('[jobs]', await runJobs(BUDGET_MS)); });
  return new NextResponse(null, { status: 202 });
}
