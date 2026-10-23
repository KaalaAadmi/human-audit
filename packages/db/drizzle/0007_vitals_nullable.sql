-- Migration 0007: the live daily_vitals_summary still had NOT NULL on these columns (older schema).
-- schemas.ts treats them as nullable: a day can have HRV/RHR but no sleep, or vice versa.
ALTER TABLE "daily_vitals_summary" ALTER COLUMN "day_strain" DROP NOT NULL;
ALTER TABLE "daily_vitals_summary" ALTER COLUMN "sleep_score" DROP NOT NULL;
ALTER TABLE "daily_vitals_summary" ALTER COLUMN "sleep_duration_seconds" DROP NOT NULL;
ALTER TABLE "daily_vitals_summary" ALTER COLUMN "deep_sleep_seconds" DROP NOT NULL;
ALTER TABLE "daily_vitals_summary" ALTER COLUMN "rem_sleep_seconds" DROP NOT NULL;
ALTER TABLE "daily_vitals_summary" ALTER COLUMN "light_sleep_seconds" DROP NOT NULL;
ALTER TABLE "daily_vitals_summary" ALTER COLUMN "awake_seconds" DROP NOT NULL;
