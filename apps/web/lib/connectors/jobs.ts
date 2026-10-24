// Postgres-backed job queue (replaces pgmq from docs section 9) + the Google Health sync jobs.
// Drained by POST /api/v1/jobs/run (hit it every minute from any scheduler). Safe to run concurrently: claims use FOR UPDATE SKIP LOCKED.
import { query } from '../db';
import { accessToken, FETCH, NeedsReauth, fetchMetric } from './googleHealth';
import { enqueue, writeSamples } from './store';
import { recompute } from './summaries';
import type { Metric } from './metrics';

const MAX_ATTEMPTS = 5;
const VISIBILITY_SEC = 120;
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

type Job = { id: number; kind: string; payload: any; attempts: number };

async function claim(): Promise<Job | null> {
  const [j] = await query<Job>(
    `UPDATE jobs SET attempts = attempts + 1, locked_until = now() + make_interval(secs => $1)
     WHERE id = (SELECT id FROM jobs WHERE failed_at IS NULL AND run_at <= now() AND (locked_until IS NULL OR locked_until < now())
                 ORDER BY run_at, id LIMIT 1 FOR UPDATE SKIP LOCKED)
     RETURNING id, kind, payload, attempts`, [VISIBILITY_SEC]);
  return j ?? null;
}

async function connection(connectionId: string) {
  const [c] = await query<{ id: string; user_id: string; status: string; granted_metrics: Metric[] }>(
    `SELECT id, user_id, status, granted_metrics FROM connections WHERE id = $1 AND source = 'google_health'`, [connectionId]);
  return c;
}

/** Fetch [from, to) for one metric and store it. Samples are chunked to keep each INSERT small. */
async function ghFetch(connectionId: string, metric: Metric, from: string, to: string) {
  const c = await connection(connectionId);
  if (!c || c.status === 'needs_reauth' || c.status === 'not_connected') return; // nothing to do; do not retry
  if (!FETCH[metric]) return;
  try {
    const samples = await fetchMetric(await accessToken(connectionId), metric, from, to);
    for (let i = 0; i < samples.length; i += 500) await writeSamples(c.user_id, connectionId, 'google_health', samples.slice(i, i + 500));
    await query(`UPDATE connections SET last_sync_at = now(), last_sync_error = NULL,
      status = CASE WHEN status IN ('stale','error','connecting') THEN 'connected'::connection_status ELSE status END WHERE id = $1`, [connectionId]);
  } catch (e) {
    if (e instanceof NeedsReauth) return; // accessToken() already flagged the connection
    await query('UPDATE connections SET last_sync_error = $2 WHERE id = $1', [connectionId, JSON.stringify({ at: new Date().toISOString(), message: String((e as Error).message).slice(0, 300) })]);
    throw e; // retried by the queue
  }
}

const HANDLERS: Record<string, (p: any) => Promise<unknown>> = {
  summaries_recompute: (p) => recompute(p.userId, p.dates ?? null),

  /** Last 14 days per granted metric right after connect, then days 15-30 queued as cold loads. */
  async gh_hot_load(p: { connectionId: string }) {
    const c = await connection(p.connectionId);
    if (!c) return;
    for (const m of c.granted_metrics) {
      await ghFetch(p.connectionId, m, day(-14), day(1));
      if (FETCH[m]) await enqueue('gh_cold_load', { connectionId: p.connectionId, metric: m, from: day(-30), to: day(-14) });
    }
    if (!c.granted_metrics.some((m) => FETCH[m])) await query('UPDATE connections SET backfill_completed_at = now() WHERE id = $1', [p.connectionId]);
  },

  async gh_cold_load(p: { connectionId: string; metric: Metric; from: string; to: string }) {
    await ghFetch(p.connectionId, p.metric, p.from, p.to);
    const [left] = await query<{ n: string }>(
      `SELECT count(*) AS n FROM jobs WHERE kind = 'gh_cold_load' AND failed_at IS NULL AND payload->>'connectionId' = $1`, [p.connectionId]);
    if (Number(left!.n) <= 1) await query('UPDATE connections SET backfill_completed_at = now() WHERE id = $1', [p.connectionId]); // this job is still in the table
  },

  gh_fetch: (p: { connectionId: string; metric: Metric; from: string; to: string }) => ghFetch(p.connectionId, p.metric, p.from, p.to),

  /** Safety net for missed webhooks, and the only path for active energy (no webhook). Last 2 days, jittered over 30 min. */
  async gh_poll() {
    const conns = await query<{ id: string; granted_metrics: Metric[] }>(
      `SELECT id, granted_metrics FROM connections WHERE source = 'google_health' AND status IN ('connected','partial','stale','error')`);
    for (const c of conns) {
      const delay = Math.floor(Math.random() * 1800);
      for (const m of c.granted_metrics) if (FETCH[m]) await enqueue('gh_fetch', { connectionId: c.id, metric: m, from: day(-2), to: day(1) }, delay);
    }
  },

  /** connected -> stale after 24 h without sync; device-bound -> collector_missing after 14 days unseen. */
  async connections_stale_check() {
    await query(`UPDATE connections SET status = 'stale' WHERE status = 'connected' AND coalesce(last_sync_at, connected_at) < now() - interval '24 hours'`);
    await query(`UPDATE connections c SET status = 'collector_missing' FROM devices d
      WHERE d.id = c.collector_device_id AND c.status IN ('connected','partial','stale') AND d.last_seen_at < now() - interval '14 days'`);
    // ponytail: no push nudge to the collector device yet (needs expo-notifications push tokens wired).
  },
};

const RECURRING: Record<string, number> = { gh_poll: 4 * 3600, connections_stale_check: 3600 };

/** Bootstrap: make sure each recurring job has one pending row. After it runs it re-enqueues itself `every` seconds out. */
async function schedule() {
  for (const kind of Object.keys(RECURRING)) {
    await query(`INSERT INTO jobs (kind) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE kind = $1 AND failed_at IS NULL)`, [kind]);
  }
}

/** Process jobs until the budget runs out. Returns counts for logging. */
export async function runJobs(budgetMs: number) {
  const deadline = Date.now() + budgetMs;
  const stats = { done: 0, retried: 0, failed: 0 };
  await schedule();
  while (Date.now() < deadline) {
    const job = await claim();
    if (!job) break;
    try {
      const handler = HANDLERS[job.kind];
      if (!handler) throw new Error(`unknown job kind ${job.kind}`);
      await handler(job.payload);
      await query('DELETE FROM jobs WHERE id = $1', [job.id]);
      if (RECURRING[job.kind]) await enqueue(job.kind, {}, RECURRING[job.kind]);
      stats.done++;
    } catch (e) {
      const dead = job.attempts >= MAX_ATTEMPTS;
      console.error(`[jobs] ${job.kind} #${job.id} attempt ${job.attempts}`, e);
      await query('UPDATE jobs SET last_error = $2, failed_at = CASE WHEN $3 THEN now() END WHERE id = $1', [job.id, String((e as Error).message).slice(0, 500), dead]);
      dead ? stats.failed++ : stats.retried++;
    }
  }
  return stats;
}
