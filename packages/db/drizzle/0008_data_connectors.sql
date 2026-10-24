-- Migration 0008: data connectors (docs/data-connectors.md section 5).
-- Idempotent. RLS on, no policies: only the privileged server connection can read/write.
-- Deviation from the doc: job queue is a plain `jobs` table (no pgmq/pg_cron/pg_net), so it runs on any Postgres.

DO $$ BEGIN CREATE TYPE source_id AS ENUM ('healthkit', 'health_connect', 'google_health'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE connection_status AS ENUM ('connecting', 'connected', 'partial', 'stale', 'needs_reauth', 'collector_missing', 'error', 'not_connected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "devices" (
  "id" uuid PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user_profiles"("id") ON DELETE CASCADE,
  "platform" text NOT NULL CHECK ("platform" IN ('ios', 'android')),
  "name" text NOT NULL,
  "app_version" text,
  "push_token" text,
  "last_seen_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "user_profiles"("id") ON DELETE CASCADE,
  "source" source_id NOT NULL,
  "status" connection_status DEFAULT 'connecting' NOT NULL,
  "collector_device_id" uuid REFERENCES "devices"("id"),
  "granted_metrics" text[] DEFAULT '{}' NOT NULL,
  "granted_scopes" text[],
  "external_user_id" text,
  "connected_at" timestamptz DEFAULT now() NOT NULL,
  "last_sync_at" timestamptz,
  "last_sync_error" jsonb,
  "backfill_completed_at" timestamptz,
  UNIQUE ("user_id", "source"),
  CHECK ("source" = 'google_health' OR "collector_device_id" IS NOT NULL)
);
-- Webhooks look the connection up by Google's healthUserId.
CREATE INDEX IF NOT EXISTS "connections_external_user" ON "connections" ("external_user_id") WHERE "external_user_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "sync_cursors" (
  "connection_id" uuid NOT NULL REFERENCES "connections"("id") ON DELETE CASCADE,
  "metric" text NOT NULL,
  "cursor" text NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("connection_id", "metric")
);

CREATE TABLE IF NOT EXISTS "oauth_tokens" (
  "connection_id" uuid PRIMARY KEY REFERENCES "connections"("id") ON DELETE CASCADE,
  "refresh_token_enc" bytea NOT NULL,
  "access_token_enc" bytea,
  "access_token_expires_at" timestamptz,
  "scopes" text[] NOT NULL
);

CREATE TABLE IF NOT EXISTS "samples" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user_profiles"("id") ON DELETE CASCADE,
  "connection_id" uuid NOT NULL REFERENCES "connections"("id") ON DELETE CASCADE,
  "source" source_id NOT NULL,
  "metric" text NOT NULL,
  "variant" text,
  "value" double precision,
  "unit" text NOT NULL,
  "start_at" timestamptz NOT NULL,
  "end_at" timestamptz NOT NULL,
  "tz_offset_minutes" smallint NOT NULL,
  "origin_app" text,
  "origin_device" text,
  "origin_id" text NOT NULL,
  "payload" jsonb,
  "deleted_at" timestamptz,
  "ingested_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "samples_user_metric_start" ON "samples" ("user_id", "metric", "start_at");
CREATE INDEX IF NOT EXISTS "samples_connection_start" ON "samples" ("connection_id", "start_at");

CREATE TABLE IF NOT EXISTS "metric_preferences" (
  "user_id" text NOT NULL REFERENCES "user_profiles"("id") ON DELETE CASCADE,
  "metric" text NOT NULL,
  "connection_order" uuid[] NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("user_id", "metric")
);

CREATE TABLE IF NOT EXISTS "daily_summaries" (
  "user_id" text NOT NULL REFERENCES "user_profiles"("id") ON DELETE CASCADE,
  "local_date" date NOT NULL,
  "metric" text NOT NULL,
  "value" double precision,
  "unit" text NOT NULL,
  "connection_id" uuid REFERENCES "connections"("id") ON DELETE SET NULL,
  "variant" text,
  "payload" jsonb, -- sleep stage minutes / winning workout ids
  PRIMARY KEY ("user_id", "local_date", "metric")
);
CREATE INDEX IF NOT EXISTS "daily_summaries_metric_date" ON "daily_summaries" ("user_id", "metric", "local_date");

CREATE TABLE IF NOT EXISTS "origin_map" (
  "origin_app" text PRIMARY KEY,
  "label" text NOT NULL,
  "mirrors_source" source_id
);
INSERT INTO "origin_map" ("origin_app", "label", "mirrors_source") VALUES
  ('com.fitbit.FitbitMobile', 'Google Health app', 'google_health'),
  ('com.kaalaaadmi.humanaudit', 'HumanAudit', NULL)
ON CONFLICT DO NOTHING;

-- Postgres-backed job queue, drained by POST /api/v1/jobs/run.
CREATE TABLE IF NOT EXISTS "jobs" (
  "id" bigserial PRIMARY KEY,
  "kind" text NOT NULL,
  "payload" jsonb DEFAULT '{}' NOT NULL,
  "run_at" timestamptz DEFAULT now() NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "locked_until" timestamptz,
  "failed_at" timestamptz,
  "last_error" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "jobs_ready" ON "jobs" ("run_at") WHERE "failed_at" IS NULL;

ALTER TABLE "devices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sync_cursors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "oauth_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "samples" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "metric_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_summaries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "origin_map" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;

-- Single-use OAuth `state` nonces (consumed with DELETE ... RETURNING in the callback).
CREATE TABLE IF NOT EXISTS "oauth_states" (
  "nonce" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user_profiles"("id") ON DELETE CASCADE,
  "device_id" uuid,
  "expires_at" timestamptz NOT NULL
);
ALTER TABLE "oauth_states" ENABLE ROW LEVEL SECURITY;

-- HRV variant for the legacy summary row ('sdnn' Apple Health | 'rmssd' Health Connect / Google). The column name overnight_hrv_rmssd is historical.
ALTER TABLE "daily_vitals_summary" ADD COLUMN IF NOT EXISTS "hrv_variant" text;
-- Which connector produced the row's sleep / HRV / resting HR, for the "from Apple Health" label.
ALTER TABLE "daily_vitals_summary" ADD COLUMN IF NOT EXISTS "sleep_source" text;
ALTER TABLE "daily_vitals_summary" ADD COLUMN IF NOT EXISTS "hrv_source" text;
ALTER TABLE "daily_vitals_summary" ADD COLUMN IF NOT EXISTS "rhr_source" text;
