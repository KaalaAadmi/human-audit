// Single data-access module for connector tables. Every function takes `userId` and filters on it (docs section 5/14):
// the DB connection is privileged, so this is the only thing standing between users' rows.
import { createHash } from 'node:crypto';
import { query } from '../db';
import { METRIC_UNITS, isMetric, isSource, type Metric, type SampleInput, type Source, type Status } from './metrics';
import { dayOf } from './resolve';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === 'string' && UUID.test(s);

/** Deterministic sample id: re-uploading the same origin record is a no-op. */
export const sampleId = (source: Source, metric: Metric, originId: string) =>
  createHash('sha256').update(`${source}\u0000${metric}\u0000${originId}`).digest('hex');

// ---------- jobs ----------
export const enqueue = (kind: string, payload: Record<string, unknown>, delaySec = 0) =>
  query(`INSERT INTO jobs (kind, payload, run_at) VALUES ($1, $2, now() + make_interval(secs => $3))`, [kind, payload, delaySec]);

// ---------- devices ----------
export async function upsertDevice(userId: string, d: { id: string; platform: string; name: string; appVersion?: string; pushToken?: string }) {
  if (!isUuid(d.id)) throw new HttpError(400, 'id must be a uuid');
  if (d.platform !== 'ios' && d.platform !== 'android') throw new HttpError(400, 'platform must be ios or android');
  if (!d.name) throw new HttpError(400, 'name is required');
  // ON CONFLICT is scoped to the owner: a uuid that belongs to another user is rejected, not taken over.
  const [row] = await query(
    `INSERT INTO devices (id, user_id, platform, name, app_version, push_token) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (id) DO UPDATE SET platform=EXCLUDED.platform, name=EXCLUDED.name, app_version=EXCLUDED.app_version,
       push_token=COALESCE(EXCLUDED.push_token, devices.push_token), last_seen_at=now()
     WHERE devices.user_id = EXCLUDED.user_id RETURNING *`,
    [d.id, userId, d.platform, d.name, d.appVersion ?? null, d.pushToken ?? null]
  );
  if (!row) throw new HttpError(409, 'device id belongs to another account');
  return row;
}

// ---------- connections ----------
const CONN_SELECT = `SELECT c.id, c.source, c.status, c.collector_device_id AS "collectorDeviceId", d.name AS "collectorDeviceName",
  d.last_seen_at AS "collectorLastSeenAt", c.granted_metrics AS "grantedMetrics", c.connected_at AS "connectedAt",
  c.last_sync_at AS "lastSyncAt", c.last_sync_error AS "lastSyncError", c.backfill_completed_at AS "backfillCompletedAt"
  FROM connections c LEFT JOIN devices d ON d.id = c.collector_device_id`;

export const listConnections = (userId: string) =>
  query(`${CONN_SELECT} WHERE c.user_id = $1 ORDER BY c.connected_at`, [userId]);

export async function getConnection(userId: string, id: string) {
  if (!isUuid(id)) throw new HttpError(404, 'connection not found');
  const [c] = await query(`${CONN_SELECT} WHERE c.user_id = $1 AND c.id = $2`, [userId, id]);
  if (!c) throw new HttpError(404, 'connection not found');
  return c;
}

const metricList = (xs: unknown): Metric[] => {
  if (!Array.isArray(xs) || !xs.every(isMetric)) throw new HttpError(400, 'grantedMetrics must be a list of known metrics');
  return [...new Set(xs)];
};

/** Create (or revive a disconnected) device-bound connection owned by `deviceId`. */
export async function createConnection(userId: string, b: { source: unknown; deviceId: unknown; grantedMetrics: unknown }) {
  if (!isSource(b.source) || b.source === 'google_health') throw new HttpError(400, 'source must be healthkit or health_connect');
  if (!isUuid(b.deviceId)) throw new HttpError(400, 'deviceId must be a uuid');
  const granted = metricList(b.grantedMetrics);
  const [dev] = await query('SELECT 1 FROM devices WHERE id = $1 AND user_id = $2', [b.deviceId, userId]);
  if (!dev) throw new HttpError(400, 'unknown deviceId; POST /v1/devices first');
  const [row] = await query(
    `INSERT INTO connections (user_id, source, status, collector_device_id, granted_metrics)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id, source) DO UPDATE SET status=EXCLUDED.status, collector_device_id=EXCLUDED.collector_device_id,
       granted_metrics=EXCLUDED.granted_metrics, last_sync_error=NULL, connected_at=now()
     RETURNING id`,
    [userId, b.source, granted.length ? 'connected' : 'partial', b.deviceId, granted]
  );
  return getConnection(userId, row.id);
}

const PATCH_STATUSES: Status[] = ['connected', 'partial', 'stale', 'needs_reauth', 'error'];

export async function patchConnection(userId: string, id: string, b: { grantedMetrics?: unknown; status?: unknown; lastSyncError?: unknown; synced?: unknown }) {
  await getConnection(userId, id);
  const sets: string[] = [];
  const args: unknown[] = [userId, id];
  const set = (col: string, v: unknown) => { args.push(v); sets.push(`${col} = $${args.length}`); };
  if (b.grantedMetrics !== undefined) set('granted_metrics', metricList(b.grantedMetrics));
  if (b.status !== undefined) {
    if (!PATCH_STATUSES.includes(b.status as Status)) throw new HttpError(400, `status must be one of ${PATCH_STATUSES.join(', ')}`);
    set('status', b.status);
  }
  if (b.lastSyncError !== undefined) set('last_sync_error', b.lastSyncError === null ? null : JSON.stringify(b.lastSyncError));
  if (b.synced === true) sets.push('last_sync_at = now()');
  if (sets.length) await query(`UPDATE connections SET ${sets.join(', ')} WHERE user_id = $1 AND id = $2`, args);
  return getConnection(userId, id);
}

/** New phone takes over a device-bound connection. Cursors are device-local, so they are reset and the new device backfills. */
export async function claimCollector(userId: string, id: string, deviceId: unknown) {
  const c = await getConnection(userId, id);
  if (c.source === 'google_health') throw new HttpError(400, 'google_health has no collector device');
  if (!isUuid(deviceId)) throw new HttpError(400, 'deviceId must be a uuid');
  const [dev] = await query('SELECT 1 FROM devices WHERE id = $1 AND user_id = $2', [deviceId, userId]);
  if (!dev) throw new HttpError(400, 'unknown deviceId');
  await query('DELETE FROM sync_cursors WHERE connection_id = $1', [id]);
  await query(`UPDATE connections SET collector_device_id = $3, status = 'connected', last_sync_error = NULL WHERE user_id = $1 AND id = $2`, [userId, id, deviceId]);
  return getConnection(userId, id);
}

/**
 * deleteData=true removes the row and (by FK cascade) its samples. Otherwise the row is kept as `not_connected`
 * so the samples stay but drop out of the order. Tokens and cursors are always cleared.
 */
export async function disconnect(userId: string, id: string, deleteData: boolean) {
  await getConnection(userId, id);
  await query('DELETE FROM oauth_tokens WHERE connection_id = $1', [id]);
  await query('DELETE FROM sync_cursors WHERE connection_id = $1', [id]);
  if (deleteData) await query('DELETE FROM connections WHERE user_id = $1 AND id = $2', [userId, id]);
  else await query(`UPDATE connections SET status = 'not_connected' WHERE user_id = $1 AND id = $2`, [userId, id]);
  await enqueue('summaries_recompute', { userId, dates: null });
}

// ---------- cursors ----------
export async function getCursors(userId: string, connectionId: string) {
  await getConnection(userId, connectionId);
  return query('SELECT metric, cursor, updated_at AS "updatedAt" FROM sync_cursors WHERE connection_id = $1', [connectionId]);
}

export async function putCursor(userId: string, connectionId: string, metric: string, cursor: unknown) {
  await getConnection(userId, connectionId);
  if (!isMetric(metric)) throw new HttpError(400, 'unknown metric');
  if (typeof cursor !== 'string') throw new HttpError(400, 'cursor must be a string');
  await query(
    `INSERT INTO sync_cursors (connection_id, metric, cursor) VALUES ($1,$2,$3)
     ON CONFLICT (connection_id, metric) DO UPDATE SET cursor = EXCLUDED.cursor, updated_at = now()`,
    [connectionId, metric, cursor]
  );
}

// ---------- ingest ----------
export const MAX_SAMPLES = 1000;
const FUTURE_SKEW_MS = 5 * 60_000;

function validate(s: SampleInput, now: number): void {
  if (!isMetric(s.metric)) throw new HttpError(400, `unknown metric ${String(s.metric)}`);
  if (s.unit !== METRIC_UNITS[s.metric]) throw new HttpError(400, `${s.metric} must be in ${METRIC_UNITS[s.metric]}, got ${String(s.unit)}`);
  if (typeof s.originId !== 'string' || !s.originId) throw new HttpError(400, 'originId is required');
  const a = Date.parse(s.startAt);
  const b = Date.parse(s.endAt);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) throw new HttpError(400, 'invalid startAt/endAt');
  if (a > now + FUTURE_SKEW_MS || b > now + FUTURE_SKEW_MS) throw new HttpError(400, 'sample is dated in the future');
  if (s.value !== null && !Number.isFinite(s.value)) throw new HttpError(400, 'value must be a finite number or null');
  if (!Number.isInteger(s.tzOffsetMinutes) || Math.abs(s.tzOffsetMinutes) > 14 * 60) throw new HttpError(400, 'invalid tzOffsetMinutes');
  if (s.metric === 'hrv' && s.variant !== 'sdnn' && s.variant !== 'rmssd') throw new HttpError(400, 'hrv needs variant sdnn or rmssd');
  if (s.metric !== 'hrv' && s.variant) throw new HttpError(400, 'variant is only valid for hrv');
}

export type IngestBody = { connectionId: string; deviceId: string; samples: SampleInput[]; deleted: { originId: string; metric: Metric }[] };

export async function ingest(userId: string, body: IngestBody) {
  const { samples = [], deleted = [] } = body;
  if (!Array.isArray(samples) || !Array.isArray(deleted)) throw new HttpError(400, 'samples and deleted must be arrays');
  if (samples.length > MAX_SAMPLES) throw new HttpError(400, `max ${MAX_SAMPLES} samples per call`);
  if (deleted.length > MAX_SAMPLES) throw new HttpError(400, `max ${MAX_SAMPLES} tombstones per call`);
  if (!isUuid(body.connectionId)) throw new HttpError(404, 'connection not found');

  const [conn] = await query<{ source: Source; collector_device_id: string | null }>(
    'SELECT source, collector_device_id FROM connections WHERE id = $1 AND user_id = $2', [body.connectionId, userId]);
  if (!conn) throw new HttpError(404, 'connection not found');
  if (conn.source === 'google_health' || conn.collector_device_id !== body.deviceId) throw new HttpError(409, 'this device is not the collector for the connection');
  return writeSamples(userId, body.connectionId, conn.source, samples, deleted);
}

/** Validated batch upsert + tombstones + recompute enqueue. Shared by /ingest (device) and the Google Health fetcher (server). */
export async function writeSamples(userId: string, connectionId: string, source: Source, samples: SampleInput[], deleted: { originId: string; metric: Metric }[] = []) {
  const now = Date.now();
  samples.forEach((s) => validate(s, now));
  const dates = new Set<string>();

  let accepted = 0, duplicates = 0;
  if (samples.length) {
    const rows = samples.map((s) => {
      dates.add(dayOf(s.metric, s.startAt, s.tzOffsetMinutes));
      return {
        id: sampleId(source, s.metric, s.originId), metric: s.metric, variant: s.variant ?? null, value: s.value, unit: s.unit,
        start_at: s.startAt, end_at: s.endAt, tz: s.tzOffsetMinutes, origin_app: s.originApp ?? null, origin_device: s.originDevice ?? null,
        origin_id: s.originId, payload: s.payload ?? null,
      };
    });
    // One statement per batch. ON CONFLICT is scoped to this user so ids can never touch another user's rows.
    const res = await query<{ inserted: boolean }>(
      `INSERT INTO samples (id, user_id, connection_id, source, metric, variant, value, unit, start_at, end_at, tz_offset_minutes,
         origin_app, origin_device, origin_id, payload)
       SELECT r.id, $1, $2, $3::source_id, r.metric, r.variant, r.value, r.unit, r.start_at, r.end_at, r.tz,
         r.origin_app, r.origin_device, r.origin_id, r.payload
       FROM jsonb_to_recordset($4::jsonb) AS r(id text, metric text, variant text, value double precision, unit text,
         start_at timestamptz, end_at timestamptz, tz smallint, origin_app text, origin_device text, origin_id text, payload jsonb)
       ON CONFLICT (id) DO UPDATE SET value=EXCLUDED.value, start_at=EXCLUDED.start_at, end_at=EXCLUDED.end_at,
         tz_offset_minutes=EXCLUDED.tz_offset_minutes, payload=EXCLUDED.payload, variant=EXCLUDED.variant, deleted_at=NULL
       WHERE samples.user_id = EXCLUDED.user_id
       RETURNING (xmax = 0) AS inserted`,
      [userId, connectionId, source, JSON.stringify(rows)]
    );
    accepted = res.filter((r) => r.inserted).length;
    duplicates = res.length - accepted;
  }

  let tombstoned = 0;
  if (deleted.length) {
    for (const d of deleted) if (!isMetric(d.metric) || typeof d.originId !== 'string') throw new HttpError(400, 'invalid tombstone');
    const gone = await query<{ metric: Metric; start_at: Date; tz_offset_minutes: number }>(
      `UPDATE samples SET deleted_at = now() WHERE user_id = $1 AND connection_id = $2 AND id = ANY($3) AND deleted_at IS NULL
       RETURNING metric, start_at, tz_offset_minutes`,
      [userId, connectionId, deleted.map((d) => sampleId(source, d.metric, d.originId))]
    );
    tombstoned = gone.length;
    for (const g of gone) dates.add(dayOf(g.metric, g.start_at.toISOString(), g.tz_offset_minutes));
  }

  await query(`UPDATE connections SET last_sync_at = now(), last_sync_error = NULL,
    status = CASE WHEN status IN ('stale','error','connecting') THEN 'connected'::connection_status ELSE status END
    WHERE id = $1 AND user_id = $2`, [connectionId, userId]);
  if (dates.size) await enqueue('summaries_recompute', { userId, dates: [...dates].sort() });
  return { accepted, duplicates, tombstoned };
}

// ---------- preferences / reads ----------
export const getPreferences = (userId: string) =>
  query('SELECT metric, connection_order AS "connectionOrder", updated_at AS "updatedAt" FROM metric_preferences WHERE user_id = $1', [userId]);

export async function putPreference(userId: string, metric: string, order: unknown) {
  if (!isMetric(metric)) throw new HttpError(400, 'unknown metric');
  if (!Array.isArray(order) || !order.every(isUuid) || new Set(order).size !== order.length) throw new HttpError(400, 'connectionOrder must be a list of distinct connection ids');
  const owned = await query<{ id: string }>('SELECT id FROM connections WHERE user_id = $1 AND id = ANY($2)', [userId, order]);
  if (owned.length !== order.length) throw new HttpError(400, 'connectionOrder contains a connection that is not yours');
  await query(
    `INSERT INTO metric_preferences (user_id, metric, connection_order) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, metric) DO UPDATE SET connection_order = EXCLUDED.connection_order, updated_at = now()`,
    [userId, metric, order]
  );
  await enqueue('summaries_recompute', { userId, dates: null, metrics: [metric] });
}

export function summaries(userId: string, from: string, to: string, metrics: Metric[]) {
  return query(
    `SELECT s.local_date AS date, s.metric, s.value, s.unit, s.variant, s.connection_id AS "connectionId", c.source, s.payload
     FROM daily_summaries s LEFT JOIN connections c ON c.id = s.connection_id
     WHERE s.user_id = $1 AND s.local_date BETWEEN $2 AND $3 AND s.metric = ANY($4) ORDER BY s.local_date, s.metric`,
    [userId, from, to, metrics]
  );
}

export function rawSamples(userId: string, metric: Metric, from: string, to: string) {
  // ponytail: hard cap of 5000 rows per request; add paging if a chart needs more.
  return query(
    `SELECT id, connection_id AS "connectionId", source, metric, variant, value, unit, start_at AS "startAt", end_at AS "endAt",
       tz_offset_minutes AS "tzOffsetMinutes", origin_app AS "originApp", origin_device AS "originDevice", payload
     FROM samples WHERE user_id = $1 AND metric = $2 AND start_at >= $3 AND start_at < $4 AND deleted_at IS NULL
     ORDER BY start_at LIMIT 5000`,
    [userId, metric, from, to]
  );
}
