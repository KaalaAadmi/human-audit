-- Migration 0006: user-configurable hydration reminder window (minutes from local midnight).
-- Defaults keep the previous hard-coded 8:00 AM - 10:00 PM window.
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "water_reminder_start_min" integer DEFAULT 480 NOT NULL;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "water_reminder_end_min" integer DEFAULT 1320 NOT NULL;
