# HumanAudit — Technical Design Document & Mathematical Specification

## 0. Unified Architecture & Backend API Layer

```
┌─────────────────────────────────┐
│     Expo Mobile App (React Native)│
│       • Clerk Auth (@clerk/expo)│
│       • Biometric Privacy Lock  │
│       • Local Offline Cache     │
└────────────────┬────────────────┘
                 │ HTTPS (Bearer Token)
                 ▼
┌─────────────────────────────────┐
│     Next.js API Engine (apps/web) │
│       • /api/profile (Profiles) │
│       • /api/water (Hydration)  │
│       • /api/foods (Nutrition)  │
│       • /api/workouts (Sensors) │
└────────────────┬────────────────┘
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
┌──────────────┐   ┌───────────────────────┐
│ Supabase DB  │   │ Oracle Cloud Free VM  │
│ (PostgreSQL) │   │ (Zero Mobile Change)  │
└──────────────┘   └───────────────────────┘
```

### 0.1 Backend API Specification
* **Authentication Independence:** Mobile signs in with Clerk; backend APIs authenticate user requests and interface directly with database tables, eliminating client-side RLS permission blocks. The mobile app never talks to the database: it sends `Authorization: Bearer <Clerk session token>` to the Next.js API, which verifies it against Clerk's JWKS (`apps/web/lib/auth.ts`) and takes the user id from the token's `sub`, never from the request body. Supabase is used only as managed Postgres (pooler `DATABASE_URL`), so access control lives in the API; RLS is enabled with no policies as defence in depth against direct REST access.
* **Database Agnosticism:** Database driver (`apps/web/lib/db.ts`) routes between PostgreSQL pool (Oracle Cloud VM via `DATABASE_URL`) and Supabase Admin client (`SUPABASE_SERVICE_ROLE_KEY`), enabling zero mobile refactoring when migrating.

---

## 1. Mathematical Scoring Engines

### 1.1 Daily Strain / Workload Engine (0.0 – 21.0 Whoop Scale)
Whoop-style cardiovascular strain calculates cumulative cardiac exertion over the 24-hour cycle. High heart rate zones generate exponentially greater fatigue than low zones.

#### Formula:
1. **Heart Rate Reserve Ratio ($r_i$):**
   $$r_i = \max\left(0, \frac{HR_i - HR_{\text{rest}}}{HR_{\text{max}} - HR_{\text{rest}}}\right)$$
2. **Instantaneous Cardiac Load ($\ell_i$):**
   $$\ell_i = \exp(k \cdot r_i) \cdot \Delta t_i$$
   *(Where $k = 4.0$ is the non-linear zone weight factor, and $\Delta t_i$ is time in minutes).*
3. **Cumulative Daily Load ($L_{\text{day}}$):**
   $$L_{\text{day}} = \sum_{i=1}^{N} \ell_i$$
4. **Logarithmic Day Strain Mapping ($S \in [0.0, 21.0]$):**
   $$\text{Day Strain} = 21.0 \times \left(1 - \exp\left(-\frac{L_{\text{day}}}{C}\right)\right)$$
   *(Where constant $C = 1200$ scales normal athletic days to a 10–18 strain range and maximal endurance days asymptotically toward 21.0).*

---

### 1.2 Daily Readiness / Recovery Engine (0% – 100%)
Calculated each morning immediately upon wake-up detection, comparing overnight parasympathetic nervous system markers against the user's rolling 14-day exponential moving average ($\mu_{14}, \sigma_{14}$).

#### Formula:
1. **Z-Scores:**
   $$Z_{\text{HRV}} = \frac{\text{HRV}_{\text{overnight}} - \mu(\text{HRV}_{14})}{\sigma(\text{HRV}_{14})}$$
   $$Z_{\text{RHR}} = \frac{\text{RHR}_{\text{overnight}} - \mu(\text{RHR}_{14})}{\sigma(\text{RHR}_{14})}$$
2. **Weighted Recovery Composite ($R_{\text{raw}}$):**
   $$R_{\text{raw}} = 0.50 \cdot Z_{\text{HRV}} - 0.30 \cdot Z_{\text{RHR}} + 0.20 \cdot \left(\frac{\text{Sleep Performance} - 0.85}{0.15}\right)$$
3. **Normalized 0–100% Score:**
   $$\text{Readiness} = \text{clamp}\left(50 + 25 \cdot R_{\text{raw}}, 0, 100\right)$$
4. **Recovery Tiers:**
   * **Green (Optimal):** $\ge 67\%$
   * **Yellow (Moderate):** $34\% - 66\%$
   * **Red (Rest / Stressed):** $< 34\%$

---

### 1.3 Sleep Score & Sleep Need Engine
$$\text{Sleep Need} = 8.0 + (0.08 \times \text{Previous Day Strain}) + (0.33 \times \text{Sleep Debt})$$
$$\text{Sleep Performance} = \min\left(1.0, \frac{\text{Time Asleep}}{\text{Sleep Need}}\right)$$
$$\text{Restorative Ratio} = \frac{\text{Deep Sleep Duration} + \text{REM Sleep Duration}}{\text{Total Time Asleep}}$$
$$\text{Sleep Score} = 100 \times \left(0.50 \cdot \text{Sleep Performance} + 0.30 \cdot \text{Sleep Efficiency} + 0.20 \cdot \frac{\text{Restorative Ratio}}{0.45}\right)$$

---

### 1.4 Biological Body Age Engine
Measures physiological resilience vs chronological age ($A_{\text{chron}}$).

$$\text{Body Age} = A_{\text{chron}} + \Delta_{\text{RHR}} + \Delta_{\text{HRV}} + \Delta_{\text{Sleep}} + \Delta_{\text{Activity}}$$

#### Contributing Factors:
1. **RHR Delta ($\Delta_{\text{RHR}}$):**
   $$\Delta_{\text{RHR}} = 0.15 \times (\text{RHR}_{\text{baseline}} - \text{Demographic RHR Norm})$$
   *(e.g., $51\text{ bpm}$ vs norm $65\text{ bpm} \rightarrow -2.1\text{ yrs}$)*
2. **HRV Delta ($\Delta_{\text{HRV}}$):**
   $$\Delta_{\text{HRV}} = -0.08 \times (\text{HRV}_{\text{baseline}} - \text{Demographic HRV Norm})$$
   *(e.g., $64\text{ ms}$ vs norm $45\text{ ms} \rightarrow -1.52\text{ yrs}$)*
3. **Restorative Sleep Delta ($\Delta_{\text{Sleep}}$):**
   $$\Delta_{\text{Sleep}} = -2.5 \times (\text{Restorative Ratio} - 0.40)$$
4. **Total Delta Constraint:**
   $$\text{Body Age} = \text{clamp}\left(A_{\text{chron}} + \sum \Delta, A_{\text{chron}} - 15, A_{\text{chron}} + 15\right)$$

---

## 2. Ingestion & Deduplication Algorithm (Fitbit vs Apple vs Google)

```typescript
export interface HealthRecord {
  id: string;
  source: 'fitbit' | 'apple_health' | 'google_health';
  startTime: number;
  endTime: number;
  type: 'workout' | 'steps' | 'sleep';
  data: any;
}

export function deduplicateWorkouts(
  records: HealthRecord[],
  priorityList: string[] = ['fitbit', 'apple_health', 'google_health']
): HealthRecord[] {
  // Sort records by start time ascending
  const sorted = [...records].sort((a, b) => a.startTime - b.startTime);
  const accepted: HealthRecord[] = [];

  for (const candidate of sorted) {
    // Find overlapping accepted workouts
    const conflictingIndex = accepted.findIndex(existing => {
      const overlapStart = Math.max(candidate.startTime, existing.startTime);
      const overlapEnd = Math.min(candidate.endTime, existing.endTime);
      const overlapDuration = Math.max(0, overlapEnd - overlapStart);
      const candidateDuration = candidate.endTime - candidate.startTime;
      return candidateDuration > 0 && (overlapDuration / candidateDuration) >= 0.50;
    });

    if (conflictingIndex === -1) {
      accepted.push(candidate);
    } else {
      const existing = accepted[conflictingIndex];
      const candidatePriority = priorityList.indexOf(candidate.source);
      const existingPriority = priorityList.indexOf(existing.source);

      // If candidate has strictly higher priority (lower index), replace existing
      if (candidatePriority !== -1 && candidatePriority < existingPriority) {
        accepted[conflictingIndex] = candidate;
      }
    }
  }

  return accepted;
}
```

---

## 3. UI Shaders & Graphic Rendering (Skia Bio-Orb)

The **Luminous Bio-Orb** uses a custom Skia Runtime Effect shader rendering a pulsing plasma sphere:
* **Optimal State:** Vertex color inputs interpolating between `#C084FC` (Lavender) and `#34D399` (Sage Emerald).
* **Elevated State:** Vertex color inputs interpolating between `#FBBF24` (Amber) and `#FDA4AF` (Rose Flame).
* **Shader Parameters:** Uniforms for `u_time`, `u_resolution`, `u_vitality_score`, and `u_pulse_freq`.
