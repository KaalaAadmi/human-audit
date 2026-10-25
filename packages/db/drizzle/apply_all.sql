-- Idempotent full schema apply — safe to run on a DB that already has some tables.
-- Equivalent to migrations 0000 through 0008 applied in order.

CREATE TABLE IF NOT EXISTS "daily_macro_goals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "day_of_week" integer NOT NULL,
  "target_calories" integer DEFAULT 2300 NOT NULL,
  "target_protein_g" integer DEFAULT 180 NOT NULL,
  "target_carbs_g" integer DEFAULT 220 NOT NULL,
  "target_fats_g" integer DEFAULT 65 NOT NULL,
  CONSTRAINT "daily_macro_goals_user_id_day_of_week_unique" UNIQUE("user_id","day_of_week")
);
ALTER TABLE "daily_macro_goals" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "user_profiles" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "display_name" text NOT NULL,
  "chronological_birthdate" date NOT NULL,
  "height_cm" numeric(5, 2) NOT NULL,
  "sync_start_timestamp" timestamp with time zone DEFAULT now() NOT NULL,
  "water_goal_ml" integer DEFAULT 3000 NOT NULL,
  "water_reminder_interval_mins" integer DEFAULT 90 NOT NULL,
  "water_reminder_enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_profiles_email_unique" UNIQUE("email")
);
ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;

-- 0003: weight_kg
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "weight_kg" numeric(5, 2);
-- 0002: sex + waist_cm
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "sex" text NOT NULL DEFAULT 'prefer_not_to_say';
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "waist_cm" numeric(5, 1);

CREATE TABLE IF NOT EXISTS "daily_vitals_summary" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "summary_date" date NOT NULL,
  "day_strain" numeric(4, 2),
  "sleep_score" integer,
  "sleep_duration_seconds" integer,
  "deep_sleep_seconds" integer,
  "rem_sleep_seconds" integer,
  "light_sleep_seconds" integer,
  "awake_seconds" integer,
  "overnight_hrv_rmssd" numeric(5, 2),
  "resting_heart_rate" integer,
  "scale_weight_kg" numeric(5, 2),
  "weight_source" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "daily_vitals_summary_user_id_summary_date_unique" UNIQUE("user_id","summary_date")
);
ALTER TABLE "daily_vitals_summary" ENABLE ROW LEVEL SECURITY;

-- 0002: formula fields (all IF NOT EXISTS — safe if columns already exist)
ALTER TABLE "daily_vitals_summary" DROP COLUMN IF EXISTS "readiness_score";
ALTER TABLE "daily_vitals_summary" DROP COLUMN IF EXISTS "body_age";
ALTER TABLE "daily_vitals_summary" ADD COLUMN IF NOT EXISTS "readiness_tier"        text;
ALTER TABLE "daily_vitals_summary" ADD COLUMN IF NOT EXISTS "rhr_flag"              boolean NOT NULL DEFAULT false;
ALTER TABLE "daily_vitals_summary" ADD COLUMN IF NOT EXISTS "trimp_raw"             numeric(7, 2);
ALTER TABLE "daily_vitals_summary" ADD COLUMN IF NOT EXISTS "sleep_need_seconds"    integer;
ALTER TABLE "daily_vitals_summary" ADD COLUMN IF NOT EXISTS "sleep_debt_seconds"    integer;
ALTER TABLE "daily_vitals_summary" ADD COLUMN IF NOT EXISTS "sleep_efficiency_pct"  integer;
ALTER TABLE "daily_vitals_summary" ADD COLUMN IF NOT EXISTS "sleep_efficiency_label" text;
ALTER TABLE "daily_vitals_summary" ADD COLUMN IF NOT EXISTS "time_in_bed_seconds"   integer;
ALTER TABLE "daily_vitals_summary" ADD COLUMN IF NOT EXISTS "vo2max_ml_kg_min"      numeric(5, 2);
ALTER TABLE "daily_vitals_summary" ADD COLUMN IF NOT EXISTS "fitness_age"           numeric(4, 2);

CREATE TABLE IF NOT EXISTS "food_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "log_date" date NOT NULL,
  "meal_type" text NOT NULL,
  "food_name" text NOT NULL,
  "serving_quantity" numeric(7, 2) NOT NULL,
  "serving_unit" text NOT NULL,
  "calories" integer NOT NULL,
  "protein_g" numeric(7, 2) NOT NULL,
  "carbs_g" numeric(7, 2) NOT NULL,
  "fats_g" numeric(7, 2) NOT NULL,
  "source" text NOT NULL,
  "logged_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "food_logs" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "water_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "log_date" date NOT NULL,
  "amount_ml" integer NOT NULL,
  "logged_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "water_logs_user_id_log_date_unique" UNIQUE("user_id","log_date")
);
ALTER TABLE "water_logs" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "wearable_settings" (
  "user_id" text PRIMARY KEY NOT NULL,
  "priority_1" text DEFAULT 'fitbit' NOT NULL,
  "priority_2" text DEFAULT 'apple_health' NOT NULL,
  "priority_3" text DEFAULT 'google_health' NOT NULL,
  "hume_scale_connected" boolean DEFAULT false NOT NULL,
  "fittr_connected" boolean DEFAULT false NOT NULL,
  "fitelo_connected" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "wearable_settings" ENABLE ROW LEVEL SECURITY;

-- 0004: health connector flags
ALTER TABLE "wearable_settings" ADD COLUMN IF NOT EXISTS "apple_health_connected" boolean DEFAULT false NOT NULL;
ALTER TABLE "wearable_settings" ADD COLUMN IF NOT EXISTS "health_connect_connected" boolean DEFAULT false NOT NULL;

CREATE TABLE IF NOT EXISTS "workout_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "external_id" text,
  "source" text NOT NULL,
  "workout_type" text NOT NULL,
  "start_time" timestamp with time zone NOT NULL,
  "end_time" timestamp with time zone NOT NULL,
  "duration_seconds" integer NOT NULL,
  "active_calories" integer NOT NULL,
  "avg_heart_rate" integer,
  "max_heart_rate" integer,
  "zone1_seconds" integer DEFAULT 0 NOT NULL,
  "zone2_seconds" integer DEFAULT 0 NOT NULL,
  "zone3_seconds" integer DEFAULT 0 NOT NULL,
  "zone4_seconds" integer DEFAULT 0 NOT NULL,
  "zone5_seconds" integer DEFAULT 0 NOT NULL,
  "deduped_status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "workout_logs" ENABLE ROW LEVEL SECURITY;

-- 0001: custom foods & recipes
CREATE TABLE IF NOT EXISTS "custom_foods" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "brand" text,
  "serving_size_g" numeric(7, 2) NOT NULL,
  "calories" integer NOT NULL,
  "protein_g" numeric(7, 2) NOT NULL,
  "carbs_g" numeric(7, 2) NOT NULL,
  "fats_g" numeric(7, 2) NOT NULL,
  "barcode" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "custom_foods" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "custom_recipes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "total_servings" integer DEFAULT 1 NOT NULL,
  "total_calories" integer NOT NULL,
  "total_protein_g" numeric(7, 2) NOT NULL,
  "total_carbs_g" numeric(7, 2) NOT NULL,
  "total_fats_g" numeric(7, 2) NOT NULL,
  "ingredients_json" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "custom_recipes" ENABLE ROW LEVEL SECURITY;

-- Foreign keys (IF NOT EXISTS not supported for constraints; use DO $$ to guard)
DO $$ BEGIN
  ALTER TABLE "daily_macro_goals" ADD CONSTRAINT "daily_macro_goals_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "daily_vitals_summary" ADD CONSTRAINT "daily_vitals_summary_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "food_logs" ADD CONSTRAINT "food_logs_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "water_logs" ADD CONSTRAINT "water_logs_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "wearable_settings" ADD CONSTRAINT "wearable_settings_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "custom_foods" ADD CONSTRAINT "custom_foods_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "custom_recipes" ADD CONSTRAINT "custom_recipes_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 0005: workout dedup index
CREATE UNIQUE INDEX IF NOT EXISTS "workout_logs_user_id_external_id_unique"
  ON "workout_logs" ("user_id", "external_id")
  WHERE "external_id" IS NOT NULL;

-- 0006: configurable water reminder window
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "water_reminder_start_min" integer DEFAULT 480 NOT NULL;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "water_reminder_end_min" integer DEFAULT 1320 NOT NULL;

-- Migration 0007: the live daily_vitals_summary still had NOT NULL on these columns (older schema).
-- schemas.ts treats them as nullable: a day can have HRV/RHR but no sleep, or vice versa.
ALTER TABLE "daily_vitals_summary" ALTER COLUMN "day_strain" DROP NOT NULL;
ALTER TABLE "daily_vitals_summary" ALTER COLUMN "sleep_score" DROP NOT NULL;
ALTER TABLE "daily_vitals_summary" ALTER COLUMN "sleep_duration_seconds" DROP NOT NULL;
ALTER TABLE "daily_vitals_summary" ALTER COLUMN "deep_sleep_seconds" DROP NOT NULL;
ALTER TABLE "daily_vitals_summary" ALTER COLUMN "rem_sleep_seconds" DROP NOT NULL;
ALTER TABLE "daily_vitals_summary" ALTER COLUMN "light_sleep_seconds" DROP NOT NULL;
ALTER TABLE "daily_vitals_summary" ALTER COLUMN "awake_seconds" DROP NOT NULL;

-- 0008: data connectors

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

CREATE TABLE IF NOT EXISTS "oauth_states" (
  "nonce" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user_profiles"("id") ON DELETE CASCADE,
  "device_id" uuid,
  "expires_at" timestamptz NOT NULL
);
ALTER TABLE "oauth_states" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "daily_vitals_summary" ADD COLUMN IF NOT EXISTS "hrv_variant" text;
ALTER TABLE "daily_vitals_summary" ADD COLUMN IF NOT EXISTS "sleep_source" text;
ALTER TABLE "daily_vitals_summary" ADD COLUMN IF NOT EXISTS "hrv_source" text;
ALTER TABLE "daily_vitals_summary" ADD COLUMN IF NOT EXISTS "rhr_source" text;
-- Migration 0009: moderation of shared custom foods / recipes. Idempotent. RLS on, no policies (server-only access).
-- An item is hidden from everyone but its author once REPORT_HIDE_THRESHOLD (3, apps/web/app/api/reports) distinct users report it.
-- Review: SELECT * FROM custom_foods WHERE hidden;  Restore: UPDATE ... SET hidden = false (and DELETE its content_reports rows).

ALTER TABLE "custom_foods" ADD COLUMN IF NOT EXISTS "hidden" boolean DEFAULT false NOT NULL;
ALTER TABLE "custom_recipes" ADD COLUMN IF NOT EXISTS "hidden" boolean DEFAULT false NOT NULL;

CREATE TABLE IF NOT EXISTS "content_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text REFERENCES "user_profiles"("id") ON DELETE SET NULL, -- null = reporter deleted their account; the report still counts
  "kind" text NOT NULL CHECK ("kind" IN ('food', 'recipe')),
  "item_id" uuid NOT NULL,
  "reason" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  UNIQUE ("user_id", "kind", "item_id")
);
CREATE INDEX IF NOT EXISTS "content_reports_item" ON "content_reports" ("kind", "item_id");
ALTER TABLE "content_reports" ENABLE ROW LEVEL SECURITY;

-- Same fix for databases that already ran the first version of this file (cascade, NOT NULL).
ALTER TABLE "content_reports" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "content_reports" DROP CONSTRAINT IF EXISTS "content_reports_user_id_fkey";
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE SET NULL;
