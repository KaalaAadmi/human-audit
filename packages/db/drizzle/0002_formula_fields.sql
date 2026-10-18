-- Migration 0002: formula fields
-- Adds sex + waist_cm to user_profiles.
-- Rewrites daily_vitals_summary to match the formula engine output
-- (removes the old NOT NULL bodyAge/readinessScore; adds readiness tier, TRIMP, sleep debt, efficiency, fitness age).

-- user_profiles: new columns
ALTER TABLE "user_profiles"
  ADD COLUMN "sex" text NOT NULL DEFAULT 'prefer_not_to_say',
  ADD COLUMN "waist_cm" numeric(5, 1);
--> statement-breakpoint

-- daily_vitals_summary: remove columns that changed semantics or constraints
ALTER TABLE "daily_vitals_summary"
  DROP COLUMN IF EXISTS "readiness_score",
  DROP COLUMN IF EXISTS "body_age";
--> statement-breakpoint

-- daily_vitals_summary: relax NOT NULL on columns that are now nullable (cold-start / no waist)
ALTER TABLE "daily_vitals_summary"
  ALTER COLUMN "day_strain"           DROP NOT NULL,
  ALTER COLUMN "sleep_score"          DROP NOT NULL,
  ALTER COLUMN "sleep_duration_seconds" DROP NOT NULL,
  ALTER COLUMN "deep_sleep_seconds"   DROP NOT NULL,
  ALTER COLUMN "rem_sleep_seconds"    DROP NOT NULL,
  ALTER COLUMN "light_sleep_seconds"  DROP NOT NULL,
  ALTER COLUMN "awake_seconds"        DROP NOT NULL;
--> statement-breakpoint

-- daily_vitals_summary: add new columns
ALTER TABLE "daily_vitals_summary"
  ADD COLUMN IF NOT EXISTS "readiness_tier"        text,
  ADD COLUMN IF NOT EXISTS "rhr_flag"              boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "trimp_raw"             numeric(7, 2),
  ADD COLUMN IF NOT EXISTS "sleep_need_seconds"    integer,
  ADD COLUMN IF NOT EXISTS "sleep_debt_seconds"    integer,
  ADD COLUMN IF NOT EXISTS "sleep_efficiency_pct"  integer,
  ADD COLUMN IF NOT EXISTS "sleep_efficiency_label" text,
  ADD COLUMN IF NOT EXISTS "time_in_bed_seconds"   integer,
  ADD COLUMN IF NOT EXISTS "vo2max_ml_kg_min"      numeric(5, 2),
  ADD COLUMN IF NOT EXISTS "fitness_age"           numeric(4, 2);
