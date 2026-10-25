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
