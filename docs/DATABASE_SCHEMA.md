# HumanAudit — Database Schemas & Infrastructure Strategy

## 1. Cloud Schema (PostgreSQL with Strict User Data Isolation)

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. User Profiles & Health Baselines
-- user_id is the unique identifier issued by Auth (e.g. Clerk)
CREATE TABLE user_profiles (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  chronological_birthdate DATE NOT NULL,
  height_cm NUMERIC(5,2) NOT NULL,
  sync_start_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  water_goal_ml INTEGER NOT NULL DEFAULT 3000,
  water_reminder_interval_mins INTEGER NOT NULL DEFAULT 90,
  water_reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  water_reminder_start_min INTEGER NOT NULL DEFAULT 480,   -- minutes from local midnight (8:00 AM)
  water_reminder_end_min INTEGER NOT NULL DEFAULT 1320,    -- 10:00 PM
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Day-of-Week Custom Macro Goals (Mon-Sun)
CREATE TABLE daily_macro_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday, 1 = Monday, etc.
  target_calories INTEGER NOT NULL DEFAULT 2300,
  target_protein_g INTEGER NOT NULL DEFAULT 180,
  target_carbs_g INTEGER NOT NULL DEFAULT 220,
  target_fats_g INTEGER NOT NULL DEFAULT 65,
  UNIQUE(user_id, day_of_week)
);

-- 3. Custom Foods & Recipes
CREATE TABLE custom_foods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT,
  serving_size_g NUMERIC(7,2) NOT NULL,
  calories INTEGER NOT NULL,
  protein_g NUMERIC(7,2) NOT NULL,
  carbs_g NUMERIC(7,2) NOT NULL,
  fats_g NUMERIC(7,2) NOT NULL,
  barcode TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE custom_recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_servings INTEGER NOT NULL DEFAULT 1,
  total_calories INTEGER NOT NULL,
  total_protein_g NUMERIC(7,2) NOT NULL,
  total_carbs_g NUMERIC(7,2) NOT NULL,
  total_fats_g NUMERIC(7,2) NOT NULL,
  ingredients_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Daily Food Diary Logs (Strictly by Date)
CREATE TABLE food_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  food_name TEXT NOT NULL,
  serving_quantity NUMERIC(7,2) NOT NULL,
  serving_unit TEXT NOT NULL,
  calories INTEGER NOT NULL,
  protein_g NUMERIC(7,2) NOT NULL,
  carbs_g NUMERIC(7,2) NOT NULL,
  fats_g NUMERIC(7,2) NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('usda', 'off', 'custom_food', 'recipe', 'barcode', 'voice', 'photo_ai')),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Water Ingestion Logs
CREATE TABLE water_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  amount_ml INTEGER NOT NULL, -- the day's TOTAL (one row per user per day, set not appended)
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, log_date)
);

-- 6. Workouts & Calculated HR Zones (1-5)
CREATE TABLE workout_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  external_id TEXT,
  source TEXT NOT NULL CHECK (source IN ('fitbit', 'apple_health', 'google_health')),
  workout_type TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER NOT NULL,
  active_calories INTEGER NOT NULL,
  avg_heart_rate INTEGER,
  max_heart_rate INTEGER,
  zone1_seconds INTEGER NOT NULL DEFAULT 0,
  zone2_seconds INTEGER NOT NULL DEFAULT 0,
  zone3_seconds INTEGER NOT NULL DEFAULT 0,
  zone4_seconds INTEGER NOT NULL DEFAULT 0,
  zone5_seconds INTEGER NOT NULL DEFAULT 0,
  deduped_status TEXT NOT NULL DEFAULT 'active' CHECK (deduped_status IN ('active', 'ignored')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Daily Recovery, Sleep & Body Age History
CREATE TABLE daily_vitals_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL,
  readiness_score INTEGER NOT NULL,
  day_strain NUMERIC(4,2) NOT NULL,
  sleep_score INTEGER NOT NULL,
  sleep_duration_seconds INTEGER NOT NULL,
  deep_sleep_seconds INTEGER NOT NULL,
  rem_sleep_seconds INTEGER NOT NULL,
  light_sleep_seconds INTEGER NOT NULL,
  awake_seconds INTEGER NOT NULL,
  overnight_hrv_rmssd NUMERIC(5,2),
  resting_heart_rate INTEGER,
  body_age NUMERIC(4,2) NOT NULL,
  scale_weight_kg NUMERIC(5,2),
  weight_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, summary_date)
);

-- 8. Wearable Deduplication Priorities & Connectors
CREATE TABLE wearable_settings (
  user_id TEXT PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  priority_1 TEXT NOT NULL DEFAULT 'fitbit',
  priority_2 TEXT NOT NULL DEFAULT 'apple_health',
  priority_3 TEXT NOT NULL DEFAULT 'google_health',
  hume_scale_connected BOOLEAN NOT NULL DEFAULT FALSE,
  fittr_connected BOOLEAN NOT NULL DEFAULT FALSE,
  fitelo_connected BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User isolation is enforced by the Next.js API (verifies the Clerk token, filters by user_id).
-- RLS is enabled with NO policies, so the Supabase REST/anon keys cannot read or write anything;
-- the API connects with the privileged DATABASE_URL role, which bypasses RLS.
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_macro_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_vitals_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE wearable_settings ENABLE ROW LEVEL SECURITY;
```

### Shared foods and recipes (migration `0009_content_moderation.sql`)

`custom_foods` and `custom_recipes` are readable by every user (foods by name only, recipes with the author's `display_name`); only the owner can delete. Moderation:

| Column / table | Purpose |
|---|---|
| `custom_foods.hidden`, `custom_recipes.hidden` | Set by `POST /api/reports` once 3 distinct users reported the item. A hidden item stays visible to its author only. |
| `content_reports` | One row per (`user_id`, `kind` = `food`/`recipe`, `item_id`), with the `reason` the reporter picked. A reporter stops seeing the item immediately. When the reporter deletes their account `user_id` becomes null, so the report keeps counting toward the threshold. |

Review: `SELECT * FROM custom_foods WHERE hidden;`. Restore: `UPDATE ... SET hidden = false` and delete the item's `content_reports` rows. There is no admin UI.

### Data connectors (migration `0008_data_connectors.sql`)

Design: [`data-connectors.md`](./data-connectors.md). The full DDL is in `packages/db/drizzle/0008_data_connectors.sql`; this is the map.

| Table | Purpose |
|---|---|
| `devices` | One row per install. `id` is a client-generated uuid kept in the keychain; a uuid owned by another user is rejected (409) and the client mints a new one. |
| `connections` | One per (user, `source_id`). Enum `source_id`: `healthkit`, `health_connect`, `google_health`. Enum `connection_status`: connecting, connected, partial, stale, needs_reauth, collector_missing, error, not_connected. Device-bound sources have `collector_device_id`. |
| `sync_cursors` | Per (connection, metric): HealthKit anchor or Health Connect changes token. Device-local, so cleared when the collector moves. |
| `oauth_tokens` | Google Health refresh/access tokens, AES-256-GCM encrypted with `TOKEN_ENCRYPTION_KEY`. |
| `oauth_states` | Single-use OAuth `state` nonces. |
| `samples` | Raw, source-tagged data. `id` is a hash of (source, metric, origin_id). `deleted_at` is a tombstone, never a hard delete. |
| `metric_preferences` | Per (user, metric): ordered `connection_order uuid[]`. |
| `daily_summaries` | Resolved value per (user, date, metric) plus `payload jsonb`; winning source recorded. Recomputed by the `summaries_recompute` job. |
| `origin_map` | `origin_app` (e.g. the Google Health bundle id) -> the direct source it mirrors, so mirrored copies are skipped at summary time. |
| `jobs` | Postgres job queue (`gh_fetch`, `gh_poll`, `summaries_recompute`, `connections_stale_check`), drained by `POST /api/v1/jobs/run`. |

`daily_vitals_summary` gains `hrv_variant`, `sleep_source`, `hrv_source`, `rhr_source`. It and `workout_logs` stay as read models, rewritten from `daily_summaries`, so the existing screens keep working. `overnight_hrv_rmssd` now holds SDNN when the source is Apple Health; `hrv_variant` says which.

---

## 2. Zero-Downtime Migration Protocol (Supabase $\rightarrow$ Self-Hosted VM)

Because standard PostgreSQL and Drizzle ORM are used throughout, migrating the database from Supabase to a free Oracle Cloud VM or Hetzner VPS requires zero code refactoring:

1. **Step 1: Export Snapshot from Supabase**
   ```bash
   pg_dump --clean --if-exists --no-owner --no-privileges \
     -h db.[YOUR-PROJECT-REF].supabase.co \
     -U postgres -d postgres > humanaudit_snapshot.sql
   ```
2. **Step 2: Import Snapshot to Self-Hosted VM**
   ```bash
   psql -h [VM_IP] -U postgres -d humanaudit < humanaudit_snapshot.sql
   ```
3. **Step 3: Point Mobile / Backend Environment**
   ```bash
   # In .env / EAS Secrets:
   DATABASE_URL="postgresql://postgres:[PASSWORD]@[VM_IP]:5432/humanaudit"
   ```

---

## 3. Local SQLite Schema (Planned, not implemented)
The app currently has no local store; it talks to the Next.js API directly. If offline-first is added later, local tables would mirror remote tables with sync flags (`client_uuid`, `sync_status` = `'synced' | 'pending_insert' | 'pending_update' | 'pending_delete'`) and a composite index on `(user_id, log_date)`.

