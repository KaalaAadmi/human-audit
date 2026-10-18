# HumanAudit — TODO & Formula Spec Needed

Status of everything still missing. Part B is the list of formulas/constants the owner must decide; code and docs are blocked on those.

---

## Part A — Missing work

### A1. Blocked on formulas (Part B)
- [ ] Rewrite `apps/mobile/services/wearableEngine.ts` (zones, strain, body age) to the final formulas.
- [ ] Add readiness engine (not implemented anywhere).
- [ ] Add sleep need / sleep performance / sleep score engine (not implemented anywhere).
- [ ] Fix source name mismatch: engine uses `health_connect`; docs, DB check constraint, `settings.tsx`, `syncService.ts` use `google_health`. Pick one.
- [ ] Reconcile PRD / TRD / TECHNICAL_DESIGN / UI_UX_DESIGN once formulas are final (zone %, bpm cut-offs, max HR formula).
- [ ] Decide what `daily_vitals_summary` must store (see A3), then migrate.

### A2. Native health data (nothing produces vitals today)
- [ ] Apple HealthKit bridge (`services/nativeHealthBridge.ts` is a stub returning no data). Needs entitlement, `NSHealthShareUsageDescription` (present), dev build.
- [ ] Google Health Connect bridge + config plugin.
- [ ] Pipeline: bridge -> engine -> write `daily_vitals_summary` and `workouts` via the API. No writer exists today; Home/Activity stay in empty state until this lands.
- [ ] Scale connectors (Hume, FITTR, Fitelo). `/api/webhooks/scale` only logs.
- [ ] Device e2e testing (nothing has been run on a real device).

### A3. Screens not built
- [ ] Screen 5 `sleep-detail` (docs call it a drag-down modal; no modal route set up).
- [ ] Screen 6 `body-age-detail` (Skia bio-orb; `@shopify/react-native-skia` installed but unused; shader uniforms in TECHNICAL_DESIGN §3).
- [ ] Decide navigation: PRD says one summary card -> either screen; APP_FLOW has two widgets; Home currently has one combined widget, not tappable.
- [ ] Data these screens need but DB/API lack:
  - Hypnogram segments (DB only has total seconds per stage).
  - Sleep efficiency, disturbance count, respiratory rate, resting-HR dip, sleep need, sleep performance %.
  - Body-age factor breakdown (only final `body_age` stored).
  - Date-range vitals endpoint for the 12-week trajectory (`/api/vitals` returns latest row only).
- [ ] UI doc numbers (24.2 yrs, 91%, HRV 64, RHR 51) are mock values, not system output.

### A4. Housekeeping
- [ ] `IMPLEMENTATION_PLAN.md` lines 40-41: Screens 5 and 6 are ticked `[x]` but not built; untick.
- [ ] Replace placeholder `OPENAI_API_KEY` / `GEMINI_API_KEY` in `apps/web/.env` (AI routes return 503 until then).
- [ ] Apply migrations `0000` and `0001` to the live Supabase DB; fix `DATABASE_URL` (Session pooler for dev, Transaction pooler on Vercel); rotate DB password.
- [ ] Sign in with Apple (App Store requires it if other social logins are offered).
- [ ] `apps/web` lint broken (typescript-eslint does not support TS 7.0).
- [ ] Zone-percentage labels in `activity.tsx` are placeholders until zones are final.

---

## Part B — Formulas / decisions required from the owner

For each: what I need, what the docs say now, what the code does now.

### B1. Max heart rate
- Needed: one formula for HRmax.
- Docs (TRD §3.1): `208 - 0.7 * age`. Code: `220 - age`.
- Also decide: source of age (profile birthdate: chronological vs biological), and whether a user-entered/measured HRmax overrides it.

### B2. Resting heart rate
- Needed: how HRrest is derived.
- Docs: overnight 7-day average. Code: hard-coded default 52 (and default age 28).
- Decide: window length, overnight definition, fallback when no data.

### B3. HR zones
- Needed: exact boundaries and method.
- Docs disagree: PRD 50-60/60-70/70-80/80-90/90-100 % HRR; TRD 50-59/60-69/...; UI doc fixed bpm (>170, 152-170, 133-151, 114-132, <114).
- Code: Karvonen %HRR, lower bound inclusive, 50/60/70/80/90.
- Decide: %HRR vs %HRmax vs fixed bpm; inclusive/exclusive edges; what happens below Zone 1 (<50%, currently dropped); whether Zone 5 has an upper cap.
- Sample timing: code assumes 5 s per sample. Needed: use real timestamp deltas, and a max gap cut-off (e.g. ignore gaps > N s)?

### B4. Day strain (0-21)
- Needed: one model.
- Docs (TECHNICAL_DESIGN §1.1): per sample `r = max(0,(HR-HRrest)/(HRmax-HRrest))`, load `exp(k*r)*dt`, k=4.0, summed over the day, `Strain = 21*(1-exp(-L/C))`, C=1200.
- Code: per-workout, fixed zone weights `0.02/0.05/0.12/0.28/0.65` per minute, `21*(1-exp(-0.045*W))`.
- Decide: continuous vs zone-weighted; k and C (or weights); whole-day vs per-workout; whether Strain is stored per workout, per day, or both; calibration check (e.g. 45 min in Zone 3 should give about what strain?). The two models give about 11.1 vs 4.5 for that case.

### B5. Readiness / recovery (0-100%)
- Needed: full formula; no code exists.
- Docs (§1.2): z-scores of overnight HRV and RHR against a rolling 14-day EMA mean/sigma; `R = 0.50*Zhrv - 0.30*Zrhr + 0.20*((SleepPerf-0.85)/0.15)`; `Readiness = clamp(50 + 25*R, 0, 100)`.
- Decide: confirm weights, the 50/25 scaling, 14-day window and EMA vs simple mean; minimum days of history before showing a score and the cold-start behavior; which HRV metric (RMSSD vs SDNN; Apple gives SDNN, TRD lists both); handling of sigma = 0.
- Tiers: Green >= 67, Yellow 34-66, Red < 34 (confirm).

### B6. Sleep need, performance, efficiency, score
- Needed: full definitions; no code exists.
- Docs (§1.3): `Need = 8.0 + 0.08*PrevDayStrain + 0.33*SleepDebt`; `Perf = min(1, TimeAsleep/Need)`; `Restorative = (Deep+REM)/TimeAsleep`; `Score = 100*(0.50*Perf + 0.30*Efficiency + 0.20*Restorative/0.45)`.
- Undefined in docs: **Sleep Debt** (window? decay? cap?), **Sleep Efficiency** (TimeAsleep / TimeInBed?), which "Previous Day Strain", whether naps count, whether the score can exceed 100 (Restorative/0.45 > 1 case), baseline 8.0 h personal vs fixed.
- Also: do awake periods count in time in bed; what counts as a disturbance.

### B7. Biological body age
- Needed: one model.
- Docs (§1.4): `BodyAge = Achron + dRHR + dHRV + dSleep + dActivity`, clamp +/-15 y.
  - `dRHR = 0.15*(RHRbaseline - DemographicNorm)`
  - `dHRV = -0.08*(HRVbaseline - DemographicNorm)`
  - `dSleep = -2.5*(RestorativeRatio - 0.40)`
  - `dActivity` = undefined.
- Code: `dRHR = 0.15*(rhr-65)`, `dHRV = -0.12*(hrv-45)`, `dSleep = -0.08*(sleepPerf%-75)`, `dActivity = -1.2` if weekly strain in 12-16 else 0; no clamp.
- Decide: coefficients; **demographic norm tables** (by age and sex; or fixed 65 bpm / 45 ms?) and their source; baseline window for RHR/HRV; definition of dActivity (inputs, weights); sleep term input (restorative ratio vs sleep performance %); clamp; whether sex is needed (is it collected at onboarding?).
- Also: how "baseline" differs from today's reading; update cadence (daily?).
- Code's `rejuvenationPace` string ("Aging 18% Slower than Baseline") is hard-coded. Needed: a real definition (e.g. slope of body-age delta over the last N weeks), or drop it.

### B8. Trajectory (12-week)
- Needed: aggregation rule. One body-age value per day, per week average, or weekly snapshot; minimum data to draw the curve.

### B9. Workout calories and deduplication
- Dedupe in code matches docs: >= 50% overlap of either workout, priority order fitbit > apple > google. Confirm.
- Needed: what to do on ties of the same source; whether merged workouts should combine HR series; which record's calories win; history cut-off at first login (code filters by `firstLoginDate`).
- Source name: pick `google_health` or `health_connect` (A1).

### B10. Sleep stage inputs
- Needed: which fields we trust per platform (Apple vs Health Connect stage names differ), how "light" is derived, and whether to store per-segment hypnogram rows (new table) for Screen 5.

---

## Suggested order
1. B1-B3 (zones) -> B4 (strain). Everything else reads these.
2. B6 (sleep) -> B5 (readiness; uses sleep performance).
3. B7-B8 (body age + trajectory; uses sleep and strain).
4. Then A1 rewrite, schema changes (A3 data list), health bridges (A2), screens (A3).
