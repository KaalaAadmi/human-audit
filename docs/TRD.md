# HumanAudit — Technical Requirements Document (TRD)

## 1. System Architecture & Tech Stack

```
┌────────────────────────────────────────────────────────────────────────┐
│                        HumanAudit Mobile Client                        │
│                   Expo React Native (iOS & Android)                    │
├────────────────────────────────────────────────────────────────────────┤
│ Auth Client: Supabase Auth / Clerk Expo SDK                            │
│ UI & Design: React Native Reanimated 3 + Skia (Bio-Orb & Trajectory)   │
│ Navigation:  Expo Router v3 (File-based routing & Deep linking)        │
│ Local State: Zustand / TanStack React Query                            │
│ Local DB:    Expo SQLite (Offline-First cache & local logs)            │
│ Health Sync: HealthKit Config Plugin (iOS) & Health Connect (Android)  │
│ Hardware:    Expo Camera (Barcode), Expo AV (Voice), Expo Haptics      │
└───────────────────▲────────────────────────────────▲───────────────────┘
                    │                                │
                    ▼                                ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│  Next.js Web & Backend API Gateway   │  │    External API Gateways     │
├──────────────────────────────────────┤  ├──────────────────────────────┤
│ Landing Page: Pricing, Store Badges  │  │ USDA FoodData Central (FDC)  │
│ Legal Routes: /privacy, /terms       │  │ Open Food Facts (OFF)        │
│ Route Handlers: /api/ai/vision, scale│  │ OpenAI Vision / Gemini Flash │
│ Database: PostgreSQL via Drizzle ORM │  │ Smart Scale Webhooks (Hume)  │
│ Host: Vercel (Free) -> Self-Hosted VM│  │ Deep Linking (.well-known)   │
└──────────────────────────────────────┘  └──────────────────────────────┘
```

### 1.1 Next.js Web App & Backend Responsibilities
1. **Public Marketing & Landing Page:**
   * High-performance responsive landing page highlighting all-in-one features, Whoop & MFP subscription savings, and download buttons for Apple App Store & Google Play Store.
2. **App Store Compliance & Legal Pages:**
   * Mandatory endpoints: `/privacy`, `/terms`, `/delete-account`, and support portal.
   * Universal Links & Deep Linking metadata (`/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`).
3. **Secure Backend API Gateways (`app/api/*`):**
   * `/api/ai/photo-meal`: Proxies meal photo scans to multimodal vision LLMs without exposing API keys in mobile binaries.
   * `/api/ai/voice-parse`: Transcribes audio and extracts structured macro JSON.
   * `/api/webhooks/scale`: Ingests automated weight callbacks from Hume, FITTR, and Fitelo.
4. **Database & Infrastructure Hosting:**
   * **Phase 1 (MVP):** Next.js hosted on **Vercel (Free Tier)** + PostgreSQL on **Supabase (Free Tier)**.
   * **Phase 2 (Scale):** Next.js Docker container + PostgreSQL hosted on **Oracle Cloud Free VM** or low-cost VPS ($4.50/mo Hetzner).

---

## 2. Health Ingestion & Deduplication Pipeline

### 2.1 Native Health Bridges
* **iOS:** Apple HealthKit via `react-native-health` (Expo Config Plugin).
  * Permissions: Steps, Workouts, Heart Rate Samples, Resting Heart Rate, HRV (SDNN / rMSSD), Sleep Analysis, Active Energy Burned, Body Mass.
* **Android:** Google Health Connect via `react-native-health-connect`.
  * Permissions: Steps, Exercise Session, Heart Rate Record, Resting Heart Rate, Sleep Session, Total Calories Burned, Weight Record.

### 2.2 Ingestion Baseline Window
* On onboarding / first login:
  $$\text{sync\_start\_timestamp} = \text{Date.now()}$$
* All historical queries to HealthKit / Health Connect filter strictly by:
  $$\text{startDate} \ge \text{sync\_start\_timestamp}$$

### 2.3 Smart Deduplication Engine
1. **Source Hierarchy:** Default priority: `Fitbit (1st)` $\rightarrow$ `Apple HealthKit / Google Health Connect (2nd)`. User configurable in settings.
2. **Time-Window Conflict Detection:**
   * Overlapping workout sessions $\ge 50\%$ duration overlap mark the lower-priority source as `deduped_ignored`.
3. **Step Epochs:** Steps partitioned into 15-minute epochs; only the highest priority active source is counted per epoch.

---

## 3. Heart Rate Zone Engine (Google Health Gap Resolution)

### 3.1 Raw Sample Stream & Karvonen HRR Formulas
* Max Heart Rate: $HR_{\text{max}} = 208 - (0.7 \times \text{Age})$
* Resting Heart Rate: $HR_{\text{rest}}$ (from overnight 7-day average)
* **Zones:**
  * Zone 1 (Warmup): $50\% - 59\%$ HRR
  * Zone 2 (Easy Aerobic): $60\% - 69\%$ HRR
  * Zone 3 (Aerobic Threshold): $70\% - 79\%$ HRR
  * Zone 4 (Anaerobic / Threshold): $80\% - 89\%$ HRR
  * Zone 5 (Peak / VO2 Max): $90\% - 100\%$ HRR
* **Accumulator:** Time $\Delta t$ spent in each zone is aggregated from raw timestamped HR samples.

---

## 4. Multi-Modal Nutrition Engine
* **Branded & Barcodes:** Open Food Facts REST API v2.
* **Generic Whole Foods:** USDA FoodData Central API.
* **Meal Photo AI:** Edge Function with Vision LLM (GPT-4o-mini / Gemini Flash) extracting structured nutrition JSON.
* **Voice Logging:** Expo Audio recorder + Whisper transcription + NLP parser.
