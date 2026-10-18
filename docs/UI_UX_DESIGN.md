# HumanAudit — UI/UX Design System & Specification (Instrument-Grade)

> **Design Philosophy:** Handcrafted athletic telemetry inspired by precision sports hardware (Whoop 4.0, Teenage Engineering, Apple HIG). Anti-glare matte carbon chassis (`#0C0D10`), machined smoked titanium surfaces (`#14151B`), fixed-width tabular monospace numbers (`tabular-nums`), and organic biological lighting with zero AI slop.

---

## 1. Color Theory & Design System Tokens

### 1.1 Canvas & Chassis Tokens (Physical & Tactile)
* **Chassis Background:** `#0C0D10` (Deep Matte Carbon — absorbs glare, eye-soothing during night logging)
* **Machined Card Surface:** `#14151B` (Smoked Titanium)
* **Recessed Telemetry Fill:** `#0F1015` (Inset Sub-Panel)
* **Specular Top Highlight:** `inset 0 1px 0 rgba(255, 255, 255, 0.05)` (Provides physical machined depth)
* **Subtle Hairline Borders:** `1px solid rgba(255, 255, 255, 0.05)`

### 1.2 Typographic Hierarchy & Tabular Telemetry
* **Hero Numbers & Primary Headers:** `#F4F4F5` (Crisp Off-White, tight tracking `-0.8px` to `-1.5px`)
* **Tabular Monospace Metrics:** Monospace figures (`font-variant-numeric: tabular-nums`) for all real-time biometrics (HRV, RHR, Strain, Calories, HR Zones) so numbers never jitter.
* **Micro-Labels & Status Tags:** `#71717A` (Wide tracking `+1.0px` to `+1.2px`, uppercase, `font-size: 9px` to `10px`).
* **Secondary Slate:** `#A1A1AA`

### 1.3 Calibrated Bio-Accent Palette
| Metric Domain | Accent Color | Hex Code | Purpose & Hardware Telemetry |
| :--- | :--- | :--- | :--- |
| **Readiness / Recovery** | Mellow Sage Emerald | `#34D399` / `#6EE7B7` | Readiness status dial ($\ge 67\%$), goal completion, trajectory delta. |
| **Workload / Day Strain** | Warm Honey Amber | `#FBBF24` | Cumulative day strain (0.0–21.0), optimal strain target window. |
| **Sleep & Bio-Orb Core** | Lavender Mist | `#C084FC` | Restorative deep sleep, sleep efficiency %, bio-orb primary mantle. |
| **Protein (PRO)** | Soft Rose Quartz | `#FDA4AF` | Daily protein target bar and meal log badge. |
| **Carbs (CHO)** | Muted Sky Mist | `#7DD3FC` | Daily carbohydrate target bar and meal log badge. |
| **Fats (FAT)** | Warm Wheat | `#FDE047` | Daily lipid target bar and meal log badge. |
| **Hydration** | Soft Aqua Glacier | `#67E8F9` | Segmented liquid calibration gauge and quick log chips. |
| **Peak Exertion / Warning** | Crimson Coral | `#F87171` | Zone 5 HR ($>170\text{ bpm}$), low readiness ($<34\%$), elevated body age. |

---

## 2. Dynamic 3D Luminous Bio-Orb Specification

The **Bio-Orb** is an organic physiological indicator inspired by [Thinking Orbs](https://www.thinkingorbs.com/) that breathes in real time.

```
                    ┌───────────────────────────────────┐
                    │      MULTI-LAYERED BIO-ORB        │
                    └─────────────────┬─────────────────┘
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            ▼                                                   ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│     YOUTHFUL / OPTIMAL        │   │      ELEVATED / STRESSED      │
│   (Body Age < Actual Age)     │   │    (Body Age > Actual Age)    │
├───────────────────────────────┤   ├───────────────────────────────┤
│ Core:   Orchid Mist (#F5D0FE) │   │ Core:   Warm Peach (#FED7AA)  │
│ Mantle: Amethyst (#C084FC)    │   │ Mantle: Amber (#FBBF24)       │
│ Corona: Sage Emerald (#34D399)│   │ Corona: Crimson Coral (#F87171│
│ Inset Specular: 0.6 Opacity   │   │ Inset Specular: 0.6 Opacity   │
│ Ambient Glow: 24px Blur       │   │ Ambient Glow: 24px Blur       │
└───────────────────────────────┘   └───────────────────────────────┘
```

* **Shader Implementation:** `@shopify/react-native-skia` Runtime Effect rendering radial depth, ambient corona luminescence, and micro-scale breathing oscillations ($0.25\text{ Hz}$).

---

## 3. Mobile Screen-by-Screen UI Specifications

### Screen 1: Home Telemetry Hub (Central Hub)
* **Header:** Micro uppercase date tag (`TUESDAY • APR 14`), `Daily Audit` title, and avatar telemetry pill.
* **Dual Vitals Instruments:** Side-by-side machined tiles for **Readiness (88%)** with live status beacon and **Day Strain (14.2 / 21)** with target window.
* **Bio-Orb Summary Widget:** Multi-layered 3D mini orb displaying Sleep duration (7h 42m) and Biological Age delta (`24.2 yrs • -3.8`).
* **Tabular Nutrition Card:** Remaining calories badge and 3-column mono breakdown for `PRO`, `CHO`, and `FAT`.
* **Hydration & Scale Weight:** 2-column telemetry blocks for calibrated water volume and auto-synced Hume scale weight.
* **Minimalist Bottom Bar:** Monospace 5-item navigation (`Audit`, `Water`, `Diary`, `Vitals`, `System`).

### Screen 2: Hydration Hub (Waterlogged)
* **Volume Dial:** Massive tabular numeric display (`2,250 ML / 3,000 ML`).
* **Segmented Calibration Gauge:** 4-segment physical fill track.
* **Tactile Log Chips:** Precision quick-add buttons (`+250 ML Glass`, `+500 ML Bottle`, `+750 ML Shaker`).
* **Scheduled Interval Trigger:** Status indicator displaying active 90-minute reminder window.

### Screen 3: Single-Day Nutrition Diary (Strictly Today Only)
* **Single-Day Focus:** Explicit `TODAY ONLY` constraint with remaining calorie budget.
* **3-Column Macro Grid:** Tabular gram weights and target goals with color-coded bottom borders.
* **Multi-Modal Toolbar:** 4 compact input buttons: `🔍 Search`, `📷 Barcode`, `🎙️ Voice`, `✨ Photo`.
* **Meal Logs:** Breakfast, Lunch (Custom Recipe badge), Dinner, and Snacks.

### Screen 4: Workout Analysis & HR Reserve Zones
* **Telemetry Header:** Sport type, active burn, duration, and source badge (`FITBIT`).
* **Karvonen Zone Telemetry:** Inset monospace rows displaying exact durations and percentage of total workout:
  * Zone 5 (Peak $>170$ bpm): `05:12 (11%)` in `#FDA4AF`
  * Zone 4 (Threshold $152-170$ bpm): `09:14 (20%)` in `#FDE047`
  * Zone 3 (Aerobic $133-151$ bpm): `16:40 (35%)` in `#34D399`
  * Zone 2 (Easy $114-132$ bpm): `11:05 (24%)` in `#7DD3FC`
  * Zone 1 (Warmup $<114$ bpm): `04:10 (10%)` in `#71717A`

### Screen 5: Deep-Dive Sleep Hypnogram
* **Recovery Telemetry:** Performance % vs calculated Sleep Need, and 91% Efficiency index.
* **Segmented Hypnogram:** Multi-colored timeline for Deep, REM, Light, and Awake segments.
* **Biometric Trio:** Compact inset tiles for HRV (64 ms), Resting HR (51 bpm), and Respiratory Rate (14.2 rpm).

### Screen 6: Dedicated Biological Body Age Screen
* **Hero Element:** Full-size 3D Luminous Bio-Orb with breathing radial corona.
* **Hero Statistic:** Calculated Biological Age (24.2 YRS) with delta badge (`↓ 3.8 Years Younger than Actual`).
* **12-Week Trajectory Curve:** Smooth Bezier chart comparing biological rejuvenation trend against the chronological baseline.

### Screen 7: System Preferences & Priorities
* **Profile Tile:** User baseline stats and active sync date.
* **Wearable Ingestion Priority:** Drag-and-drop hierarchy (Default: 1st Fitbit, 2nd Apple Health / Google Connect).
* **Security & Biometric Lock Toggle:** Switch to enable/disable Face ID / Touch ID authentication when opening or resuming the app.
* **Hardware Connectors:** Hume Scale, FITTR, Fitelo, and Day-of-Week macro config.

---

## 4. Authentication, Onboarding & Biometric Privacy System

### 4.1 Launch & Authentication Portal
* **Splash Screen (`app/index.tsx` or Root):** Deep matte carbon canvas with glowing glacier aqua pulse icon (`#67E8F9`) and `HUMANAUDIT // BIOMETRIC OS` typography.
* **Athlete Sign In (`app/auth/login.tsx`):**
  * Smoked titanium card with email format validation and password visibility toggle.
  * Primary action: `Sign In & Sync Vault` in glacier aqua (`#67E8F9`).
  * Links: `Create Athlete ID →` and `Forgot Password`.
  * Persists verified session into `expo-secure-store` and attaches queries to authenticated `auth.uid()`.
* **Athlete Registration (`app/auth/register.tsx`):**
  * Fields: Athlete Name/Handle, Email, Secure Password.
  * Primary action: `Register & Continue →` in sage emerald (`#34D399`).
  * Automatically provisions initial row in `user_profiles` with `id: auth.user.id` (valid UUID) and flags `onboarding_completed: false`.

### 4.2 First-Time Biometric Baseline Onboarding (`app/onboarding.tsx`)
> **First-Time Gating Rule:** Displayed strictly once upon initial registration. Returning athletes and existing sessions bypass onboarding straight to the main app dashboard.

* **Step 1: Biological Profile**
  * Inputs: Birth Year (chronological age calculation), Height (cm), Weight (kg).
  * *Sensor Ingestion Notice:* Resting Heart Rate is strictly auto-ingested from Apple Watch / Fitbit sensors to eliminate manual drift.
* **Step 2: Wearables & Native Health Connectors**
  * Connectors for Apple HealthKit (`HealthKit`) and Google Health Connect (`Health Connect`).
  * *Smart Deduplication Notice:* Workouts with $\ge 50\%$ time overlap are resolved in favor of the highest-ranked wearable device.
* **Step 3: Daily Hydration Targets & Reminders**
  * Target Selector: Preset chips (`2.5L`, `3.0L`, `3.5L`, `+ Custom`).
  * *Dynamic Custom Input:* If a preset chip is selected, the custom field remains hidden; tapping `+ Custom` reveals the numeric milliliter input.
  * Interval Push Reminders: Toggleable 90-minute reminder window (8:00 AM – 10:00 PM).
  * Milestone reward: Confetti particle explosion overlay when hitting 100% of daily hydration.

### 4.3 Biometric Vault Lock & Background Privacy Shield
* **First-Login Biometric Opt-In Prompt:** A one-time modal appears immediately after initial login/onboarding completion: *"Enable Face ID / Biometric Lock for Quick Access?"*. Users can accept or defer to Settings.
* **App Switcher Privacy Shield:** When the app is minimized or backgrounded, an opaque privacy shield (`🛡️ Privacy Shield Active`) masks all physiological numbers and records from being exposed in the iOS App Switcher / Android Recents.
* **Biometric Resume Lock:** On resuming the app, `expo-local-authentication` prompts for Face ID, Touch ID, or device passcode to unlock the vault and lift the shield.

---

## 5. Next.js Web Landing Page UI/UX Specification

* **Chassis & Depth:** Built with the same `#0C0D10` carbon background and `#14151B` smoked titanium cards.
* **Hero Section:** Live interactive 3D bio-orb, sarcastic tagline *"Because your biological age is currently judging your life choices."*, and official App Store / Google Play download badges.
* **Annual Subscription Savings Calculator:** Interactive breakdown showing $660/year saved by replacing Whoop ($360/yr), MyFitnessPal Premium ($240/yr), and Waterlogged ($60/yr).
* **Legal & Store Compliance:** Fast, cleanly formatted `/privacy`, `/terms`, and `/delete-account` pages.
