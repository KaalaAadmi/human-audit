# HumanAudit — Health Data Sources: PRD & Architecture

Oct 23, 2026 · @Arnav

## 1. Overview

HumanAudit lets each user connect the health data sources they trust (Apple Health, Health Connect, Google Health) and pick a primary source per metric; the app never decides the source for them.

### Problem

- Health data is split across platform stores: Apple Health lives only on the iPhone, Health Connect only on the Android phone, Google Health (Fitbit/Pixel) in Google's cloud.
- Routing everything through one store loses fidelity and choice. Example: Fitbit Air data reaching the app via Google Health → Apple Health → HumanAudit instead of directly from Google Health.
- Some users own devices across ecosystems (Android daily phone, iPhone paired to an Apple Watch).

### Goals

- G1: A user can connect any source available to them, on any of their devices, under one HumanAudit account.
- G2: A user picks a primary source per metric (sleep, HRV, resting HR, steps, workouts…), with fallback to other connected sources.
- G3: Google Health is a first-class source on both iOS and Android (direct API, not via a platform store).
- G4: Apple Health data can reach a user's Android app via HumanAudit running on their iPhone (collector device).
- G5: No double counting when the same data arrives through two paths.
- G6: Every connection shows a clear status: connected, syncing, stale, needs re-auth, disconnected.

### Non-goals (v1)

- Apple Health export-file import (deferred, see section 15).
- Direct cloud connections to Garmin, Oura, Ultrahuman, Whoop and Polar (their data still arrives via Apple Health / Health Connect; direct adapters are planned for the next version, section 15).
- Writing data back to sources, except the existing hydration write to Apple Health (nutrition and hydration write-back is planned for the next version, section 15).
- Public launch beyond 100 Google Health users (needs Google verification + annual CASA).

### Principles

- User choice over developer defaults; defaults only fill gaps.
- Backend is the source of truth for normalized data; devices are collectors.
- Store raw samples with provenance (source, device, origin app, timezone); derive summaries on the backend.
- Degrade gracefully: partial permissions, partial scopes and stale collectors keep the app working.

## 2. Scenarios

Six user setups are in scope for v1; each maps to one or more source connections, and all can coexist on one account.

| # | User setup | Source(s) offered | Collector | Package / API |
| --- | --- | --- | --- | --- |
| A | iPhone + Apple Watch (or any app writing to Apple Health) | Apple Health | HumanAudit on the iPhone | `@kingstinct/react-native-healthkit` |
| B | iPhone + Fitbit/Pixel device (e.g. Fitbit Air) | Google Health (direct), or Apple Health via Google Health's sync | Backend (Google Health); iPhone (Apple Health) | Google Health API v4 + `expo-web-browser`; HealthKit package |
| C | Android + Fitbit/Pixel device | Health Connect, or Google Health (direct) | Android phone (HC); backend (GH) | `react-native-health-connect`; Google Health API v4 |
| D | Android + Samsung/Garmin/other wearable writing to Health Connect | Health Connect | HumanAudit on the Android phone | `react-native-health-connect` |
| E | Android daily phone + iPhone paired to an Apple Watch | Apple Health (collected on the iPhone) | HumanAudit on the iPhone, same account | HealthKit package + connection `collectorDeviceId` |
| F | Several sources on one account | Any combination of the above | Mixed | Per-metric primary source logic on the backend |

### Scenario notes

- **A — Apple Health on iPhone.** Default for most iPhone users. HealthKit is on-device only; the app reads and uploads.
- **B — Google Health on iPhone (the author's setup).** Connect Google Health directly; set it as primary for sleep, HRV and resting HR. If Google Health's Apple Health sync is also on, HealthKit samples written by the Google Health app are filtered out to avoid duplicates (section 10).
- **C — Fitbit/Pixel on Android.** Two valid paths. Health Connect needs no OAuth and is free, but only covers what the Google Health app writes there, and only 30 days of history without the history permission. Google Health gives the reconciled cloud stream and full history.
- **D — Other Android wearables.** Samsung Health, Garmin Connect, etc. write to Health Connect; HumanAudit reads it.
- **E — Android + Apple Watch.** An Apple Watch cannot pair with an Android phone; it needs an iPhone for setup and use. Realistic case: the user keeps an iPhone with the watch. HumanAudit on that iPhone collects Apple Health; the Android app reads from the backend. The Android Data sources screen shows the iPhone as the collector, or an "install on your iPhone" prompt.
- **F — Mixed.** Example: sleep + HRV from Google Health, workouts from Apple Health. The user picks a primary source per metric; others are fallbacks.

### Deferred

- **G — No regular access to the iPhone holding Apple Health.** One-off import of the Apple Health export file. Out of scope for v1.

## 3. Data sources and connection model

A connection belongs to the user's account, not to a device; device-bound sources also name the collector device that uploads their data.

### Sources

| Source id | Kind | Platforms that can collect | Auth | Sync trigger |
| --- | --- | --- | --- | --- |
| `healthkit` | On-device store | iOS | HealthKit permission sheet | Observer query + background delivery; foreground pull |
| `health_connect` | On-device store | Android | Health Connect permission screen | Changes token; periodic background task; foreground pull |
| `google_health` | Cloud API | Backend (connect flow from iOS or Android) | Google OAuth 2.0 (authorization code, server-side exchange) | Webhooks (every v1 type except active energy) + on-open and scheduled polling |

### Concepts

- **Source:** where data originates for HumanAudit (`healthkit`, `health_connect`, `google_health`).
- **Connection:** one source linked to one user account. Has a status, granted permissions/scopes, a collector (device-bound sources only) and sync cursors.
- **Collector device:** the phone that runs the adapter for a device-bound source and uploads samples. One active collector per device-bound connection.
- **Origin:** the app or device that originally wrote a sample inside a store (e.g. HealthKit sample written by the Google Health app; Health Connect record with `dataOrigin` = a package name). Used for dedup.
- **Metric:** a normalized measurement HumanAudit understands (catalogue in section 5).
- **Primary source per metric:** the user's choice for which connection feeds a metric; other connections that support it are ordered fallbacks.

### Connection states

- `not_connected` — never linked, or disconnected by the user.
- `connecting` — permission sheet / OAuth in progress.
- `connected` — healthy, synced within the freshness window.
- `partial` — some permissions/scopes withheld; works for the granted metrics.
- `stale` — no successful sync for longer than the freshness window (default 24 h).
- `needs_reauth` — token revoked/expired, or permissions withdrawn.
- `collector_missing` — device-bound source with no active collector (app deleted / signed out on that device).
- `error` — last sync failed with a non-auth error; retried with backoff.

### Rules

- A user may have at most one connection per source per account in v1.
- Device-bound connections are created from the collector device only (Apple Health from an iPhone, Health Connect from an Android phone).
- Any device can view all connections and set primaries; only the collector can change device permissions.
- Disconnecting stops new syncs; the user chooses whether to keep or delete that source's stored samples.

## 4. System architecture

Each phone reads its own store and uploads to the backend; Google Health is pulled by the backend after the user consents in the system browser; only the backend decides which source feeds each metric.

&#91;embedded content: HumanAudit health data flow · 3 sources, 2 collectors, 1 backend\]

The Google Health connect flow starts in the app (system browser) and ends at the backend's OAuth callback; after that, the phone is not involved in Google Health syncs.

### Responsibilities

- **Phones (collectors):** permissions, reading device stores, normalizing, uploading, saving cursors after successful uploads.
- **Backend:** identity (Clerk), connections, OAuth tokens, Google Health fetches, dedup, per-metric source resolution, summaries.
- **Any device (viewer):** shows connections and summaries for the whole account, regardless of which phone collected the data.

## 5. Data model

Everything lives in Supabase Postgres: devices, connections, sync cursors, OAuth tokens, raw samples, per-metric preferences, daily summaries and an origin map. The mobile app never talks to Supabase; only Next.js does, with the service-role key. `user_id` is the Clerk user id that Next.js reads from the verified session token, and every query filters on it.

### Entities

```sql
-- Supabase migration. user_id = Clerk user id from the session token's sub claim.
create type source_id as enum ('healthkit', 'health_connect', 'google_health');
create type connection_status as enum (
  'connecting', 'connected', 'partial', 'stale',
  'needs_reauth', 'collector_missing', 'error', 'not_connected');

create table devices (
  id uuid primary key,                         -- generated on first launch, kept in expo-secure-store
  user_id text not null,                       -- Clerk user id, set by Next.js
  platform text not null check (platform in ('ios', 'android')),
  name text not null,                          -- "Arnav's iPhone"
  app_version text,
  push_token text,
  last_seen_at timestamptz not null default now()
);

create table connections (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default (auth.jwt()->>'sub'),
  source source_id not null,
  status connection_status not null default 'connecting',
  collector_device_id uuid references devices(id),
  granted_metrics text[] not null default '{}',
  granted_scopes text[],                       -- google_health only
  external_user_id text,                       -- google_health: healthUserId from users/me/identity
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_sync_error jsonb,
  backfill_completed_at timestamptz,
  unique (user_id, source),
  check (source = 'google_health' or collector_device_id is not null)
);

create table sync_cursors (                    -- HK anchor | HC changes token | GH last synced time
  connection_id uuid references connections(id) on delete cascade,
  metric text not null,
  cursor text not null,
  updated_at timestamptz not null default now(),
  primary key (connection_id, metric)
);

create table oauth_tokens (                    -- server-only: RLS on, no client policies
  connection_id uuid primary key references connections(id) on delete cascade,
  refresh_token_enc bytea not null,            -- AES-256-GCM, key from server env
  access_token_enc bytea,
  access_token_expires_at timestamptz,
  scopes text[] not null
);

create table samples (
  id text primary key,                         -- hash(source, metric, origin_id): idempotent upserts
  user_id text not null,
  connection_id uuid not null references connections(id) on delete cascade,
  source source_id not null,
  metric text not null,
  variant text,                                -- 'sdnn' | 'rmssd' for HRV
  value double precision,
  unit text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  tz_offset_minutes smallint not null,
  origin_app text,                             -- HK bundle id | HC dataOrigin | GH dataSource
  origin_device text,                          -- 'Fitbit Air', 'Apple Watch'
  origin_id text not null,                     -- HK uuid | HC metadata.id | GH data point name
  payload jsonb,                               -- sleep stages, workout details
  deleted_at timestamptz,
  ingested_at timestamptz not null default now()
);
create index samples_user_metric_start on samples (user_id, metric, start_at);
create index samples_connection_start on samples (connection_id, start_at);

create table metric_preferences (
  user_id text not null default (auth.jwt()->>'sub'),
  metric text not null,
  connection_order uuid[] not null,            -- [1] = primary, rest = fallbacks
  updated_at timestamptz not null default now(),
  primary key (user_id, metric)
);

create table daily_summaries (
  user_id text not null,
  local_date date not null,
  metric text not null,
  value double precision,                      -- null = no data, not zero
  unit text not null,
  connection_id uuid references connections(id) on delete set null,
  variant text,
  primary key (user_id, local_date, metric)
);

create table origin_map (                      -- known mirror origins for cross-path dedup
  origin_app text primary key,                 -- 'com.fitbit.FitbitMobile'
  label text not null,                         -- 'Google Health app'
  mirrors_source source_id                     -- the direct source this origin duplicates
);

-- RLS on, no policies: only the service role (Next.js) can read or write.
alter table devices enable row level security;
alter table connections enable row level security;
alter table sync_cursors enable row level security;
alter table oauth_tokens enable row level security;
alter table samples enable row level security;
alter table metric_preferences enable row level security;
alter table daily_summaries enable row level security;
alter table origin_map enable row level security;
```

### Metric catalogue (v1)

| Metric | Canonical unit | Apple Health type | Health Connect record | Google Health data type |
| --- | --- | --- | --- | --- |
| `sleep` | session + stages, minutes | `HKCategoryTypeIdentifierSleepAnalysis` | `SleepSession` | `sleep` |
| `hrv` | ms (variant `sdnn` / `rmssd`) | `HKQuantityTypeIdentifierHeartRateVariabilitySDNN` (SDNN) | `HeartRateVariabilityRmssd` (RMSSD) | `daily-heart-rate-variability` (RMSSD); `heart-rate-variability` for samples |
| `resting_hr` | bpm | `HKQuantityTypeIdentifierRestingHeartRate` | `RestingHeartRate` | `daily-resting-heart-rate` |
| `heart_rate` | bpm | `HKQuantityTypeIdentifierHeartRate` | `HeartRate` | `heart-rate` |
| `steps` | count | `HKQuantityTypeIdentifierStepCount` | `Steps` | `steps` |
| `active_energy` | kcal | `HKQuantityTypeIdentifierActiveEnergyBurned` | `ActiveCaloriesBurned` | `active-energy-burned` |
| `workouts` | session | `HKWorkout` | `ExerciseSession` | `exercise` |
| `weight` | kg | `HKQuantityTypeIdentifierBodyMass` | `Weight` | `weight` |

Google Health scopes and endpoints for each data type are in section 8. Google Health HRV is RMSSD in milliseconds, so it shares a baseline with Health Connect, not with Apple Health.

### Keys, RLS and seed data

- Unique keys and indexes are in the SQL above; add `daily_summaries (user_id, metric, local_date)` if dashboards query by metric first.
- The `default (auth.jwt()->>'sub')` column defaults are not needed, because Next.js always sets `user_id` explicitly; drop them from the migration.
- Enable RLS on every table and add no policies. With RLS on and no policies, the anon and authenticated roles can read nothing, so a leaked anon key exposes no health data; the service-role key used by Next.js bypasses RLS.
- Because the service role bypasses RLS, all data access goes through one server-side data-access module whose functions take `userId` as a required argument (section 14).
- Seed `origin_map` with `com.fitbit.FitbitMobile` (Google Health app, same id on iOS and Android) and HumanAudit's own `com.kaalaaadmi.humanaudit`.

## 6. Apple Health (HealthKit) adapter

Runs on the iPhone with `@kingstinct/react-native-healthkit` (already ^16.2.0 with `react-native-nitro-modules` ^0.37.1): anchored queries upload changes, background delivery wakes the app when new data lands.

### Setup

- Config plugin with background enabled (current `app.json` lists the plugin without options):

```json
["@kingstinct/react-native-healthkit", {
  "NSHealthShareUsageDescription": "HumanAudit reads sleep, HRV, heart rate, steps and workouts to build your daily audit.",
  "NSHealthUpdateUsageDescription": "HumanAudit writes hydration logs to Apple Health.",
  "background": true
}]
```

- Let the plugin own the HealthKit entitlement and usage strings; remove the duplicated `ios.entitlements` HealthKit keys and `NSHealth*` entries from `ios.infoPlist` once the plugin build is verified.
- Requires a dev build (not Expo Go) and a physical iPhone for real data.

### Permissions

- Call `requestAuthorization({ toRead: [...], toShare: [...] })` before ANY query or subscription. The library warns that querying a type you have not requested authorization for crashes the app.
- Request only the types for the metrics the user enables; request more later when they enable another metric.
- HealthKit never reveals read denial: denied types return empty results. Treat empty as "no data yet", never as an error. `getRequestStatusForAuthorization` only tells you whether the sheet still needs showing.

### Sync algorithm (foreground and background)

1. For each enabled metric, load its anchor (backend `sync_cursors`, cached locally).
2. Run the anchored query for the type with a page `limit` (e.g. 500): `queryQuantitySamplesWithAnchor` (HRV, resting HR, heart rate, steps, energy, weight), `queryCategorySamplesWithAnchor` (sleep analysis), `queryWorkoutSamplesWithAnchor` (workouts). All three are exported by v16.2.0.
3. Normalize samples to `samples` rows (section 5): canonical unit, UTC start/end, tz offset, `origin_app` = the sample's `sourceRevision.source.bundleIdentifier`, `origin_device` from device metadata, `origin_id` = HealthKit UUID.
4. Upload `samples` + `deletedSamples` (as tombstones) to `POST /api/v1/ingest`.
5. Only after a 2xx, save `newAnchor`. Loop while a page came back full.
6. Update `connections.last_sync_at`.

v16 changed anchor handling: an anchor that fails to decode now throws instead of silently re-running the whole query. Catch that error, clear the stored anchor deliberately, and run a fresh 30-day backfill.

First connect = backfill: run the same loop with no anchor, bounded to the last 30 days with a date filter (v1 backfill depth for every source).

### Background

- Call `enableBackgroundDelivery(type, frequency)` per enabled type (immediate for sleep/HRV/resting HR; hourly is enough for steps).
- Register `subscribeToChanges(type, callback)` at app start, at module scope (not inside a component), so a background wake runs the sync loop for that type.
- Keep background work minimal: anchored query → upload → save anchor. iOS gives only a short execution window.
- Data protection: HealthKit is unreadable while the phone is locked. v16 exports `isProtectedDataAvailable` (sync) and `isProtectedDataAvailableAsync`; check first and skip the run when it returns false. The next unlocked wake catches up.

### Origin filtering (dedup)

- Every sample carries `sourceRevision.source.bundleIdentifier` (a plain object, not a proxy). Upload it as `origin_app` and let the backend exclude mirrored origins at summary time; raw data stays complete.
- To query only one app's samples on device, get its source from `querySources(type)` and match by `bundleIdentifier`, as the library's README recommends.
- **Google Health app's iOS bundle id: `com.fitbit.FitbitMobile`** (App Store lookup for app id 462638897, "Google Health (Fitbit)"), the same as its Android package. For apps, HealthKit's `bundleIdentifier` is the app's bundle id. Verify once on your iPhone with the steps below.
- HumanAudit's own source: `currentAppSource()` returns it (bundle id `com.kaalaaadmi.humanaudit`); always exclude it on read so hydration writes never come back as imported data.

### Verifying source ids on your iPhone

A one-time developer check, not part of the product flow. Google Health's Apple Health sharing is needed only while you run it; turn it off afterwards if you use Google Health direct.

1. In Google Health (v5.05 or later), turn on sharing to Apple Health and allow Sleep, Steps, Heart Rate and HRV.
2. Check iPhone Settings → Health → Data Access & Devices → Google Health: those categories should be on under "Allow to write".
3. Open Google Health and pull down to sync, so recent data reaches Apple Health.
4. Add a temporary debug button in a HumanAudit dev build:

```tsx
import { requestAuthorization, querySources } from '@kingstinct/react-native-healthkit';

async function logSources() {
  await requestAuthorization({ toRead: ['HKCategoryTypeIdentifierSleepAnalysis'] });
  const sources = await querySources('HKCategoryTypeIdentifierSleepAnalysis');
  console.log(sources.map((s) => ({ name: s.name, bundleIdentifier: s.bundleIdentifier })));
}
```

5. Run it on the iPhone (`npx expo run:ios --device`), tap the button, and read the Metro log. Expect an entry like `{ name: "Google Health", bundleIdentifier: "com.fitbit.FitbitMobile" }`.
6. If the id differs (for example a watch or extension id), add that value to `origin_map` as well, then remove the debug button.

### Metric notes

- HRV is SDNN in Apple Health → `variant: "sdnn"`.
- Sleep analysis values (in bed, asleep core/deep/REM, awake) map to the sleep stage set; overlapping sessions from multiple origins are common.
- Use statistics queries for daily step totals in UI previews, but upload raw samples for the backend.

## 7. Health Connect adapter

Runs on the Android phone with `react-native-health-connect` (already ^4.1.3, Expo plugin built in since v4): an initial windowed read, then incremental `getChanges`, with a periodic background task.

### Setup

- Keep `"react-native-health-connect"` in `plugins` (no separate `expo-health-connect`; if it ever gets installed, the Android build fails with a duplicate class).
- Add `expo-build-properties` with Android `compileSdkVersion` 36, `targetSdkVersion` 36, `minSdkVersion` 26.
- Declare health permissions in `android.permissions`, one per record type plus the background-read permission. No history permission in v1: the 30-day backfill fits inside Health Connect's default window.

```json
"permissions": [
  "android.permission.health.READ_SLEEP",
  "android.permission.health.READ_HEART_RATE_VARIABILITY",
  "android.permission.health.READ_RESTING_HEART_RATE",
  "android.permission.health.READ_HEART_RATE",
  "android.permission.health.READ_STEPS",
  "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
  "android.permission.health.READ_EXERCISE",
  "android.permission.health.READ_WEIGHT",
  "android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND"
]
```

- Provide a privacy policy screen/URL; Health Connect shows it from the permissions rationale entry point the plugin wires up.
- Play Store release: declare Health Connect data access in the Play Console. Approval can take up to 7 days, then 5–7 business days for the allowlist to propagate.

### Connect flow

1. `getSdkStatus()` → if Health Connect is unavailable or needs an update, deep-link the user to install/update it (`openHealthConnectSettings` for management).
2. `initialize()`.
3. `requestPermission([...])` with `{ accessType: "read", recordType: "SleepSession" }` etc. for enabled metrics, plus `{ accessType: "read", recordType: "BackgroundAccessPermission" }`.
4. `getGrantedPermissions()` → store `granted_metrics`; status `partial` if some were withheld. `BackgroundAccessPermission` is reported back when granted.
5. Register the connection with this device as collector (`POST /api/v1/connections`).

If a later version wants more than 30 days: the history permission is `{ accessType: "read", recordType: "ReadHealthDataHistory" }` plus `READ_HEALTH_DATA_HISTORY` in the manifest. Known library bug (issue #276): the request works, but `getGrantedPermissions()` and `requestPermission()` never report it back, so detect it by attempting a read older than 30 days and catching the error.

### Sync algorithm

1. **Backfill:** `readRecords(type, { timeRangeFilter })` per metric for the last 30 days, paging with the page token. Health Connect allows reads up to 30 days before the first permission grant without the history permission.
2. Normalize to `samples` rows: `origin_app` = `metadata.dataOrigin`, `origin_id` = `metadata.id`, device from `metadata.device`.
3. Upload to `POST /api/v1/ingest`; on 2xx get a changes token for the types and save it as the cursor.
4. **Incremental:** `getChanges({ changesToken })` → upserts + deletions → upload → save `nextChangesToken`; loop while `hasMore`.
5. If the token has expired (Health Connect expires unused change tokens), fall back to a windowed re-read from `last_sync_at` minus a margin, then take a fresh token.

### Background

- `expo-background-task` (with `expo-task-manager`) schedules one WorkManager worker on Android; set `minimumInterval` to 240 minutes (minimum allowed is 15; default is 12 h). The OS still decides when it runs: it needs enough battery and network.
- Define the task with `TaskManager.defineTask` at module scope, register it with `BackgroundTask.registerTaskAsync`, return `BackgroundTaskResult.Success` / `Failed`.
- Background reads only work if `READ_HEALTH_DATA_IN_BACKGROUND` is declared AND granted; check `getGrantedPermissions()` first and fall back to foreground sync on app open.
- Test with `BackgroundTask.triggerTaskWorkerForTestingAsync()` (debug builds only) or `adb shell cmd jobscheduler run -f com.kaalaaadmi.humanaudit <JOB_ID>`.
- Also sync on app foreground and on pull-to-refresh. Some vendors kill background work when the app is swiped away (see dontkillmyapp.com).

### Origin filtering (dedup)

- Fitbit data written by the Google Health app carries `dataOrigin` = `com.fitbit.FitbitMobile` (the Google Health app kept the Fitbit app's package name after the May 2026 rename). When `google_health` is primary for a metric, the backend excludes that origin for the same metric.
- `readRecords` also accepts a `dataOriginFilter` if you ever need on-device filtering.
- HumanAudit's own writes carry `com.kaalaaadmi.humanaudit`; always exclude them on read.

### Metric notes

- HRV is `HeartRateVariabilityRmssd` → `variant: "rmssd"`.
- Reinstalling the app revokes every permission, history included, and restarts the 30-day window: on reinstall, the connection goes to `needs_reauth` and re-runs connect.
- The user must enable Health Connect sync inside the Google Health app (or Samsung Health, etc.) for wearable data to appear.

## 8. Google Health API adapter

Runs entirely on the backend: the app only opens Google's consent page in the system browser; the backend exchanges the code, holds the tokens, receives webhooks and pulls data from `health.googleapis.com/v4`.

### Google Cloud setup

- Two projects: `humanaudit-dev` and `humanaudit-prod`. There is no sandbox; every environment calls the production API, so isolation is per project.
- Enable **Google Health API** in each project.
- OAuth client type **Web Server** (as Google's setup guide specifies). Authorized redirect URI = `https://<next-host>/api/v1/oauth/google-health/callback`.
- Consent screen: user type External; add every tester's email under Test users (unverified clients are capped at 100 users).
- Publishing status: move to **In production** before relying on it day to day. Testing mode issues refresh tokens that expire after 7 days; production tokens generally last unless revoked or unused for about six months. The 100-user cap still applies until verification.
- Add only the three read scopes below on the Data Access page.

### Data types, scopes and filters (v1)

| Metric | Data type (URL, kebab case) | Filter field (snake case) | Record type | Scope | Webhook |
| --- | --- | --- | --- | --- | --- |
| sleep | `sleep` | `sleep.interval.civil_end_time` | Session, max 25 per page | `.sleep.readonly` | Yes |
| hrv | `daily-heart-rate-variability` | `daily_heart_rate_variability.date` | Daily (RMSSD ms) | `.health_metrics_and_measurements.readonly` | Yes |
| hrv (intraday, optional) | `heart-rate-variability` | `heart_rate_variability.sample_time.physical_time` | Sample | `.health_metrics_and_measurements.readonly` | Yes |
| resting\_hr | `daily-resting-heart-rate` | `daily_resting_heart_rate.date` | Daily | `.health_metrics_and_measurements.readonly` | Yes |
| heart\_rate | `heart-rate` | `heart_rate.sample_time.physical_time` | Sample, 1 s resolution | `.health_metrics_and_measurements.readonly` | Yes |
| steps | `steps` | `steps.interval.civil_start_time` | Interval, 1 min | `.activity_and_fitness.readonly` | Yes |
| active\_energy | `active-energy-burned` | `active_energy_burned.interval.start_time` | Interval, 1 min | `.activity_and_fitness.readonly` | No, poll |
| workouts | `exercise` | `exercise.interval.civil_start_time` | Session, max 25 per page | `.activity_and_fitness.readonly` | Yes |
| weight | `weight` | `weight.sample_time.physical_time` | Sample | `.health_metrics_and_measurements.readonly` | Yes |

Scope prefix: `https://www.googleapis.com/auth/googlehealth`. v1 requests exactly three: `.sleep.readonly`, `.health_metrics_and_measurements.readonly`, `.activity_and_fitness.readonly`.

Users can deselect scopes on the consent screen. Map the granted `scope` list from the token response to `grantedMetrics`; never crash or show a blank screen on partial consent.

### Connect flow

1. **Pre-connect screen (app):** explain the benefit of each scope, and that the user must first sign in to the Google Health mobile app with the same Google account (Google's consent screen cannot check this).
2. **App → backend:** `POST /api/v1/connections/google-health/start` → Next.js creates a signed, single-use `state` (userId, deviceId, nonce, expiry \~10 min) and returns the auth URL: `https://accounts.google.com/o/oauth2/v2/auth?client_id=…&redirect_uri=…&response_type=code&access_type=offline&prompt=consent&scope=…&state=…`.
3. **App:** `WebBrowser.openAuthSessionAsync(authUrl, "humanaudit://oauth/google-health")` from `expo-web-browser` (ASWebAuthenticationSession / Custom Tabs; never a WebView).
4. **Google → Next.js callback** (`GET /api/v1/oauth/google-health/callback`): validate `state`; exchange `code` at `https://oauth2.googleapis.com/token` with the client secret; encrypt and store tokens in `oauth_tokens`; record granted scopes.
5. **Link check:** `GET https://health.googleapis.com/v4/users/me/identity` → `{ legacyUserId, healthUserId }`; store `healthUserId` as `external_user_id`. An unlinked account returns `400` with reason `ACCOUNT_NOT_LINKED` → no connection; redirect with `status=not_linked`.
6. **Next.js:** create/update the connection (`connected` or `partial`), enqueue the hot-load job, `302` to `humanaudit://oauth/google-health?status=connected|partial|not_linked|error`.
7. **App:** `openAuthSessionAsync` resolves with that URL → show the result, refetch connections.

### Data sync

- **Backfill depth:** 30 days, in two passes as Google recommends: a hot load of the last 14 days right after connect, then a cold load of days 15–30 from the queue.
- **Use `:reconcile`, not `list`,** for every v1 type. It removes overlapping records from re-synced or multiple devices. Pass `dataSourceFamily=users/me/dataSourceFamilies/google-wearables` so only Fitbit/Pixel device data comes back. The `google-sources` family also includes Health Connect and manual entries, which would duplicate data HumanAudit may already get from Health Connect. Exception: `weight` uses `google-sources`, because scales and manual logs are not wearables. `list` rejects `dataSourceFamily` for `sleep`, which is another reason to use `reconcile`.
- **Paging:** follow `nextPageToken` until empty. `sleep` and `exercise` return at most 25 per page; most other types up to 10,000.
- **Daily totals:** use `:dailyRollUp` with `windowSizeDays: 1` for steps and energy; it assigns data to the user's local calendar day across DST and travel. Rollup ranges are capped at 14 days for `heart-rate`, `active-minutes` and `total-calories`, and 90 days for other types, so chunk requests.
- **Webhooks:** register one subscriber per Google Cloud project (see "Webhook subscriber" below). The data types index marks webhook support for every v1 type except `active-energy-burned`, which is polled.
- **Notification handling:** treat each notification as a trigger; enqueue `gh_fetch(userId, dataType, window)` and respond **204 immediately** (any other status is retried). Fetches are idempotent (deterministic sample ids). Notifications are not backfilled for data created before the subscriber existed. Delete notifications do not tombstone in v1; the next fetch simply stops returning the record.
- **Polling:** on app open (`POST /api/v1/sync`) and a jittered 4-hourly schedule as a safety net; `active-energy-burned` relies on it.
- **Data freshness:** new data only appears after the tracker syncs to the Google Health app, roughly every 15 minutes while the app is open or running in the background.

### Webhook subscriber

Created once per Google Cloud project (not per user), by hand or with a script, after the production webhook URL is deployed.

```http
POST https://health.googleapis.com/v4/projects/{PROJECT_NUMBER}/subscribers?subscriberId=humanaudit-prod
Authorization: Bearer <access token of a service account or user with the Google Health API Editor/Admin role>
{
  "endpointUri": "https://<next-host>/api/v1/webhooks/google-health",
  "subscriberConfigs": [{
    "dataTypes": ["sleep", "steps", "weight", "daily-heart-rate-variability", "daily-resting-heart-rate", "heart-rate", "exercise"],
    "subscriptionCreatePolicy": "AUTOMATIC"
  }],
  "endpointAuthorization": { "secret": "Bearer <random-string>" }
}
```

- **`{PROJECT_NUMBER}` is the numeric project number, not the project id** (Cloud console, project settings). `subscriberId` is 4-36 characters, `[a-z]([a-z0-9-]{2,34}[a-z0-9])`. `dataTypes` use the kebab-case names from the data types index (Google's webhook examples use `"steps"` and `"sleep"`).
- `secret` is sent verbatim as the `Authorization` header on every notification. Put the same full string (including the `Bearer ` prefix) in `GOOGLE_HEALTH_WEBHOOK_SECRET`.
- The endpoint must be public HTTPS (TLS 1.2+).
- IAM: the caller needs Google Health API Editor or Admin to manage subscribers. A service account is recommended, not required.
- Other operations: `GET .../subscribers` (list), `PATCH .../subscribers/{id}?updateMask=...` (`subscriberConfigs` is a full replacement, not a merge), `DELETE .../subscribers/{id}`.
- **Verification handshake** (runs synchronously inside create/update, and whenever `endpointUri` or `endpointAuthorization` changes). Google sends two POSTs with `User-Agent: Google-Health-API-Webhooks` and body `{"type":"verification"}`:
  1. With the `Authorization` header. The endpoint must answer **200 or 201**.
  2. **Without credentials. The endpoint must answer 401 or 403.**
  Anything else fails the API call with `FAILED_PRECONDITION`. The route does both: it compares `Authorization` to `GOOGLE_HEALTH_WEBHOOK_SECRET`.
- **Signature:** every notification carries `GOOGLE-HEALTH-API-SIGNATURE`, a Tink ECDSA (P-256) signature over the raw body; public keyset at `https://www.gstatic.com/googlehealthapi/webhooks/webhooks_public_keyset.json`, rotated about every 30 days. **v1 does not verify it** (`ponytail:` note in the route); the shared secret is the only check. Add verification if the webhook URL becomes guessable or high-value.
- **Secret rotation:** accept the old and new secret, `PATCH ?updateMask=endpointAuthorization` with the new one, then drop the old. The route currently accepts a single secret, so rotate during a quiet moment and rely on the 4-hourly poll to catch anything missed.
- Automatic subscription names look like `auto-<project-number>-<subscriber-id>-WEBHOOK_DATA_TYPE_<TYPE>` (for example `...-WEBHOOK_DATA_TYPE_STEPS`).

### Endpoints

```http
GET  https://health.googleapis.com/v4/users/me/identity
GET  https://health.googleapis.com/v4/users/me/dataTypes/{data-type}/dataPoints:reconcile
       ?dataSourceFamily=users/me/dataSourceFamilies/google-wearables
       &filter={data_type}.{field} >= "…" AND {data_type}.{field} < "…"
       &pageToken=…
GET  https://health.googleapis.com/v4/users/me/dataTypes/{data-type}/dataPoints   (raw list)
POST https://health.googleapis.com/v4/users/me/dataTypes/{data-type}/dataPoints:rollUp
       { "range": { "startTime": "…Z", "endTime": "…Z" }, "windowSize": "3600s", "dataSourceFamily": "…" }
POST https://health.googleapis.com/v4/users/me/dataTypes/{data-type}/dataPoints:dailyRollUp
       { "range": { "start": { "date": {…}, "time": {…} }, "end": { … } }, "windowSizeDays": 1 }
GET  https://health.googleapis.com/v4/users/me/pairedDevices   (lastSyncTime; needs an extra scope, skip in v1)
```

Example, last night's sleep from the wearable:

```http
GET https://health.googleapis.com/v4/users/me/dataTypes/sleep/dataPoints:reconcile
  ?dataSourceFamily=users/me/dataSourceFamilies/google-wearables
  &filter=sleep.interval.civil_end_time >= "2026-10-23T00:00:00" AND sleep.interval.civil_end_time < "2026-10-23T14:00:00"
Authorization: Bearer <access-token>
```

The response carries `sleep.interval`, `stages[]` (AWAKE, LIGHT, DEEP, REM) and `summary.minutesAsleep`; map them to the sleep stage set.

### Filter rules

- Path uses kebab case (`daily-heart-rate-variability`); the filter uses snake case (`daily_heart_rate_variability`). Hyphens in a filter return `INVALID_DATA_POINT_FILTER`.
- Only `>=` and `<` comparisons, joined with `AND`. No `OR`, `=`, `>` or `<=`.
- Physical time = RFC 3339 with `Z` or an offset; civil time = `YYYY-MM-DD[THH:mm:ss]`. Never mix the two in one filter.
- URL-encode the filter.
- Field by record type: Interval → `.interval.start_time` / `.interval.civil_start_time`; Sample → `.sample_time.physical_time` / `.sample_time.civil_time`; Daily → `.date`; Sleep → `.interval.end_time` / `.interval.civil_end_time`; Exercise → `.interval.civil_start_time`.

### Tokens

- Refresh on demand inside a sync when the access token is near expiry; do not run a batch refresh cron (Google advises against it).
- `invalid_grant` on refresh → connection `needs_reauth`; stop polling; show reconnect.
- Scope changes → re-run consent with `prompt=consent` and the full scope list.
- Optional: enable the RISC API to receive revocation events and clean up tokens.
- Tokens never leave the backend. Encrypt at rest (KMS or libsodium with a key from secret manager).

### Limits

- Default quotas: 300 requests/minute per user, 120,000/minute and 86.4M/day per project. Back off exponentially on `429` and `504`; never retry a large failed request immediately.
- 64-bit integers come back as JSON strings (`"beatsPerMinute": "72"`, `"countSum": "8430"`); parse them explicitly.
- Data presence: distinguish no data from a true zero (Google documents this per data type); store `null`, not `0`.
- Testing data: no sample data is provided; wear the tracker, log manually in the Google Health app, or write test points via the API in the dev project.

## 9. Backend services and API endpoints

> **As built:** the design below used Supabase Queues, pg\_cron, pg\_net, Vault, `supabase-js` and `@clerk/nextjs`. The implementation is simpler: Supabase is plain managed Postgres reached through `pg`, auth is a `jose` JWT check against Clerk's JWKS, and the queue is a Postgres `jobs` table. See "Implementation notes (as built)" at the end of section 15. Where the text below disagrees with that section, that section wins.

The existing Next.js app on Vercel hosts every API route and the job worker; Supabase provides Postgres, the job queue (Supabase Queues / pgmq), the scheduler (pg\_cron), outbound HTTP from SQL (pg\_net) and secrets (Vault). The mobile app talks only to Next.js. Every `/api/v1` route except the OAuth callback, the Google webhook and the worker requires a Clerk session token.

### Components

- **Next.js route handlers on Vercel** (`app/api/v1/**/route.ts`): REST endpoints below, the OAuth callback, the Google webhook receiver and the job worker (`/api/v1/jobs/run`).
- **Auth:** the Expo app sends `Authorization: Bearer <Clerk session token>` (from `getToken()` in `@clerk/expo`); routes verify it with `@clerk/nextjs/server` and read `userId`.
- **Supabase Postgres:** tables from section 5, accessed only by Next.js with the service-role key. No Supabase client in the mobile app, and no Clerk third-party auth in Supabase needed. RLS is on with no policies as defence in depth.
- **Data-access module:** one server-only module (`lib/db/*`) wraps every query; each function takes `userId` as a required argument, because the service role bypasses RLS.
- **Supabase Queues (pgmq):** `gh_hot_load`, `gh_cold_load`, `gh_fetch`, `summaries_recompute`.
- **Supabase Cron (pg\_cron) + pg\_net:** the scheduler. Vercel Cron is not used: on the Hobby plan it runs at most once per day, within an hour window.
- **Vault:** the worker URL and its shared secret, read inside cron SQL (never inline in `cron.schedule`). Google client secret and the token-encryption key live in Vercel environment variables.

### Endpoints

| Method | Path | Caller | Purpose |
| --- | --- | --- | --- |
| POST | `/v1/devices` | App on launch | Register/refresh device (id, platform, name, appVersion, pushToken) |
| GET | `/v1/connections` | App | All connections with status, collector device name, lastSyncAt, grantedMetrics |
| POST | `/v1/connections` | Collector device | Create a device-bound connection (`source`, `deviceId`, `grantedMetrics`) |
| PATCH | `/v1/connections/:id` | Collector / app | Update grantedMetrics, status, lastSyncError |
| POST | `/v1/connections/:id/claim-collector` | New collector device | Move the collector to this device (new phone) |
| DELETE | `/v1/connections/:id?deleteData=bool` | App | Disconnect; optionally delete that source's samples |
| POST | `/v1/connections/google-health/start` | App | Create OAuth state, return Google auth URL |
| GET | `/v1/oauth/google-health/callback` | Google (browser redirect) | Exchange code, store tokens, identity check, redirect to app |
| POST | `/v1/webhooks/google-health` | Google | Verification handshake + data-change notifications |
| GET | `/v1/sync-cursors/:connectionId` | Collector | Read cursors (anchors / change tokens) |
| PUT | `/v1/sync-cursors/:connectionId/:metric` | Collector | Save cursor after a successful upload |
| POST | `/v1/ingest` | Collector | Batch upsert samples + tombstones (idempotent) |
| POST | `/v1/sync` | App on open / pull-to-refresh | Trigger server-side Google Health fetch for this user |
| GET | `/v1/preferences/metrics` | App | Primary + fallback order per metric |
| PUT | `/v1/preferences/metrics/:metric` | App | Set order for a metric; triggers summary recompute |
| GET | `/v1/summaries?from&to&metrics` | App | Daily summaries for dashboards |
| GET | `/v1/samples?metric&from&to` | App | Raw samples for detail charts |

All paths are Next.js route handlers under `app/api/v1/…`, served at `https://<next-host>/api/v1/…` (the table omits the `/api` prefix).

### Ingest contract

```ts
// POST /api/v1/ingest
type IngestRequest = {
  connectionId: string;
  deviceId: string;           // must equal connection.collectorDeviceId, else 409
  samples: Omit<Sample, "id" | "userId" | "ingestedAt">[];   // max 1000 per call
  deleted: { originId: string; metric: Metric }[];           // tombstones
};
type IngestResponse = { accepted: number; duplicates: number; tombstoned: number };
```

- Server computes `id = sha256(source \0 metric \0 originId)` → re-uploads are no-ops.
- Validate units and timestamps; reject future-dated samples beyond a small skew.
- After commit, enqueue `summaries.recompute(userId, affectedLocalDates)`.

### Jobs

- `gh_hot_load(connectionId)` — last 14 days per granted type, right after connect.
- `gh_cold_load(connectionId, dataType, window)` — days 15–30, one message per type and window; marks `backfill_completed_at` when the last one finishes.
- `gh_fetch(connectionId, dataType, window)` — from a webhook or poll; refresh the access token on demand; upsert; enqueue recompute.
- `gh_poll` — pg\_cron enqueues `gh_fetch` per connected user every \~4 h (jittered); skips `needs_reauth`. Covers `active-energy-burned` and missed webhooks.
- `summaries_recompute(userId, dates)` — applies preferences + dedup (section 10).
- `connections_stale_check` — hourly; `connected` → `stale` after 24 h without sync; push a nudge to the collector device; `collector_missing` if the device has not been seen for 14 days.

### Job runner on Supabase

```sql
-- once, in a migration
create extension if not exists pgmq;
create extension if not exists pg_net;
create extension if not exists pg_cron;
select pgmq.create('gh_hot_load');
select pgmq.create('gh_cold_load');
select pgmq.create('gh_fetch');
select pgmq.create('summaries_recompute');
select vault.create_secret('https://<next-host>/api/v1/jobs/run', 'worker_url');
select vault.create_secret('<random-64-char-secret>', 'worker_secret');

-- every minute: wake the Next.js worker
select cron.schedule('run-worker', '* * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'worker_url'),
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'worker_secret')),
    body := '{}'::jsonb);
$$);
```

- **Respond first, work after:** the worker route checks `x-worker-secret`, returns `202` immediately, and does the work inside Next.js `after()`. pg\_net calls are fire-and-forget with a short timeout, so the request must not wait on the work.
- **Vercel limits:** with Fluid compute, functions run up to 300 s on Hobby (default and maximum) and up to 800 s on Pro. Set `export const maxDuration = 60` on the worker and stop taking new messages after \~50 s, so a run finishes before the next minute's cron call.
- **Processing:** for each queue, call `pgmq.read(queue, visibility_timeout => 120, qty => N)` through a small SQL function via `supabase.rpc`, process within the time budget, and `pgmq.delete` on success.
- **Retries:** failed messages reappear after the visibility timeout. After 5 reads (`read_ct`), `pgmq.archive` them and log for inspection.
- **Producers** (connect callback, webhook route, ingest) enqueue with `pgmq.send` through the same RPC wrappers.
- **Message size:** one data type × one window per message, so each takes seconds.
- **URL:** `worker_url` must be the production domain. Vercel Deployment Protection blocks unauthenticated requests to preview deployments, so pg\_net cannot reach them.
- Hosted Supabase runs cron in UTC; the Supabase CLI local stack includes pgmq, pg\_cron, pg\_net and Vault for local testing.

## 10. Source priority, deduplication and normalization

For each user, metric and local day, the summary comes from the first connection in that metric's order that has data for that day; samples arriving through a second path from the same origin are excluded.

### Default order (only when the user has not chosen)

1. The first connected source that supports the metric.
2. When a second source connects, ask once: "Use Google Health for sleep, HRV and resting heart rate?" (prefilled with sensible picks), never switch silently.

### Resolution per metric and day

1. Load the metric's `order` (connection ids).
2. For each connection in order: take its samples for the local day, minus excluded origins (below). If any remain, use them and stop.
3. No connection has data → `value: null` (no data, not zero).
4. Record `connectionId` on the summary so the UI can show "from Google Health".

### Origin exclusion (cross-path dedup)

| Primary connection | Exclude from other connections | Why |
| --- | --- | --- |
| `google_health` | HealthKit and Health Connect samples whose `origin_app` = `com.fitbit.FitbitMobile` (Google Health app on both platforms) | Same Fitbit/Pixel data mirrored into the platform store |
| `healthkit` | Nothing from Google Health by default | Apple Watch data does not reach Google Health |
| `health_connect` | Google Health data is already limited to the `google-wearables` family, so Health Connect data never comes back through Google Health; exclude `com.fitbit.FitbitMobile` records only for metrics where Google Health is also connected | Avoid double counting when both are connected |
| Any | `com.kaalaaadmi.humanaudit` (HumanAudit's own writes, e.g. hydration) | Own writes must never be re-imported |

Exclusion applies only to fallback lookups; the primary's own data is never filtered, except HumanAudit's own origin, which is always excluded. Origin ids live in the `origin_map` table, not in code.

**The user always chooses the path.** For Fitbit/Pixel data on iOS there are two valid choices per metric: "Google Health (direct)" reads the Google Health API and ignores any copy in Apple Health; "Apple Health" reads HealthKit, including data Google Health shared there. The origin id is only used to drop the copy in the first case; it never routes data through Apple Health.

### Within-source overlap

- **Sleep:** one store may hold overlapping sessions (phone + watch). Pick the session set from the single origin with the most asleep minutes for that night; never sum overlapping sessions.
- **Steps / energy:** sum samples within one origin; across origins in the same store, take the origin with the highest daily total (Apple Health's own priority list is not exposed to apps).
- **Workouts:** dedupe sessions overlapping by more than 80% of their duration; keep the one from the higher-priority origin.

### Normalization

- Canonical units per metric (section 5); convert at ingest.
- Store UTC + `tzOffsetMinutes`; assign samples to a local day by the user's offset at sample time (handles travel).
- Sleep belongs to the local date it ends on.
- **HRV:** keep `variant` (`sdnn` from Apple Health, `rmssd` from Health Connect / Google Health). Baselines, trends and readiness are computed per variant; switching the HRV source resets the readiness baseline with a visible note ("new baseline building, 7 days").
- Never chart SDNN and RMSSD on one line.

### Recompute triggers

- New ingest for those dates.
- Preference change for a metric → recompute that metric's full history (summaries only; raw samples untouched).
- Connection removed with `deleteData=false` → its samples stay but drop out of the order.

## 11. App UX

One Data sources screen lists every source on every platform, shows each connection's state and collector, and lets the user set the primary source per metric.

### Screens

- **Settings → Data sources:** a card per source (Apple Health, Health Connect, Google Health), always all three, with a platform-appropriate action.
- **Source detail:** status, collector device, last sync, granted metrics, missing permissions, "Sync now", "Disconnect" (with keep/delete data choice).
- **Metric sources:** a row per metric → picker of connected sources that support it, reorderable fallbacks, a note when a source switch resets a baseline (HRV).
- **Onboarding step:** "Where does your health data live?" → multi-select of devices/apps → routes to the right connect flows.

### Card states and actions

| State | iOS card (Apple Health) | Android card (Health Connect) | Google Health card (both) |
| --- | --- | --- | --- |
| Not connected, possible here | "Connect" → HealthKit sheet | "Connect" → HC permissions (install/update HC first if needed) | "Connect" → pre-connect explainer → Google consent |
| Not connected, other platform | "Install HumanAudit on your iPhone to add Apple Health" (shown on Android) | "Available on Android" (shown on iOS) | — |
| Connected | "Synced 12 min ago · this iPhone" | "Synced 2 h ago · Pixel 9" | "Synced 5 min ago" |
| Connected via other device | "Syncing from Arnav's iPhone · 3 h ago" | "Syncing from Arnav's Pixel · 1 h ago" | — |
| Partial | "Missing: HRV, Workouts · Fix" | "Missing: Sleep · Fix" | "Missing scopes: Sleep · Reconnect" |
| Stale (>24 h) | "Open HumanAudit on this iPhone to sync" | "Open the app to sync" | "No new data since … · Check Google Health app sync" |
| Needs re-auth | "Permissions removed · Reconnect" | "Permissions removed (reinstall?) · Reconnect" | "Google access expired · Reconnect" |
| Collector missing | "iPhone not seen for 14 days · Move to this device" (iOS only) | same pattern | — |

### Copy that must exist

- Google Health pre-connect: "First sign in to the Google Health app with the same Google account. Then tap Continue." + one line per scope explaining its use.
- Google Health `not_linked` result: "This Google account has no Google Health profile yet. Open the Google Health app, sign in, then try again."
- Health Connect + Fitbit: "In the Google Health app, turn on Health Connect sync, then come back."
- HRV source switch: "Apple Health measures HRV as SDNN; Google Health uses RMSSD. Your readiness baseline restarts."
- Duplicate-path hint (when both GH and HK are connected and Google Health → Apple Health sync is detected): "Fitbit data also arrives through Apple Health. HumanAudit uses Google Health directly and ignores the copy."

### Behaviour

- Foreground sync on app open (device-bound sources) + `POST /api/v1/sync` (Google Health), throttled to once per 15 min.
- Pull-to-refresh on dashboards triggers the same.
- Each dashboard metric shows a small source label ("Sleep · Google Health").

## 12. Config and project setup changes

The mobile app needs five new packages, a URL scheme, plugin options and Android health permissions; the backend needs Google OAuth secrets; Google Cloud and Play Console need one-time setup.

### Mobile packages (`apps/mobile`, install with `npx expo install`)

| Package | Why | Status |
| --- | --- | --- |
| `@kingstinct/react-native-healthkit` + `react-native-nitro-modules` | Apple Health adapter | Installed |
| `react-native-health-connect` | Health Connect adapter | Installed |
| `expo-web-browser` | Google OAuth in the system browser (`openAuthSessionAsync`) | Add |
| `expo-build-properties` | Android compile/target SDK 36, min SDK 26 | Add |
| `expo-background-task` + `expo-task-manager` | Periodic Health Connect sync on Android (WorkManager) | Add |
| `expo-device` | Device name/model for the collector label | Add |
| `expo-secure-store` | Persist device id | Installed |

Next.js side: `@clerk/nextjs` (token verification), `@supabase/supabase-js` (RLS client + service-role client). Google OAuth and Google Health calls are plain `fetch`; no Google client library needed.

After adding native packages: `npx expo prebuild --clean`, rebuild the dev client, reinstall on the phone. Keep the root `package.json` overrides that pin Reanimated/worklets.

### `app.json` changes

```json
{
  "expo": {
    "scheme": "humanaudit",
    "ios": {
      "bundleIdentifier": "com.kaalaaadmi.humanaudit"
    },
    "android": {
      "package": "com.kaalaaadmi.humanaudit",
      "permissions": [
        "android.permission.CAMERA",
        "android.permission.health.READ_SLEEP",
        "android.permission.health.READ_HEART_RATE_VARIABILITY",
        "android.permission.health.READ_RESTING_HEART_RATE",
        "android.permission.health.READ_HEART_RATE",
        "android.permission.health.READ_STEPS",
        "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
        "android.permission.health.READ_EXERCISE",
        "android.permission.health.READ_WEIGHT",
        "android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND"
      ]
    },
    "plugins": [
      ["@kingstinct/react-native-healthkit", {
        "NSHealthShareUsageDescription": "HumanAudit reads sleep, HRV, heart rate, steps and workouts to build your daily audit.",
        "NSHealthUpdateUsageDescription": "HumanAudit writes hydration logs to Apple Health.",
        "background": true
      }],
      "react-native-health-connect",
      ["expo-build-properties", {
        "android": { "compileSdkVersion": 36, "targetSdkVersion": 36, "minSdkVersion": 26 }
      }]
    ]
  }
}
```

Only the changed keys are shown; merge into the existing file (keep the other plugins, splash plugin, camera strings).

- Remove the manual `ios.entitlements` HealthKit keys and `NSHealth*` from `ios.infoPlist` once the plugin build is confirmed to produce them.
- iOS bundle id and Android package are both `com.kaalaaadmi.humanaudit`. This is also HumanAudit's own origin id in HealthKit and Health Connect (section 10).
- `expo-background-task` adds the iOS `processing` background mode and its task identifier automatically at prebuild; HumanAudit only schedules it on Android in v1.

### Backend configuration

| Variable (Vercel env) | Value |
| --- | --- |
| `DATABASE_URL` | Supabase **pooler** connection string (the direct host is IPv6-only and fails on Vercel; use transaction mode for serverless) |
| `CLERK_PUBLISHABLE_KEY` | Used to derive the issuer and JWKS for session-token verification (no secret key needed) |
| `GOOGLE_HEALTH_CLIENT_ID` / `GOOGLE_HEALTH_CLIENT_SECRET` | Web Server OAuth client, per environment |
| `GOOGLE_HEALTH_REDIRECT_URI` | `https://<next-host>/api/v1/oauth/google-health/callback` |
| `APP_OAUTH_RETURN_URL` | Optional; defaults to `humanaudit://oauth/google-health` |
| `OAUTH_STATE_SIGNING_KEY` | Signs single-use `state` (`openssl rand -hex 32`) |
| `TOKEN_ENCRYPTION_KEY` | AES-256-GCM key for `oauth_tokens`, base64 of 32 bytes (`openssl rand -base64 32`). Losing it orphans every stored token |
| `WORKER_SECRET` | Checked against the `x-worker-secret` header on `/api/v1/jobs/run` |
| `GOOGLE_HEALTH_WEBHOOK_SECRET` | Full `Authorization` header value registered on the subscriber, e.g. `Bearer <random>` |

Mobile (`apps/mobile`): `EXPO_PUBLIC_API_URL` = the Next.js origin.

### One-time platform setup

- [ ] Supabase: run `packages/db/drizzle/apply_all.sql` (or `0008_data_connectors.sql` on an existing database) in the SQL editor. No extensions needed.
- [ ] Vercel: add the env vars above to Production (and a separate set for Preview pointing at the dev Google Cloud project); enable Fluid compute if it is not already on.
- [ ] Google Cloud: create dev + prod projects; enable Google Health API; Web Server OAuth client with the Vercel callback redirect URI; External consent screen; add test users; add the three read scopes; publish to In production.
- [ ] Google Cloud: service account (or your own user) with the Google Health API Editor role; create the subscriber using the **project number**, pointing at the production webhook URL, with `endpointAuthorization.secret` equal to `GOOGLE_HEALTH_WEBHOOK_SECRET`; the handshake needs the app deployed first.
- [ ] Scheduler: something must `POST /api/v1/jobs/run` with `x-worker-secret` every minute (Vercel Hobby cron is daily at best, so use an external pinger or Supabase pg\_cron + pg\_net).
- [ ] Apple: confirm HealthKit capability on the App ID (EAS credentials handle provisioning); privacy policy URL ready for App Review.
- [ ] Google Play: Play Console developer account; Health Connect data access declaration per permission (no history permission in v1); allow up to 7 days review + 5–7 business days allowlist propagation.
- [ ] Privacy policy page covering Apple Health, Health Connect and Google Health data use, retention and deletion.

## 13. Implementation plan

Eight phases (0–7), ordered so the author's own setup (iPhone + Fitbit Air via Google Health) works end to end first; each phase ends with a testable "done when".

### Phase 0 — Foundations

- [ ] Supabase migration for the section 5 schema (RLS on, no policies); seed `origin_map` with `com.fitbit.FitbitMobile` and `com.kaalaaadmi.humanaudit`.
- [ ] Next.js: Clerk bearer-token verification helper for `/api/v1`; server-only service-role Supabase client; data-access module with required `userId` on every function.
- [ ] Metric catalogue as a shared TS module (mobile + Next.js).
- [ ] `POST /api/v1/devices`; app generates and stores a device id in `expo-secure-store` on first launch.
- [ ] `POST /api/v1/ingest` with deterministic ids, tombstones, batch limit, collector check.
- [ ] Job runner: pgmq queues, pg\_cron worker call via pg\_net with Vault secrets, `/api/v1/jobs/run` returning 202 and working in `after()` with a 50 s budget.
- [ ] `summaries_recompute` with the simple rule (single source) and `GET /api/v1/summaries`.
- [ ] Shared `SourceAdapter` interface in the app (`connect`, `disconnect`, `status`, `sync`).
- [ ] Tag every record HumanAudit writes (hydration today) and exclude HumanAudit's own origin on read (groundwork for v2 write-back, section 15).

Done when: a fake adapter can upload samples twice and summaries show one copy.

### Phase 1 — Google Health on iPhone (author's setup)

- [ ] Google Cloud dev project, Web Server client, three read scopes, test user, published to In production.
- [ ] `POST /api/v1/connections/google-health/start` + signed `state`.
- [ ] Callback: code exchange, encrypted tokens, `users/me/identity` check (`healthUserId`), deep-link redirect.
- [ ] App: pre-connect screen, `openAuthSessionAsync`, result handling; `scheme: humanaudit`.
- [ ] `gh_hot_load` (14 days), `gh_cold_load` (days 15–30) and `gh_fetch` using `:reconcile` with the `google-wearables` family, on-demand token refresh and 429/504 backoff.
- [ ] Mappers for the section 8 data types, parsing string-encoded integers.
- [ ] `POST /api/v1/sync` on app open; `gh_poll` schedule.
- [ ] Partial-scope handling and `needs_reauth` on `invalid_grant`.

Done when: on the iPhone, connecting Google Health shows last night's Fitbit Air sleep and HRV within a minute, and it still syncs 8+ days later (no testing-mode expiry).

### Phase 2 — Webhooks

- [ ] `POST /v1/webhooks/google-health` with verification handshake and fast 2xx.
- [ ] Service account + subscriber with AUTOMATIC config for sleep, activity, weight.
- [ ] Notification → `gh.fetch` job; idempotent.

Done when: a new night's sleep appears without opening the app.

### Phase 3 — Apple Health adapter

- [ ] Plugin `background: true`; prebuild; remove duplicated entitlements after verifying.
- [ ] Authorization per enabled metric, gated before any query.
- [ ] Anchored sync loop with paging, upload-then-save-anchor.
- [ ] `enableBackgroundDelivery` + module-scope `subscribeToChanges`; protected-data check.
- [ ] `originApp` captured; Google Health app's bundle id discovered and stored in the origin map.

Done when: an Apple Watch-style sample (or manual Health entry) reaches the backend while the app is backgrounded, and a reinstall resumes without duplicates.

### Phase 4 — Source choice, dedup and Data sources UX

- [ ] `MetricPreference` endpoints; default-order rule; one-time "which source?" prompt.
- [ ] Resolution + origin exclusion + within-source overlap rules (section 10).
- [ ] HRV variants and per-variant baselines; baseline reset note.
- [ ] Data sources screen, source detail, metric sources picker, all card states.
- [ ] Source label on dashboard metrics.

Done when: with Google Health and Apple Health both connected (and Google Health → Apple Health sync on), sleep shows once, labelled Google Health; switching sleep to Apple Health recomputes history.

### Phase 5 — Health Connect adapter (needs an Android test phone)

- [ ] `expo-build-properties`, Android permissions, rationale/privacy screen.
- [ ] SDK status check + install/update prompt; permission request incl. background read (no history permission in v1).
- [ ] 30-day windowed backfill, `getChanges` incremental, token-expiry fallback.
- [ ] `expo-background-task` periodic sync gated on the background permission.
- [ ] `dataOrigin` captured; Google Health app package added to the origin map.

Done when: on Android, Fitbit data via Health Connect and Google Health direct can both be connected without double counting.

### Phase 6 — Cross-device collector

- [ ] Connections listed on all devices with collector name; "install on your iPhone" prompt on Android.
- [ ] `claim-collector` for moving to a new phone.
- [ ] `connections.staleCheck` + push nudge to the collector device; `collector_missing` after 14 days.

Done when: an Android device shows Apple Health data collected by the iPhone, and a 24 h gap shows the stale state + nudge.

### Phase 7 — Hardening and release prep

- [ ] Unit tests: normalization, unit conversion, day assignment across time zones, dedup rules, HRV variants.
- [ ] Integration tests against the dev Google Cloud project with generated test data.
- [ ] Monitoring: sync failures per source, token refresh failures, webhook latency, stale connections count.
- [ ] Disconnect + delete-data path; account deletion removes tokens and samples.
- [ ] Privacy policy, App Store review notes, Play Console Health Connect declaration.
- [ ] Decide on Google verification + CASA before exceeding 100 Google Health users.

## 14. Risks and things to watch

The biggest risks are silent data gaps (locked iPhones, missing background permission, expired tokens) and double counting; each has a mitigation built into the design.

| Area | Risk / gotcha | Mitigation |
| --- | --- | --- |
| HealthKit | Querying a type before requesting authorization crashes the app | Single authorization gate; adapters refuse to query until it resolves |
| HealthKit | Read denial is invisible; denied types return empty | Treat empty as "no data yet"; offer "check permissions in Health app" |
| HealthKit | Data unreadable while the phone is locked; background window is short | `isProtectedDataAvailable` check; minimal background work; catch up on next unlock |
| HealthKit | Anchor saved before upload succeeds → lost data | Save anchor only after a 2xx from `/api/v1/ingest` |
| HealthKit | v16 throws on an undecodable anchor | Catch, clear the anchor deliberately, re-run the 30-day backfill |
| Health Connect | Reads limited to 30 days before first grant without the history permission | v1 backfills exactly 30 days, so no history permission; label history depth in UI |
| Health Connect | Reinstall revokes all permissions | Detect on launch → `needs_reauth`; re-run connect |
| Health Connect | Background reads need the special permission | Check granted permissions; fall back to foreground sync |
| Health Connect | Play Console declaration + allowlist takes up to \~2–3 weeks | Submit early in Phase 5 |
| Health Connect | Changes token expires if unused | Windowed re-read fallback |
| Health Connect | Vendors kill background work on swipe-away | Foreground sync on open; stale state in UI |
| Google Health | Testing-mode refresh tokens expire after 7 days | Publish the OAuth app to In production |
| Google Health | 100-user cap while unverified; verification + annual CASA for more | Stay under 100 for v1; plan verification budget before growth |
| Google Health | User has no Google Health profile | `users/me/identity` check; `ACCOUNT_NOT_LINKED` copy |
| Google Health | Partial scope consent | Map scopes → metrics; `partial` state; re-consent link |
| Google Health | `google-sources` / default family includes Health Connect and manual data | Query with `google-wearables` (weight: `google-sources`) |
| Google Health | Webhooks never backfill; `active-energy-burned` has none | Hot + cold load jobs; polling safety net |
| Google Health | Sleep and exercise pages hold only 25 items; rollups capped at 14/90 days | Follow `nextPageToken`; chunk rollup ranges |
| Google Health | 64-bit ints arrive as strings | Explicit parsing in the mapper, covered by unit tests |
| Google Health | Batch token refresh causes correlated failures | Refresh on demand per sync |
| Google Health | No sandbox; dev hits production API | Separate dev/prod Cloud projects; dedicated test accounts |
| Backend | Vercel function timeouts on long syncs (300 s Hobby, 800 s Pro) | Small queue messages; worker time budget; pgmq visibility timeout retries |
| Backend | Service-role key leaking, or a query missing its user filter (the service role bypasses RLS) | Service-role key only in Vercel server env; one data-access module with required userId; tests that every query is user-scoped |
| Cross-source | Same Fitbit data via two paths double counts | `origin_map` exclusion (section 10) |
| Cross-source | SDNN vs RMSSD mixed in one trend | `variant` on every HRV sample; per-variant baselines |
| Cross-source | Overlapping sleep sessions within one store | Single-origin session pick per night |
| Cross-source | Time zones / travel shift days | Store UTC + offset; local-day assignment; `dailyRollUp` for Google Health |
| Cross-device | Collector iPhone rarely used → stale Apple Health on Android | Stale state, push nudge, last-synced label |
| Security | Refresh tokens leaked from client | Tokens server-only, AES-256-GCM at rest; signed single-use OAuth state |
| Privacy | Health data handled without clear disclosure | Privacy policy, in-app disclosures per scope/permission, delete-data path |

## 15. Out of scope, later, and open questions

### Next version

- **Direct Garmin, Oura and Ultrahuman connections.** v1 already receives their data through Apple Health and Health Connect, because their apps write there. v2 adds direct cloud adapters on the backend, same pattern as Google Health: OAuth, encrypted tokens, webhooks or polling, and origin exclusion of their mirrored copies in HealthKit / Health Connect. Architecture impact: new `SourceId` values, adapter jobs, scope→metric maps and origin-map entries; no schema change.
  - **Garmin:** Health API is free for approved business developers only; new applications were reported paused in August 2026; historically OAuth 1.0a request signing with push/webhook feeds.
  - **Oura:** API v2 with OAuth2, free; personal access tokens deprecated; Gen3+ users need an active Oura Membership; the API agreement effective 8 June 2026 restricts AI processing and charging users for connected features without Oura's consent. Review against HumanAudit's use before building.
  - **Ultrahuman:** partner API, not self-serve; apply and get onboarded with client credentials.
- **Push nutrition and hydration to other apps.** Write calories, macros, micros and water to Apple Health (HealthKit dietary types / food correlation) and Health Connect (`NutritionRecord`, `HydrationRecord`); optionally Google Health via the `.nutrition.writeonly` scope (widens the verification scope). Other apps read these stores at their own discretion; no per-app pushes.
  - Needs: an outbound queue per destination, meal → record mapping, stored external ids per written record so edits and deletes update or remove them, retries with backoff, write permissions per platform, a per-destination user toggle.
- **Groundwork in v1 (do now):** tag everything HumanAudit writes (hydration today) and always exclude HumanAudit's own origin on read, so future writes never come back as imported data. Add HumanAudit's iOS bundle id and Android package name to the origin exclusion map (section 10).
- Apple Health export-file import (scenario G): upload the Health app export zip, parse server-side, ingest as source `healthkit_import`.
- Other cloud sources through the same adapter pattern: Whoop, Polar.
- Google verification + CASA assessment if Google Health users approach 100.

### Decisions

| Question | Decision / answer | Where |
| --- | --- | --- |
| Backend stack | Existing Next.js app on Vercel with Supabase as managed Postgres via `pg`; jobs in a Postgres `jobs` table (as built; the Supabase Queues / pg\_net design was dropped) | Section 15 notes |
| How the app reaches data | Mobile → Next.js only; Next.js connects with a privileged `DATABASE_URL`; RLS on with no policies; no Clerk third-party auth in Supabase | Sections 5, 9 |
| Scheduler | Any caller of `POST /api/v1/jobs/run` every minute; not Vercel Cron (Hobby runs at most daily) | Section 9 |
| Worker limits | Vercel Fluid compute: 300 s max on Hobby, 800 s on Pro; worker returns 202, works in `after()`, 60 s `maxDuration`, \~50 s budget | Section 9 |
| Google Health data types, endpoints, filters | `sleep`, `daily-heart-rate-variability`, `daily-resting-heart-rate`, `heart-rate`, `steps`, `active-energy-burned`, `exercise`, `weight`; `:reconcile` with `google-wearables`; `>=` / `<` filters | Section 8 |
| Scope for HRV and resting HR | `.health_metrics_and_measurements.readonly`; Google Health HRV is RMSSD (ms) | Section 8 |
| Google Health app origin ids | `com.fitbit.FitbitMobile` on both iOS (App Store lookup) and Android; verify once on device | Sections 6, 10 |
| HealthKit v16 API names | `isProtectedDataAvailable` / `isProtectedDataAvailableAsync`, `queryWorkoutSamplesWithAnchor`, `querySources`, `currentAppSource` | Section 6 |
| Health Connect history permission | `{ accessType: "read", recordType: "ReadHealthDataHistory" }`; not used in v1; grant not reported back (issue #276) | Section 7 |
| `expo-background-task` | WorkManager on Android, minimum interval 15 min, default 12 h; needs `expo-task-manager`; one shared worker | Sections 7, 12 |
| Backfill depth | 30 days for every source; Google Health as 14-day hot load + 16-day cold load | Sections 6–8 |
| App ids | iOS bundle id and Android package both `com.kaalaaadmi.humanaudit` | Section 12 |

### Still open

- [x] Run the source check in section 6 once on your iPhone to confirm Google Health writes to Apple Health as `com.fitbit.FitbitMobile`. -> Checked, it is the same: `com.fitbit.FitbitMobile`

### Implementation notes (as built)

The code deviates from the design above in these places. Treat this section as authoritative.

**Stack**
- Auth: `apps/web/lib/auth.ts` verifies the Clerk session JWT with `jose` against Clerk's JWKS; `withAuth` in `apps/web/lib/route.ts` wraps routes and maps `HttpError`. There is no `@clerk/nextjs`.
- Data: `query()` in `apps/web/lib/db.ts` over a `pg` Pool (TLS without CA verification, marked `ponytail:`). There is no `supabase-js` and no service-role key.
- Scoring engines (`sleepEngine`, etc.) stay in `apps/mobile/services/*Engine.ts` and are imported by the web app by relative path. Verify with a real `next build`.
- Mobile has no `SourceAdapter` interface. `services/connectors/index.ts` exposes `syncAll`, `connectDevice`, `forgetDeviceConnection`, `ensureBackgroundTask`; `healthkit.ts`, `healthconnect.ts` and `googleHealth.ts` hold the per-source code; `model.ts` holds pure types and normalizers.

**Job queue**
- A `jobs` table replaces pgmq, pg\_cron, pg\_net and Vault. `POST /api/v1/jobs/run` is secured by `x-worker-secret`, returns 202, does the work in `after()`, `maxDuration = 60`.
- Job kinds: `gh_hot_load`, `gh_fetch`, `gh_cold_load`, `summaries_recompute`, and the self-bootstrapping recurring `gh_poll` (every 4 h) and `connections_stale_check` (every 1 h). `gh_hot_load` takes only `{ connectionId }` and queues the cold loads.
- `gh_fetch` / `gh_cold_load` payload: `{ connectionId, metric, from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }`. Hot load = last 14 days; cold load = days 30 back to 14 back.
- Anything that calls the worker route once a minute drives the queue.

**Data model**
- Extra tables: `oauth_states` (single-use nonce) and `jobs`. `daily_summaries` has an extra `payload jsonb`.
- `samples.id = sha256(source \0 metric \0 originId)` (`sampleId` in `store.ts`).
- Tombstones are rows with `deleted_at` set, matched by `sampleId(source, metric, originId)`. HealthKit reports deleted samples as a bare uuid, so the metric comes from the query that returned them.
- Sleep is stored as **segments** (HealthKit: `payload.stage`, `value` = minutes) or **sessions** (Health Connect, Google: `payload.stages{deep,rem,light,awake,asleep}` + `inBed`). The unstaged "asleep" figure counts only when there are no stages.
- A night belongs to the **wake-up day**: `start + tz offset + 12 h`. `DAY_SQL` in `summaries.ts` and `dayOf()` in `resolve.ts` must stay in sync.
- `daily_summaries.value` per metric: sleep = asleep minutes; steps and active\_energy = sum from the winning origin; hrv and heart\_rate = mean; resting\_hr and weight = latest; workouts = total duration in seconds plus `count`.
- Legacy tables stay: `summaries_recompute` projects `daily_summaries` into `daily_vitals_summary` (new columns `hrv_variant`, `sleep_source`, `hrv_source`, `rhr_source`) and `workout_logs`, so existing screens keep working.
- HRV from Apple Health is **SDNN**; the old bridge wrongly stored it as RMSSD and was fixed. Google Health HRV is RMSSD. `hrv_variant` records which.

**API behaviour**
- `POST /devices` returns 409 when the device uuid belongs to another account; the client mints a new id and retries once.
- `PATCH /connections/:id` status allow-list: `connected`, `partial`, `stale`, `needs_reauth`, `error`.
- `GET /sync-cursors/:connectionId`: no cursor means first sync, so the client runs the 30-day backfill.
- The webhook route handles the verification handshake and notifications as described in section 8.

**Adapters**
- HealthKit `deletedSamples` carry only `{ uuid }`.
- Health Connect `getChanges` without a token only creates a token and returns an empty first response, so the adapter takes the token first, runs the windowed backfill, then stores the token.
- Google `dailyRollUp` is chunked to 14 days. Google `heart_rate` is not synced in v1.
- Collector rule: one device per Apple ID / Google account collects; a second iPhone on the same Apple ID is a viewer.
- Android package changed from `com.humanaudit.app` to `com.kaalaaadmi.humanaudit` to match iOS.

**Known gaps**
- Webhook Tink signature is not verified (section 8).
- Delete notifications from Google do not tombstone.
- `packages/db/drizzle/meta/_journal.json` lists only 0000-0004; apply SQL files by hand (`apply_all.sql`).
- `app.json` keeps the manual HealthKit entitlements and `NSHealth*` keys until a prebuild confirms the plugin generates them.
- `next build` has not been run against these routes.

## 16. References

- [@kingstinct/react-native-healthkit — GitHub](https://github.com/kingstinct/react-native-healthkit)
- [@kingstinct/react-native-healthkit 16.2.0 exports (unpkg)](https://app.unpkg.com/@kingstinct/react-native-healthkit@16.2.0/files/lib/module/healthkit.ios.js)
- [@kingstinct/react-native-healthkit 16.0.0 release notes](https://github.com/kingstinct/react-native-healthkit/releases/tag/%40kingstinct/react-native-healthkit%4016.0.0)
- [react-native-health-connect — GitHub](https://github.com/matinzd/react-native-health-connect)
- [react-native-health-connect — API overview](https://matinzd.github.io/react-native-health-connect/docs/api/overview)
- [react-native-health-connect — Background Access Permission](https://matinzd.github.io/react-native-health-connect/docs/api/methods/backgroundAccessPermission)
- [react-native-health-connect — issue #276 (history permission not reported)](https://github.com/matinzd/react-native-health-connect/issues/276)
- [Health Connect — Read raw data (30-day limit, background reads)](https://developer.android.com/guide/health-and-fitness/health-connect/develop/read-data)
- [Health Connect — HealthPermissions reference](https://developer.android.com/reference/android/health/connect/HealthPermissions)
- [Google Health API — Set up Google Cloud and OAuth](https://developers.google.com/health/setup)
- [Google Health API — Data types](https://developers.google.com/health/data-types)
- [Google Health API — Endpoints](https://developers.google.com/health/endpoints)
- [Google Health API — Filters](https://developers.google.com/health/filters)
- [Google Health API — Vitals](https://developers.google.com/health/data-types/vitals)
- [Google Health API — Scopes](https://developers.google.com/health/scopes)
- [Google Health API — Webhook subscriptions](https://developers.google.com/health/webhooks)
- [Google Health API — Rate limits](https://developers.google.com/health/rate-limits)
- [Google Health API — App verification](https://developers.google.com/health/app-verification)
- [Google Health API — Migration guide (ACCOUNT\_NOT\_LINKED)](https://developers.google.com/health/migration)
- [Google Health API — Developer user data policy (CASA)](https://developers.google.com/health/policies/health-api-developer-user-data-policy)
- [Vercel — Cron jobs usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Supabase — Connecting to Postgres (pooler modes)](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Android — Request access to Health Connect data types (Play Console form)](https://developer.android.com/health-and-fitness/guides/health-connect/publish/request-access)
- [Google Health (Fitbit) on Google Play — package com.fitbit.FitbitMobile](https://mixrank.com/playstore/apps/com.fitbit.FitbitMobile)
- [Expo — BackgroundTask](https://docs.expo.dev/versions/latest/sdk/background-task/)
- [Expo — Authentication with OAuth providers](https://docs.expo.dev/guides/authentication/)
- [Clerk — Integrate Supabase with Clerk](https://clerk.com/docs/guides/development/integrations/databases/supabase)
- [Supabase — Automatic embeddings (pgmq + pg\_net + pg\_cron + Vault pattern)](https://supabase.com/docs/guides/ai/automatic-embeddings)
- [Supabase — pg\_cron](https://supabase.com/docs/guides/database/extensions/pg_cron)
- [Apple — HKSource.bundleIdentifier](https://developer.apple.com/documentation/healthkit/hksource/bundleidentifier)
- [How to sync Google Health (Fitbit) to Health Connect — Second Nature](https://help.secondnature.io/en/articles/9761946-how-to-sync-google-health-fitbit-to-health-connect)
- [Does Apple Watch work with Android? — WhistleOut](https://www.whistleout.com/CellPhones/Guides/does-apple-wactch-work-with-android)
