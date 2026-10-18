# HumanAudit — Product Requirements Document (PRD)

> **App Name:** HumanAudit  
> **Tagline:** *"Because your biological age is currently judging your life choices."*  
> **Target Platforms:** iOS & Android (Expo React Native)  
> **Target Audience:** Fitness enthusiasts, macro counters, and athletes who want Whoop-grade recovery analytics, MyFitnessPal Premium nutrition tracking, and Waterlogged hydration without paying multiple recurring subscriptions.

---

## 1. Executive Summary & Vision
**HumanAudit** is an all-in-one health, fitness, and recovery operating system that eliminates fragmented $30+/month subscriptions. It unifies:
1. **Hydration Hub:** Goal setting, quick-logging presets, and customizable interval push reminders.
2. **MyFitnessPal Premium Alternative:** Single-day macro/calorie tracking, day-of-week custom calorie & gram goals, multi-modal logging (text, barcode scan via Open Food Facts, USDA FoodData Central generic foods, voice, and photo AI), and custom recipe creation.
3. **Whoop-Grade Recovery & Sleep Analysis:** Daily Readiness score (%), Day Workload/Strain dial (0–21), Sleep Stages breakdown (Deep, REM, Light, Awake), Sleep Need vs Performance, and calculated **Biological Body Age** with a dynamic 3D-style glowing bio-orb and historical trajectory tracking.
4. **Workout Heart Rate Zones (Zones 1–5):** Solves the Google Health Connect gap by streaming raw heart rate time-series and bucketing duration into Zones 1 through 5 using Heart Rate Reserve (HRR) formulas.
5. **Smart Wearable Deduplication & Smart Scale Connectors:** Auto-syncs weights from Hume, FITTR, and Fitelo scales. Deduplicates overlapping workouts and steps (defaulting to Fitbit priority over Apple HealthKit / Google Health Connect, with user override).
6. **Clean Historical Baseline:** Stores health data starting strictly from the day the user signs in and grants health permissions.

---

## 2. Core Functional Requirements

### 2.1 Screen 1: Home Dashboard (Central Hub)
* **Header:** Current date, greeting, active sync badge, and profile avatar.
* **Dual Readiness & Strain Metric:**
  * **Daily Readiness (%):** Normalized $0\% - 100\%$ score with Red/Yellow/Green tier, overnight HRV, and Resting Heart Rate (RHR).
  * **Day Workload / Strain (0.0 – 21.0):** Cumulative cardiovascular load with target strain recommendations based on readiness.
* **Sleep & Biological Body Age Summary:**
  * Sleep duration vs need, Sleep efficiency %, and current Body Age delta (e.g. 24.2 yrs vs 28 yrs chronological).
  * Tapping navigates to Screen 5 (Deep Sleep) or Screen 6 (Body Age).
* **Today's Nutrition Summary:**
  * Remaining calories for today, consumed vs target Protein, Carbs, and Fats in grams.
  * Tapping navigates to Screen 3 (Food Diary).
* **Hydration Snapshot:**
  * Milliliters logged vs daily goal, time until next reminder.
  * Tapping navigates to Screen 2 (Waterlogged Hub).
* **Smart Scale Weight Card:**
  * Auto-synced weight from Hume / FITTR / Fitelo scales with weekly delta indicator.
* **Bottom Tab Bar:** 5-Tab navigation (Home, Water, Diary, Activity, Settings).

### 2.2 Screen 2: Hydration Hub (Waterlogged)
* **Liquid Reservoir Gauge:** Animated visual progress of daily water intake.
* **Quick Log Presets:** Tappable quick-add chips (+250ml Glass, +500ml Bottle, +750ml Shaker, or custom input).
* **Smart Push Reminders:** Periodic notifications configurable by interval (e.g., every 60, 90, or 120 minutes) active between wake and sleep hours.
* **Streak & Hydration History:** Daily completion tracking.

### 2.3 Screen 3: Nutrition & Food Diary (Strictly Today Only)
* **Single-Day Focus:** Displays exclusively the current day's meals and macro progress (no clutter from past or future days).
* **Macro Targets in Grams:** Real-time progress bars for Protein, Carbohydrates, and Fats.
* **Multi-Modal Ingestion Toolbar:**
  1. *Text Search:* Real-time queries to USDA FoodData Central (generic foods) and Open Food Facts (branded foods).
  2. *Barcode Scanner:* Camera-based EAN/UPC scanner resolving against Open Food Facts.
  3. *Voice Logging:* Speech-to-text with NLP extraction of items, quantities, and units.
  4. *Meal Photo AI:* Multimodal vision analysis estimating ingredients, weights, calories, and macros.
* **Meal Categories:** Breakfast, Lunch, Dinner, Snacks.
* **Custom Foods & Recipe Builder:** Ability to save custom foods, combine ingredients into multi-serving recipes, and log single servings.

### 2.4 Screen 4: Activity & Workout HR Zones
* **Workout Summary:** Workout type, start time, duration, active calories burned, average HR, and max HR.
* **Zone 1–5 Heart Rate Breakdown:** *(Zone boundaries are TBD: the owner will define them. The percentages below are placeholders.)*
  * Zone 1 (Warmup: $50-60\%$ HRR)
  * Zone 2 (Easy Aerobic: $60-70\%$ HRR)
  * Zone 3 (Aerobic Threshold: $70-80\%$ HRR)
  * Zone 4 (Anaerobic / Threshold: $80-90\%$ HRR)
  * Zone 5 (Peak / VO2 Max: $90-100\%$ HRR)
  * Duration in minutes/seconds and percentage of total workout per zone.
* **Source Badge:** Displays the active source (e.g., "Fitbit Synced" or "HealthKit Synced").

### 2.5 Screen 5: Deep-Dive Sleep Analysis
* **Sleep Performance:** Sleep time vs calculated Sleep Need ($8\text{h baseline} + \text{strain adjustment} + \text{sleep debt}$).
* **Sleep Stage Timeline:** Visual hypnogram and duration/percentage for Deep (Restorative), REM (Cognitive), Light, and Awake time.
* **Sleep Quality Index:** Sleep efficiency %, disturbance count, respiratory rate, and resting heart rate dip.

### 2.6 Screen 6: Dedicated Biological Body Age Screen
* **3D Luminous Bio-Orb (Thinking-Orbs Style):**
  * Dynamic glowing sphere reflecting physiological vitality.
  * *Youthful / Optimal (Body Age < Actual Age):* Aurora Violet (`#C084FC`) and Emerald Sage (`#6EE7B7`).
  * *Elevated / Stressed (Body Age > Actual Age):* Amber Gold (`#FBBF24`) and Flame Coral (`#FDA4AF`).
* **Biological Age Metric:** Hero number displaying calculated age vs chronological age.
* **Historical Trajectory Graph:** 12-week trend line plotting Biological Age curve against the flat Chronological Age baseline.
* **Contributing Factor Ledger:** Granular breakdown of years added or subtracted by RHR, HRV, Restorative Sleep %, and Activity Volume.

### 2.7 Screen 7: Profile, Settings & Deduplication Rules
* **User Health Summary:** Avatar, height, baseline weight, chronological age, and "Tracking since [Login Date]".
* **Day-of-Week Macro Customizer:** Independent calorie and gram targets for Monday through Sunday (e.g. Leg Day carb surplus, Weekend flexibility).
* **Wearable Source Priority (Deduplication Engine):**
  * Default: **1st Priority = Fitbit**, **2nd Priority = Apple HealthKit / Google Health Connect**.
  * User toggle allowing manual reordering of source priorities.
* **Smart Scale Integrations:** Connectors for Hume Scale, FITTR, Fitelo, and Phase 2 Garmin Connect.
* **Hydration Reminder Schedule:** Start time, end time, and repeat interval in minutes.

---

## 3. Non-Functional Requirements
* **Visual Aesthetic:** Whoop 4.0 mellow dark theme (`#121316` background, `#1C1E24` smoked titanium cards, low-contrast pastel bio-accents, Apple Human Interface Guidelines).
* **Offline-First (planned, not implemented):** food logs, water entries and cached health metrics would be stored locally in SQLite with opportunistic cloud sync. Currently the app is online-only via the Next.js API.
* **Privacy & Security:** Health data encrypted at rest; no selling of biometric data.
* **Performance:** Screen transitions under 16ms (60–120 FPS via React Native Reanimated); barcode scanner recognition under 200ms.
