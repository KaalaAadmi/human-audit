# Connectors setup guide (runbook)

Step-by-step record of how the data connectors are wired up, with a focus on Google Health, the job runner ("cron"), and the webhook. For the design and rationale see [`data-connectors.md`](./data-connectors.md); section 15 there ("Implementation notes (as built)") is authoritative where it differs from the original design.

> **Never commit secret values.** This guide lists env var **names** only. If a secret was ever pasted into chat, a ticket or a commit, rotate it.

## 0. What was built (and what differs from the design doc)

| Design doc says | As built |
|---|---|
| pgmq + pg_cron + pg_net + Supabase Vault | A plain Postgres `jobs` table, claimed with `FOR UPDATE SKIP LOCKED`. Works on any Postgres. |
| supabase-js + Supabase Auth | Clerk JWT verified with `jose`; DB access via `pg` (`apps/web/lib/db.ts`). |
| Edge Function worker | Next.js route `POST /api/v1/jobs/run` |

Consequence: **the repo contains no scheduler config** (no `vercel.json`, no cron SQL). Something external must call the job runner about once a minute (step 6). Without it, nothing is fetched after the first request.

## 1. Prerequisites

- Node + the monorepo installed (`npm install` at the root).
- A Postgres database (Supabase in production) and its `DATABASE_URL`.
- A Clerk application (`CLERK_PUBLISHABLE_KEY`).
- A Vercel project (or any host) serving `apps/web` over public HTTPS. Production: `https://human-audit.arnavbhattacharya.com/`.
- A Google account for the Cloud project; an Apple developer account + physical iPhone for HealthKit.

## 2. Generate secrets

```bash
openssl rand -base64 32   # TOKEN_ENCRYPTION_KEY (must decode to exactly 32 bytes)
openssl rand -base64 32   # OAUTH_STATE_SIGNING_KEY
openssl rand -hex 32      # WORKER_SECRET
openssl rand -hex 32      # random part of GOOGLE_HEALTH_WEBHOOK_SECRET
```

Use a different value for each.

## 3. Environment variables

**Web (`apps/web`, set locally in `.env` and on Vercel):**

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `CLERK_PUBLISHABLE_KEY` | Clerk JWT verification |
| `GOOGLE_HEALTH_CLIENT_ID` / `GOOGLE_HEALTH_CLIENT_SECRET` | OAuth client (step 5) |
| `GOOGLE_HEALTH_REDIRECT_URI` | `https://<host>/api/v1/oauth/google-health/callback` — must match Google Cloud exactly |
| `TOKEN_ENCRYPTION_KEY` | Encrypts refresh/access tokens in `oauth_tokens` (32 bytes, base64) |
| `OAUTH_STATE_SIGNING_KEY` | Signs the OAuth `state` parameter |
| `WORKER_SECRET` | Required in the `x-worker-secret` header of the job runner |
| `GOOGLE_HEALTH_WEBHOOK_SECRET` | Full `Authorization` header value Google sends on webhooks, **including the `Bearer ` prefix** |
| `APP_OAUTH_RETURN_URL` | Optional. Default `humanaudit://oauth/google-health` |

Unrelated to connectors but in the same file: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `USDA_API_KEY`, `SCALE_WEBHOOK_SECRET`.

**Mobile (`apps/mobile/.env`):** `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.

`/api/v1/connections/google-health/start` returns **503** if the client id or redirect URI is unset — check this first if "Connect" does nothing.

## 4. Database migrations

Migrations are applied **by hand**: `packages/db/drizzle/_journal.json` only lists 0000–0004, so `drizzle-kit migrate` will not apply the newer ones.

1. Open the Supabase SQL editor.
2. Run `packages/db/drizzle/0008_data_connectors.sql` (connectors: `connections`, `oauth_tokens`, `oauth_states`, `samples`, `summaries`, `jobs`, …).
3. Run `packages/db/drizzle/0009_content_moderation.sql` (shared-content moderation; idempotent, safe to re-run).

`apply_all.sql` is the concatenation of everything if you are starting from an empty database.

## 5. Google Cloud (Google Health API)

1. Create/select a Google Cloud project. Note both the **project id** and the numeric **project number** (project settings) — the webhook call in step 7 needs the number.
2. Enable the **Google Health API**.
3. **OAuth consent screen:** user type *External*; add your Google account(s) under *Test users*.
4. Add these scopes (prefix `https://www.googleapis.com/auth/googlehealth`):
   - `.sleep.readonly` → sleep
   - `.health_metrics_and_measurements.readonly` → HRV, resting HR, weight
   - `.activity_and_fitness.readonly` → steps, active energy, workouts
5. **Credentials → Create OAuth client ID → Web application** (not iOS/Android; the server does the code exchange).
   - Authorized redirect URI: `https://<host>/api/v1/oauth/google-health/callback`
6. Copy the client id/secret into `GOOGLE_HEALTH_CLIENT_ID` / `GOOGLE_HEALTH_CLIENT_SECRET`, and the redirect URI into `GOOGLE_HEALTH_REDIRECT_URI`.

> **Testing mode:** while the consent screen is in *Testing*, refresh tokens expire after **7 days** and the connection goes to `needs_reauth`. Fix by completing branding/verification and publishing to production.

## 6. Deploy the web app and start the job runner

1. Set all env vars from step 3 on Vercel, then deploy `apps/web` (the user commits and deploys; nothing here deploys automatically).
2. Confirm the routes exist (401 = deployed and auth-protected, 404 = not deployed):
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" "https://<host>/api/vitals?date=2026-10-24"
   ```
3. **Schedule the job runner.** It must be hit roughly **every minute**:
   ```bash
   curl -X POST https://<host>/api/v1/jobs/run -H "x-worker-secret: <WORKER_SECRET>"
   ```
   - Wrong/missing header → 401. Success → **202 immediately**; the work runs afterwards via Next's `after()` with a ~50 s budget (`maxDuration = 60`).
   - Any scheduler works. Options:
     - **cron-job.org** (or similar) — simplest: a POST every minute with the header above.
     - **Supabase `pg_cron` + `pg_net`** — `net.http_post(url, headers := jsonb_build_object('x-worker-secret', '<secret>'))` on `* * * * *`. Keep the secret out of committed SQL.
     - **Vercel Cron** — only if your plan allows per-minute schedules (check Vercel's current cron limits; Hobby plans have been restricted to far less frequent runs). Note Vercel Cron issues GET requests and this route is POST, so it would need a small adapter.
   - **Record here which one you actually use:** _(fill in — the repo does not say)_.
4. What the runner does on each tick (`apps/web/lib/connectors/jobs.ts`):
   - Claims jobs with a 120 s visibility timeout; a job is marked failed after 5 attempts.
   - Bootstraps one pending row per recurring kind, so the schedule survives an empty table.
   - Job kinds:

   | Kind | When | Does |
   |---|---|---|
   | `gh_hot_load` | Right after connect | Last 14 days per granted metric, then queues `gh_cold_load` |
   | `gh_cold_load` | After hot load | Days 30 → 14 back |
   | `gh_fetch` | Webhook / app sync | Re-fetch one metric/window |
   | `gh_poll` | Every 4 h | Queues the last 2 days per metric with up to 30 min random delay. Needed for `active-energy-burned` (no webhook) |
   | `connections_stale_check` | Every 1 h | `connected` → `stale` after 24 h; `collector_missing` after 14 days |
   | `summaries_recompute` | After new samples | Rebuilds daily summaries/projections |

## 7. Webhook subscriber (one-time, per Google Cloud project)

Do this **after** the web app is deployed with `GOOGLE_HEALTH_WEBHOOK_SECRET` set, because Google verifies the endpoint synchronously during creation.

```http
POST https://health.googleapis.com/v4/projects/{PROJECT_NUMBER}/subscribers?subscriberId=humanaudit-prod
Authorization: Bearer <access token; account needs Google Health API Editor/Admin>
Content-Type: application/json

{
  "endpointUri": "https://<host>/api/v1/webhooks/google-health",
  "subscriberConfigs": [{
    "dataTypes": ["sleep", "steps", "weight", "daily-heart-rate-variability", "daily-resting-heart-rate", "heart-rate", "exercise"],
    "subscriptionCreatePolicy": "AUTOMATIC"
  }],
  "endpointAuthorization": { "secret": "Bearer <random string>" }
}
```

- Use the **project number**, not the project id.
- `secret` must equal `GOOGLE_HEALTH_WEBHOOK_SECRET` exactly, `Bearer ` prefix included.
- **Verification handshake:** Google POSTs `{"type":"verification"}` twice — once with the header (route returns 200) and once without (route returns 401). Anything else fails with `FAILED_PRECONDITION`. Test it yourself:
  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<host>/api/v1/webhooks/google-health -d '{"type":"verification"}'   # expect 401
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<host>/api/v1/webhooks/google-health -H "Authorization: <full secret>" -d '{"type":"verification"}'   # expect 200
  ```
- Real notifications enqueue a `gh_fetch` for the changed window (padded by one day) and return **204**.
- Manage later: `GET .../subscribers`, `PATCH .../subscribers/{id}?updateMask=...` (`subscriberConfigs` is a **full replacement**), `DELETE .../subscribers/{id}`.
- Rotating the secret: the route accepts one secret at a time, so PATCH `endpointAuthorization` and update the env var together during a quiet moment; the 4-hourly poll catches anything missed.
- Webhooks are optional for correctness — without them, data still arrives via `gh_poll` and app-open syncs, only with more latency.

## 8. Connect from the app

1. App (Settings → Data sources) calls `POST /api/v1/connections/google-health/start` (Clerk-authenticated).
2. Server stores a nonce in `oauth_states` (valid 10 min) and returns Google's auth URL (`access_type=offline`, `prompt=consent`, signed `state`).
3. App opens it with `WebBrowser.openAuthSessionAsync(authUrl, 'humanaudit://oauth/google-health')` (`apps/mobile/services/connectors/googleHealth.ts`).
4. Google redirects to `/api/v1/oauth/google-health/callback`, which: verifies and consumes the state; exchanges the code (a refresh token is required); filters granted scopes; calls `users/me/identity`; upserts `connections` as `connected` or `partial`; stores encrypted tokens; enqueues `gh_hot_load`.
5. Callback redirects to `humanaudit://oauth/google-health?status=connected|partial|not_linked|error`.
   - `not_linked` = the Google account has no Google Health/Fitbit account linked (`ACCOUNT_NOT_LINKED`).
   - `partial` = the user ticked only some scopes; only those metrics sync.
6. Within about a minute (if the scheduler runs) the first data appears.

`app.json` requirements: scheme `humanaudit`, plugins `expo-web-browser` and `expo-background-task`. Bundle id / Android package: `com.kaalaaadmi.humanaudit`.

Token handling: access tokens refresh on demand; an `invalid_grant` marks the connection `needs_reauth` (user must reconnect). There is no separate refresh cron.

## 9. Apple Health and Health Connect (on-device collectors)

These run on the phone, not on the server; they push through `POST /api/v1/ingest`.

- **Apple Health (iOS):** requires a **physical device** and a dev build (not Expo Go). `ios/` is gitignored and generated by `npx expo prebuild`. HealthKit entitlements and `NSHealth*` usage strings currently also exist as manual entries in `app.json`; they can be removed once the config plugin is confirmed to add them on-device.
- **Health Connect (Android):** needs an Android test phone; not yet tested.
- `syncAll()` (`apps/mobile/services/connectors/index.ts`) runs the local collectors, then asks the server to sync when a Google Health connection exists. Foreground syncs are throttled to 15 minutes; the background task runs every 240 minutes.
- Source priority and dedup between Apple Health and Google Health: see section 10 of the design doc.

Build and install:

```bash
cd apps/mobile
npx expo prebuild --platform ios
npx expo run:ios --device
```

## 10. Verify end to end

1. `GET`-style checks (step 6.2) show 401, not 404.
2. After connecting, inspect the queue. Successful jobs are **deleted**, so a healthy queue is short and `run_at` is in the future for recurring kinds:
   ```sql
   select id, kind, run_at, attempts, last_error, failed_at from jobs order by run_at;
   ```
   If rows stay due (`run_at` in the past, `attempts = 0`) and never change, the scheduler is not calling the runner (or `WORKER_SECRET` mismatches → 401). Rows with `failed_at` set gave up after 5 attempts; read `last_error`.
3. Connection status:
   ```sql
   select source, status, granted_metrics, last_sync_at, last_sync_error, backfill_completed_at from connections;
   ```
4. Sample volume: `select metric, count(*) from samples group by metric;`
5. Local self-checks (from `apps/web` / `apps/mobile`):
   ```bash
   ../../node_modules/.bin/tsc --noEmit
   ../../node_modules/.bin/tsx lib/connectors/connectors.check.ts        # web
   ../../node_modules/.bin/tsx services/connectors/connectors.check.ts   # mobile
   ```
   `integration.check.mts` needs a local Postgres on port 5544 (db `ha`, `DATABASE_URL=postgres://<user>@localhost:5544/ha`).

## 11. Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Connect" returns 503 | `GOOGLE_HEALTH_CLIENT_ID` or `GOOGLE_HEALTH_REDIRECT_URI` unset on the deployed env |
| Google shows `redirect_uri_mismatch` | Redirect URI in Cloud console ≠ `GOOGLE_HEALTH_REDIRECT_URI` (check trailing slash, host) |
| Google blocks sign-in | Account not in *Test users* while consent screen is in Testing |
| Returns `status=not_linked` | Google account has no Google Health/Fitbit account |
| Connected but no data | Scheduler not running; or tracker hasn't synced to the Google Health app (~15 min); or 404 because the new routes aren't deployed |
| Jobs runner returns 401 | `x-worker-secret` ≠ `WORKER_SECRET` |
| Connection flips to `needs_reauth` after ~7 days | OAuth app still in Testing mode (7-day refresh tokens) |
| Connection `stale` | No successful sync for 24 h — check `gh_poll` jobs for `failed_at` |
| Webhook create fails `FAILED_PRECONDITION` | Endpoint didn't return 200 with auth and 401 without; wrong `GOOGLE_HEALTH_WEBHOOK_SECRET` (missing `Bearer ` prefix) or app not yet deployed |
| Day strain / vitals show an older day | Production running old code — redeploy (`/api/vitals` zeroes strain when the row's date ≠ requested date) |

## 12. Known gaps / to do

- OAuth consent screen is in **Testing**: complete branding + verification and publish.
- Webhook **Tink signature (`GOOGLE-HEALTH-API-SIGNATURE`) is not verified**; the shared secret is the only check (see `ponytail:` note in the route).
- Delete notifications do not tombstone; deleted records just stop being returned on the next fetch.
- Rotate `GOOGLE_HEALTH_WEBHOOK_SECRET` and `WORKER_SECRET` — both were exposed in a chat session.
- Scheduler choice is not recorded in the repo — fill in step 6.3.
- A real `next build` has not been run; only `tsc` and the self-checks.
- Apple Health and Health Connect have not been verified on a physical device.
- Migrations are manual; consider fixing `_journal.json` if you want `drizzle-kit migrate` to work.
