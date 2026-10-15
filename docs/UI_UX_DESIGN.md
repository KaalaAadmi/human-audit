# HumanAudit — UI/UX Design System & Specification

> **Design Philosophy:** Mellow, athletic luxury inspired by Whoop 4.0 and Apple Human Interface Guidelines. Low-contrast, anti-glare dark surfaces with soft pastel bio-accents, 120 FPS spring physics, and fluid haptic feedback.

---

## 1. Color Theory & Design System Tokens

### 1.1 Canvas & Surface Tokens (Zero Harsh Glare)
* **Canvas Background:** `#121316` (Warm Dark Graphite — eliminates stark high-contrast eye strain)
* **Elevated Card Surface:** `#1C1E24` (Smoked Titanium)
* **Secondary Surface / Input Fill:** `#16171B` (Deep Matte Charcoal)
* **Subtle Hairline Borders:** `rgba(255, 255, 255, 0.04)` to `rgba(255, 255, 255, 0.08)`
* **Modal Overlay:** `rgba(10, 10, 12, 0.75)` with `backdrop-filter: blur(24px)`

### 1.2 Typographic Palette (SF Pro / Inter)
* **Primary Headers & Hero Stats:** `#E4E4E7` (Soft Off-White — high legibility without harsh glare)
* **Body Text & Labels:** `#CBD5E1` (Warm Slate)
* **Secondary / Metric Units:** `#84858E` (Mineral Gray)
* **Muted Tertiary / Footnotes:** `#63646C`

### 1.3 Subdued Bio-Accent Palette (Muted Pastels)
| Metric Domain | Accent Color | Hex Code | Purpose & Usage |
| :--- | :--- | :--- | :--- |
| **Readiness / Recovery** | Mellow Sage Emerald | `#6EE7B7` | Readiness dial ($\ge 67\%$), goal completions, weight loss deltas. |
| **Workload / Day Strain** | Warm Honey Amber | `#FBBF24` | Day strain metric (0–21), target strain window, Zone 4 HR. |
| **Sleep & Recovery** | Lavender Mist | `#C084FC` | Deep sleep stages, sleep score, bio-orb primary aurora glow. |
| **Protein Macro** | Soft Rose Quartz | `#FDA4AF` | Daily protein progress bar and meal macro tag. |
| **Carbs Macro** | Muted Sky Mist | `#7DD3FC` | Daily carb progress bar and meal macro tag. |
| **Fats Macro** | Warm Wheat | `#FDE047` | Daily fat progress bar and meal macro tag. |
| **Hydration / Water** | Soft Aqua Glacier | `#67E8F9` | Water reservoir fill, quick-log chips, hydration reminder banner. |
| **High Stress / Warning** | Soft Crimson Coral | `#F87171` | Zone 5 peak HR, low readiness ($<34\%$), elevated body age state. |

---

## 2. Dynamic 3D Luminous Bio-Orb Specification

The **Bio-Orb** (featured on the Home Dashboard and dedicated Body Age screen) is an ambient, breathing sphere inspired by [Thinking Orbs](https://www.thinkingorbs.com/) and Whoop 4.0 physiological visualizers.

```
                    ┌───────────────────────────────────┐
                    │      LUMINOUS BIO-ORB SHADER      │
                    └─────────────────┬─────────────────┘
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            ▼                                                   ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│     YOUTHFUL / OPTIMAL        │   │      ELEVATED / STRESSED      │
│   (Body Age < Actual Age)     │   │    (Body Age > Actual Age)    │
├───────────────────────────────┤   ├───────────────────────────────┤
│ Core:   Lavender (#E9D5FF)    │   │ Core:   Warm Peach (#FED7AA)  │
│ Mantle: Amethyst (#C084FC)    │   │ Mantle: Amber (#FBBF24)       │
│ Corona: Sage Emerald (#34D399)│   │ Corona: Coral Red (#F87171)   │
│ Ambient Specular Glow: 18px   │   │ Ambient Specular Glow: 18px   │
└───────────────────────────────┘   └───────────────────────────────┘
```

### 2.1 Skia Shader Implementation
* **Shader Engine:** `@shopify/react-native-skia` Runtime Effect (GLSL / SkSL fragment shader).
* **Motion:** Subtle sinusoidal breathing expansion ($f = 0.25\text{ Hz}$, scale factor $1.00 \rightarrow 1.05$).
* **Micro-Interaction:** Gyroscope-driven tilt parallax (subtle light shift when device tilts via `expo-sensors`).

---

## 3. Mobile Screen-by-Screen UI/UX Specifications

### Screen 1: Home Dashboard (Central Hub)
* **Visual Hierarchy:**
  1. *Header:* Date (`TODAY • APR 14`), Member Avatar, and Active Ingestion Sync pill.
  2. *Whoop Dual Dials:* Side-by-side cards for **Readiness (88%)** in Sage Emerald and **Day Strain (14.2 / 21)** in Honey Amber.
  3. *Sleep & Bio-Orb Widget:* Mini pulsing bio-orb next to sleep duration and Body Age delta (`24.2 yrs • -3.8`). Tapping opens Screen 5 (Sleep) or Screen 6 (Body Age).
  4. *Today's Nutrition Card:* Consumed vs remaining calories with mini horizontal bars for Protein (142/180g), Carbs (160/220g), and Fats (45/65g). Tapping opens Screen 3.
  5. *Hydration & Scale Weight:* Quick-access water progress (2,250 / 3,000 ml) and auto-synced Hume scale weight (74.8 kg).
* **Navigation:** Custom bottom floating tab bar with spring-animated active tab pill.

### Screen 2: Hydration Hub (Waterlogged)
* **Visuals:** Fluid water reservoir gauge with subtle wave oscillation.
* **Controls:** 3 tactile quick-log preset buttons (`+250ml Glass`, `+500ml Bottle`, `+750ml Shaker`).
* **Haptics:** `Expo.Haptics.impactAsync(Light)` on every log increment.
* **Reminders:** Push notification toggle and interval slider (60m, 90m, 120m).

### Screen 3: Nutrition & Food Diary (Strictly Today Only)
* **Single-Day Constraint:** Explicitly displays only today's entries (Tuesday) to keep focus sharp.
* **Big Goal Card:** Remaining calories hero badge with gram progress bars.
* **Multi-Modal Action Bar:** 4 compact icon pills: `🔍 Search`, `📷 Barcode`, `🎙️ Voice`, `✨ Photo AI`.
* **Meal Groupings:** Breakfast, Lunch (Custom Recipe badge), Dinner, Snacks with swipe-to-delete gesture.

### Screen 4: Workout Analysis & HR Zones (Zones 1–5)
* **Workout Header:** Sport type, active burn, duration, and data source badge (`Fitbit Synced`).
* **HR Zone Visualizer:** Multi-colored stacked progress bar and granular row breakdown:
  * Zone 5 (Peak $>170$ bpm): Coral Rose (`#FDA4AF`)
  * Zone 4 (Threshold $152-170$ bpm): Warm Wheat (`#FDE047`)
  * Zone 3 (Aerobic $133-151$ bpm): Sage Emerald (`#6EE7B7`)
  * Zone 2 (Easy $114-132$ bpm): Sky Mist (`#7DD3FC`)
  * Zone 1 (Warmup $<114$ bpm): Mineral Gray (`#84858E`)

### Screen 5: Deep-Dive Sleep Analysis
* **Hero Score:** Sleep Performance % vs calculated Sleep Need.
* **Hypnogram:** Visual timeline displaying Deep, REM, Light, and Awake segments.
* **Biometric Trio:** 3 compact tiles for HRV (64 ms), Resting HR (51 bpm), and Respiratory Rate (14.2 rpm).

### Screen 6: Dedicated Body Age Screen
* **Hero Element:** Full-size 3D Luminous Bio-Orb pulsing with dynamic physiological color state.
* **Hero Statistic:** Calculated Biological Age (24.2 years) and delta badge (`↓ 3.8 Years Younger than Chronological`).
* **12-Week Trajectory Chart:** Smooth Bezier curve comparing biological rejuvenation trend against the chronological baseline.
* **Factor Ledger:** Individual biometric contribution rows (RHR $-1.8\text{ yrs}$, HRV $-1.2\text{ yrs}$, Sleep $-0.8\text{ yrs}$).

### Screen 7: Settings & Wearable Deduplication
* **Profile Banner:** User name, baseline stats, and "Syncing from [Login Date]".
* **Wearable Priority Selector:** Drag-and-drop ranking list (Default: 1st Fitbit, 2nd Apple HealthKit / Google Health Connect).
* **Smart Scale Connectors:** Status badges for Hume Scale, FITTR, Fitelo, and Garmin.
* **Day-of-Week Macro Customizer:** 7-day tabbed modal configuring custom gram targets per day of the week.

---

## 4. Next.js Web Landing Page UI/UX Specification

```
┌────────────────────────────────────────────────────────────────────────┐
│                        HumanAudit Web Portal                           │
│                 Next.js (App Router) + Tailwind CSS                    │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Hero Section: Sarcastic Tagline + WebGL 3D Bio-Orb + Store Badges   │
│ 2. Feature Showcase: 5 Core Modules in Mellow Dark Theme Frames        │
│ 3. Cost Comparison Calculator: Whoop ($30/mo) + MFP ($20/mo) vs $0/mo  │
│ 4. Interactive Widget Demos: Water Reservoir & Macro Calculator        │
│ 5. Legal & Compliance: /privacy, /terms, /delete-account, /support     │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Hero Section
* **Headline:** **HumanAudit** &mdash; *"Because your biological age is currently judging your life choices."*
* **Interactive 3D Web Canvas:** Three.js / React Three Fiber glowing bio-orb that responds to mouse cursor movement.
* **Call to Action:** Direct App Store (`Download on the App Store`) and Google Play (`Get it on Google Play`) badges.

### 4.2 Interactive Cost Savings Calculator
* Visual interactive comparison table demonstrating how HumanAudit replaces:
  * Whoop Membership ($30 / month)
  * MyFitnessPal Premium ($19.99 / month)
  * Waterlogged Pro ($4.99 / month)
  * **Total Saved:** **~$660 / year**.

### 4.3 Mandatory App Store Compliance Routes
* `/privacy`: Explicit health data privacy disclosure, HealthKit compliance statements, zero third-party data selling policy.
* `/terms`: End User License Agreement (EULA).
* `/delete-account`: Web-based instantaneous user account & health record purge interface (mandatory for Apple App Store guidelines).

---

## 5. Animation, Gestures & Haptics Standards

* **Spring Physics:** All modal sheets and card transitions use React Native Reanimated spring configs:
  ```typescript
  export const SPRING_CONFIG = {
    damping: 18,
    stiffness: 120,
    mass: 0.8,
  };
  ```
* **Haptics Hierarchy:**
  * **Selection / Tap:** `Expo.Haptics.selectionAsync()`
  * **Logging Increment:** `Expo.Haptics.impactAsync(ImpactFeedbackStyle.Light)`
  * **Goal Completion:** `Expo.Haptics.notificationAsync(NotificationFeedbackType.Success)`
  * **Error / Limit Exceeded:** `Expo.Haptics.notificationAsync(NotificationFeedbackType.Warning)`
