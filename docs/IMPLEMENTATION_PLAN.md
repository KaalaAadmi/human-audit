# HumanAudit — Phased Implementation Plan

## Phase 1: Foundation, Tooling & Design System (Week 1)
- [x] Initialize Turborepo monorepo (`apps/mobile` for Expo, `apps/web` for Next.js, `packages/db` for Drizzle ORM).
- [x] Configure Expo Router v3 file-based routing architecture.
- [x] Set up `@shopify/react-native-skia`, `react-native-reanimated`, and `react-native-gesture-handler`.
- [x] Implement Whoop Mellow Design System theme tokens (`colors.ts`, `typography.ts`, `spacing.ts`, `glassCard.tsx`).
- [x] Configure local notifications engine (`expo-notifications`) for hydration reminders.

## Phase 2: Next.js Backend API, Auth & Database (Week 2)
- [ ] Scaffold Next.js application (`apps/web`) on Vercel with responsive Landing Page & App Store download badges.
- [ ] Build mandatory legal and compliance routes (`/privacy`, `/terms`, `/delete-account`).
- [ ] Set up **Supabase Project (Free Tier)** for managed PostgreSQL, Auth, and Storage.
- [ ] Configure native **Sign in with Apple** & **Google OAuth** with secure session persistence via `expo-secure-store`.
- [ ] Apply PostgreSQL Row-Level Security (RLS) policies ensuring 100% user data isolation.
- [ ] Set up shared Drizzle ORM schemas in `packages/db` and local SQLite mirrors in `apps/mobile`.

## Phase 3: Hydration & Dashboard Core (Week 3)
- [ ] Build **Screen 2: Water Tracker (Waterlogged Hub)** with fluid liquid animation, bottle presets (+250/+500/+750ml), and interval push reminder scheduling.
- [ ] Build **Screen 1: Home Dashboard (Central Hub)** with active sync status, dual Readiness/Strain dial components, macro progress rings, and water/weight widgets.
- [ ] Implement custom mellow bottom tab bar with smooth spring transitions.

## Phase 4: Nutrition Engine & Multi-Modal Logging (Week 4)
- [ ] Build **Screen 3: Nutrition & Food Diary** with strict single-day view (today only) and meal grouping.
- [ ] Integrate **Open Food Facts API** for branded food search and **USDA FoodData Central API** for whole foods.
- [ ] Build camera-based Barcode Scanner modal (`expo-camera`).
- [ ] Build Voice Logging audio recorder + Next.js `/api/ai/voice-parse` handler.
- [ ] Build Photo AI meal scanner with Next.js `/api/ai/photo-meal` Vision LLM handler.
- [ ] Build Custom Foods and Multi-Ingredient Recipe builder.

## Phase 5: HealthKit, Health Connect & Zone Bucketing (Week 5)
- [ ] Implement Apple HealthKit native bridge with Expo Config Plugin.
- [ ] Implement Google Health Connect native bridge.
- [ ] Implement **Ingestion Baseline Window** (filtering data strictly $\ge \text{first\_login\_date}$).
- [ ] Build **Smart Deduplication Engine** (prioritizing Fitbit over Apple/Google with 50% overlap conflict resolution).
- [ ] Build **Karvonen HR Zone Bucketing Engine** (calculating Zone 1–5 durations from raw heart rate series).

## Phase 6: Sleep, Recovery & Biological Body Age (Week 6)
- [ ] Build **Screen 4: Workout Analysis** with Zone 1–5 visual breakdown bars.
- [ ] Build **Screen 5: Deep Sleep Analysis** with sleep stages hypnogram (Deep, REM, Light, Awake) and biometric vitals (HRV, RHR, Resp Rate).
- [ ] Build **Screen 6: Dedicated Body Age Screen** with 3D Skia Luminous Bio-Orb (breathing aurora shaders) and 12-week trajectory curve graph.

## Phase 7: Settings, Scale Connectors & Day-of-Week Goals (Week 7)
- [ ] Build **Screen 7: Settings & Priorities** with top user summary banner.
- [ ] Implement **Day-of-Week Macro Goals customizer** (setting custom calories and grams for Monday–Sunday).
- [ ] Implement **Wearable Deduplication Priority selector** with drag/reorder toggle.
- [ ] Add Smart Scale webhook receivers in Next.js (`/api/webhooks/scale` for Hume, FITTR, Fitelo).

## Phase 8: Polish, EAS Cloud Builds & Store Submission (Week 8)
- [ ] Conduct end-to-end testing on physical iOS and Android devices.
- [ ] Optimize 60–120 FPS animations and gesture responsiveness.
- [ ] Set up EAS Build profiles (`development`, `preview`, `production`).
- [ ] Prepare App Store and Google Play assets, privacy nutrition labels, and HealthKit entitlement declarations.
