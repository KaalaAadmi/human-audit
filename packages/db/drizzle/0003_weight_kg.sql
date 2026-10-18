-- Migration 0003: add weight_kg to user_profiles
-- Nullable so existing rows are unaffected. Used for Mifflin-St Jeor step-burn estimate.

ALTER TABLE "user_profiles"
  ADD COLUMN "weight_kg" numeric(5, 2);
