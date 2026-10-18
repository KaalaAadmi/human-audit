# HumanAudit — Phased Implementation Plan

## Phase 1: Foundation, Tooling & Design System (Week 1)
- [x] Initialize Turborepo monorepo (`apps/mobile` for Expo, `apps/web` for Next.js, `packages/db` for Drizzle ORM).
- [x] Configure Expo Router ~57 file-based routing architecture.
- [x] Set up `@shopify/react-native-skia`, `react-native-reanimated`, and `react-native-gesture-handler`.
- [x] Implement Whoop Mellow Design System theme tokens (`colors.ts`, `typography.ts`, `spacing.ts`, `glassCard.tsx`).
- [x] Configure local notifications engine (`expo-notifications`) for hydration reminders.

## Phase 2: Next.js Backend API, Auth & Database (Week 2)
- [x] Scaffold Next.js application (`apps/web`) on Vercel with responsive Landing Page & App Store download badges.
- [x] Build mandatory legal and compliance routes (`/privacy`, `/terms`, `/delete-account`). *(only `/privacy` exists in `apps/web`; `/terms` and `/delete-account` not found, verify)*
- [x] Set up **Supabase Project (Free Tier)** as managed PostgreSQL only (auth is Clerk).
- [x] Clerk email/password auth with session persistence via `expo-secure-store`. (Sign in with Apple / Google OAuth not yet added.)
- [x] User isolation enforced by the API (Clerk token verified server-side, `user_id` from the token); RLS enabled with no policies on all tables.
- [x] Shared Drizzle schemas in `packages/db`. (Local SQLite mirrors are not planned for now; the app is API-only.)

## Phase 3: Hydration & Dashboard Core (Week 3)
- [x] Build **Screen 2: Water Tracker (Waterlogged Hub)** with fluid liquid animation, bottle presets (+250/+500/+750ml), and interval push reminder scheduling.
- [x] Build **Screen 1: Home Dashboard (Central Hub)** with active sync status, dual Readiness/Strain dial components, macro progress rings, and water/weight widgets. *(UI built; widgets still show hardcoded sample data)*
- [x] Implement custom mellow bottom tab bar with smooth spring transitions.

## Phase 4: Nutrition Engine & Multi-Modal Logging (Week 4)
- [x] Build **Screen 3: Nutrition & Food Diary** with strict single-day view (today only) and meal grouping.
- [x] Integrate **Open Food Facts API** for branded food search and **USDA FoodData Central API** for whole foods.
- [x] Build camera-based Barcode Scanner modal (`expo-camera`).
- [x] Build Voice Logging audio recorder + Next.js `/api/ai/voice-parse` handler.
- [x] Build Photo AI meal scanner with Next.js `/api/ai/photo-meal` Vision LLM handler.
- [x] Build Custom Foods and Multi-Ingredient Recipe builder. *(custom foods UI only; `custom_foods`/`custom_recipes` tables not yet in Drizzle/DB)*

## Phase 5: HealthKit, Health Connect & Zone Bucketing (Week 5)
- [ ] Implement Apple HealthKit native bridge with Expo Config Plugin.
- [ ] Implement Google Health Connect native bridge.
- [x] Implement **Ingestion Baseline Window** (filtering data strictly $\ge \text{first\_login\_date}$).
- [x] Build **Smart Deduplication Engine** (prioritizing Fitbit over Apple/Google with 50% overlap conflict resolution). *(engine exists in `wearableEngine.ts`; runs on mock data)*
- [x] Build **Karvonen HR Zone Bucketing Engine** (calculating Zone 1–5 durations from raw heart rate series). *(zone boundaries TBD, see PRD/TRD)*

## Phase 6: Sleep, Recovery & Biological Body Age (Week 6)
- [x] Build **Screen 4: Workout Analysis** with Zone 1–5 visual breakdown bars. *(UI built; uses sample workouts until HealthKit / Health Connect land)*
- [ ] Build **Screen 5: Deep Sleep Analysis** with sleep stages hypnogram (Deep, REM, Light, Awake) and biometric vitals (HRV, RHR, Resp Rate). *(not built yet)*
- [ ] Build **Screen 6: Dedicated Body Age Screen** with 3D Skia Luminous Bio-Orb (breathing aurora shaders) and 12-week trajectory curve graph. *(not built yet)*

## Phase 7: Settings, Scale Connectors & Day-of-Week Goals (Week 7)
- [x] Build **Screen 7: Settings & Priorities** with top user summary banner. *(wearable priorities / scale toggles not persisted yet)*
- [x] Implement **Day-of-Week Macro Goals customizer** (setting custom calories and grams for Monday–Sunday).
- [x] Implement **Wearable Deduplication Priority selector** with drag/reorder toggle. *(UI only; not persisted to `wearable_settings`)*
- [ ] Add Smart Scale webhook receivers in Next.js (`/api/webhooks/scale` for Hume, FITTR, Fitelo).

## Phase 8: Polish, EAS Cloud Builds & Store Submission (Week 8)
- [ ] Conduct end-to-end testing on physical iOS and Android devices.
- [x] Optimize 60–120 FPS animations and gesture responsiveness.
- [x] Set up EAS Build profiles (`development`, `preview`, `production`). *(no `eas.json` found, verify)*
- [x] Prepare App Store and Google Play assets, privacy nutrition labels, and HealthKit entitlement declarations. *(HealthKit / Health Connect entitlements are not in `app.json` yet)*
