-- Migration 0005: unique constraint on workout_logs(user_id, external_id)
-- Allows ON CONFLICT DO NOTHING on re-sync; NULL external_id rows (manual entries) are unaffected
-- because NULL != NULL in Postgres unique indexes.

CREATE UNIQUE INDEX IF NOT EXISTS "workout_logs_user_id_external_id_unique"
  ON "workout_logs" ("user_id", "external_id")
  WHERE "external_id" IS NOT NULL;
