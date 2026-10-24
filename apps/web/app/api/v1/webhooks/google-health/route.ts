import { timingSafeEqual } from 'node:crypto';
import { query } from '../../../../../lib/db';
import { enqueue } from '../../../../../lib/connectors/store';
import { WEBHOOK_METRIC } from '../../../../../lib/connectors/googleHealth';

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const day = (iso: string, plus: number) => new Date(Date.parse(iso) + plus * 86_400_000).toISOString().slice(0, 10);

/**
 * Google Health webhook. Per Google's docs:
 *  - verification handshake: POST 1 carries the Authorization secret -> 200; POST 2 has none -> must be 401/403
 *  - notifications -> 204 as fast as possible (anything else is retried for up to 7 days)
 * ponytail: the GOOGLE-HEALTH-API-SIGNATURE (Tink ECDSA) check is skipped; the shared Authorization secret already authenticates Google.
 */
export async function POST(req: Request) {
  const secret = process.env.GOOGLE_HEALTH_WEBHOOK_SECRET; // the full header value you registered, e.g. "Bearer <random>"
  if (!secret || !same(req.headers.get('authorization') ?? '', secret)) return new Response(null, { status: 401 });

  const body = await req.json().catch(() => null);
  if (body?.type === 'verification') return new Response(null, { status: 200 });

  const items: any[] = (Array.isArray(body) ? body : [body]).map((b) => b?.data).filter(Boolean);
  for (const n of items) {
    const metric = WEBHOOK_METRIC[n.dataType];
    if (!metric || typeof n.healthUserId !== 'string') continue;
    const [c] = await query<{ id: string }>(`SELECT id FROM connections WHERE source = 'google_health' AND external_user_id = $1 AND status <> 'needs_reauth'`, [n.healthUserId]);
    if (!c) continue;
    // One fetch per notification, window = the changed intervals padded a day either side (timezones).
    // ponytail: DELETE notifications re-fetch the window but do not remove rows; tombstoning needs the data point name, which the payload omits.
    const starts: string[] = (n.intervals ?? []).map((i: any) => i.physicalTimeInterval?.startTime).filter(Boolean).sort();
    const ends: string[] = (n.intervals ?? []).map((i: any) => i.physicalTimeInterval?.endTime).filter(Boolean).sort();
    const now = new Date().toISOString();
    await enqueue('gh_fetch', { connectionId: c.id, metric, from: starts.length ? day(starts[0]!, -1) : day(now, -2), to: ends.length ? day(ends.at(-1)!, 2) : day(now, 1) });
  }
  return new Response(null, { status: 204 });
}
