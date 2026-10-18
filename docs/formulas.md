I'll go through the published validation literature for each marker, pick the best-supported formula, and give you the final set.

I went through the validation literature for each marker and picked one primary formula per marker, chosen by how strongly it holds up against a gold-standard measurement or real outcomes. For some markers no formula has been validated, and I've said so where that's the case. Fitbit Air will expose only some of the inputs.

## Summary of picks

| Marker | Chosen formula | Why |
|---|---|---|
| Max HR | **Tanaka** (208 − 0.7 × age), replaced by your measured max once you have one | Largest derivation sample, and the most consistent winner in head-to-head comparisons |
| HR zones | **Karvonen %HRR with ACSM cut-points** | ACSM-endorsed; %HRR tracks %VO₂ reserve |
| Strain | **Banister TRIMP**, upgraded to **iTRIMP** if you ever get a lactate test | iTRIMP has the strongest link to actual fitness changes |
| Readiness | **lnRMSSD 7-day rolling average vs smallest worthwhile change (Plews / AIS)** | The only readiness method with RCT and meta-analysis support |
| Body age | **HUNT Fitness Age** (VO₂max mapped onto population norms) | Linked to mortality in a cohort of about 37,000 people |
| Pace / rejuvenation | **Slope of Fitness Age over time** | No open wearable formula has been validated; this is the defensible construction |
| Sleep stages | **Altini & Kinnunen 2021 feature set + gradient boosting** | Largest validation of any published, fully described method (440 nights, PSG reference) |

---

## 1. Max Heart Rate: Tanaka

```
HRmax = 208 − 0.7 × age
Use instead: HRmax_used = max(Tanaka, highest clean HR seen in a true all-out effort)
```

**Evidence:**
- Tanaka was derived from 351 studies covering 18,712 subjects, then cross-validated in 514 lab-tested people.
- A 2025 PLOS ONE comparison found Arena, Tanaka and Gellish had the lowest errors, but none of the equations was accurate at the individual level.
- A review of age-based equations concluded that if you have to use one, use Tanaka.
- Fitter people deviate more: most equations, Tanaka included, increasingly underestimate HRmax at higher heart rates.

That last point is why a measured max should replace the equation once you have one. Gellish (207 − 0.7 × age) and Arena/FRIEND (209.3 − 0.72 × age) are statistically near-ties with Tanaka.

## 2. Heart Rate Zones: Karvonen %HRR, ACSM cut-points

```
HRR      = HRmax − HRrest           (HRrest = your overnight RHR, 7-day avg)
HR at p  = HRrest + p × HRR
```

| Zone | ACSM category | % HRR |
|---|---|---|
| Z1 | Light | 30–39% |
| Z2 | Moderate | 40–59% |
| Z3 | Vigorous (low) | 60–74% |
| Z4 | Vigorous (high) | 75–89% |
| Z5 | Near-maximal | ≥ 90% |

**Why HRR:**
- ACSM switched to relating %HRR to %VO₂ reserve in 1998 because it's more accurate, especially at low intensities.
- It defines moderate intensity as 40–59% HRR and vigorous as 60–89%.
- The split of vigorous into Z3/Z4 at 75% is my addition, not part of the ACSM categories.

**Caveat and gold standard:** One MSSE paper argues that %HRR and %VO₂R aren't truly equivalent. The gold standard is zones anchored to your ventilatory thresholds. In the HUNT reference data, those thresholds averaged about 77% and 87% of VO₂peak, so if you ever get a lab test, anchor Z2/Z3 to VT1 and Z4/Z5 to VT2.

## 3. Day Strain: Banister TRIMP (iTRIMP if lab-tested)

**Evidence:**
- In a 10-week study of cyclists, iTRIMP had the strongest relationship with changes in aerobic fitness (r = 0.81), ahead of the Banister, Edwards and Lucia TRIMPs and session RPE.
- In professional youth soccer players, iTRIMP also related better than the other methods to fitness changes.

```
For each 1-min sample:
  HRr = (HR − HRrest) / (HRmax − HRrest)

iTRIMP  = Σ Δt × HRr × a × e^(b × HRr)     ← a, b fitted from YOUR blood-lactate vs HRr curve
Banister = Σ Δt × HRr × 0.64 × e^(1.92 × HRr)   (men)
           Σ Δt × HRr × 0.86 × e^(1.67 × HRr)   (women)
```

- **iTRIMP** fits the exponential weighting from your own HR–lactate relationship.
- **Banister** is the same formula with population-average constants. Without a lactate test, use Banister.
- **Day Strain = sum over the day.** Ignore minutes below ~30% HRR so that ordinary daily activity doesn't accumulate.

The 0–21 scale isn't validated. If you want a WHOOP-style display, the log mapping from my last message works, but it's purely cosmetic:

```
Strain = 21 × ln(1 + TRIMP) / ln(6287)
```

The validated quantity is TRIMP itself. For training decisions, track it as a weekly sum or a rolling load.

## 4. Readiness: lnRMSSD rolling average vs SWC

No composite 0–100 readiness score has ever been validated. Oura, Fitbit and WHOOP all use proprietary blends. What is validated is the HRV decision rule:

```
Daily:     x_t   = ln(RMSSD_t)                     # overnight RMSSD (ms)
Signal:    S_t   = mean(x_{t−6} … x_t)             # 7-day rolling average
Baseline:  μ, σ  = mean & SD of daily x over the prior ~60 days
SWC band:  [μ − 0.5σ,  μ + 0.5σ]

Readiness:
  S_t within band  → Normal  → train as planned
  S_t below band   → Low     → reduce intensity
  S_t above band   → High    → good to push (or check for unusual factors)
Need ≥ 3 valid nights in the 7-day window.
```

**Evidence:**
- The Australian Institute of Sport's best-practice guidelines specify lnRMSSD and assessing 7-day rolling averages against the smallest worthwhile change (SWC).
- Plews' work concluded you need at least 3 valid data points per week.
- A 2020 meta-analysis found HRV-guided training improved VO₂max with a small effect size (0.40).
- A 2021 meta-analysis found no significant group-level advantage over a fixed plan, but fewer people got worse on HRV-guided training.

**Secondary flag:** add a red flag when RHR (7-day average) is more than 0.5 SD above its baseline at the same time HRV is below the band. That combined flag is my addition, not a published rule.

## 5. Body Age: HUNT Fitness Age

**Evidence:** The non-exercise fitness estimate was tested in 18,348 men and 18,764 women followed for an average of 24 years. Each 1 MET of extra fitness meant 15% lower all-cause mortality in men and 8% lower in women.

**Step 1: VO₂max.** Use Fitbit's cardio fitness estimate if your MCP exposes it. Otherwise use the Nes non-exercise equation:

```
Men:   VO₂max = 100.27 − 0.296·age + 0.226·PA − 0.369·WC − 0.155·RHR
Women: VO₂max = 74.736 − 0.247·age + 0.198·PA − 0.259·WC − 0.114·RHR
   WC = waist circumference (cm), RHR = resting HR, PA = HUNT physical-activity index
```

PA is a frequency × intensity × duration score from the HUNT questionnaire; check Nes 2011 for the exact scoring. These equations explain about 56–61% of the variance in measured VO₂max, with a standard error of about 5–6 ml/kg/min.

**Step 2: map to the age where you'd be average.** In the HUNT reference data, men aged 20–29 averaged 54.4 ml/kg/min and women 43.0, declining by about 3.5 per decade. A linear version of that gives:

```
Men:   FitnessAge = 25 + (54.4 − VO₂max) / 0.35
Women: FitnessAge = 25 + (43.0 − VO₂max) / 0.35
```

**A caveat worth knowing:** Fitness Age uses population norms, so it shows big swings, roughly 10 "years" per MET. If you want the age shift that corresponds to actual mortality risk, convert the hazard ratio with Gompertz's law (mortality roughly doubles every ~8 years):

```
ΔAge_mortality = ln(HR) / ln(1.09)
Example: 1 MET better (HR = 0.85, men) → about −1.9 years
```

The mortality-based version gives smaller, more honest numbers. WHOOP's 9-metric blend has no published validation, so I wouldn't treat it as most validated.

## 6. Pace of Aging / Rejuvenation Pace: slope of Fitness Age

Nobody has published an open, validated wearable formula for this. The closest validated work is GeroSense: a neural network trained on 103,830 week-long step-count recordings, whose biological age acceleration was associated with life expectancy. Its weights aren't public.

The defensible construction uses the same definition as epigenetic pace-of-aging clocks: biological years gained per calendar year.

```
Collect weekly FitnessAge_w over a trailing 12–26 weeks
Fit:  FitnessAge_w = α + β × t_w         (t in years, OLS)
Pace = β

β = 1  → aging in step with the calendar
β = 0  → holding steady
β < 0  → "rejuvenating"
Report only if R² and n are reasonable (≥ 12 weekly points)
```

## 7. Sleep Staging: Altini & Kinnunen 2021

**Why this one:** it's the largest validation of a fully described method, with 440 nights from 106 people against polysomnography (PSG), the lab gold standard. 4-stage accuracy was 79% with all features, versus 57% for motion alone. Per-stage sensitivity was 81% for wake, 82% light, 74% deep and 78% REM. HRV features gave the biggest single improvement, raising 4-stage accuracy from 60% to 76%.

**The recipe (30-second epochs):**

```
ACCELEROMETER (per 30 s)
  - band-pass 3–11 Hz, abs → trimmed mean, max, IQR per axis
  - MAD (mean amplitude deviation) in 5 s epochs → trimmed mean, max, IQR
  - change in arm angle (5 s) → trimmed mean, max, IQR

PPG / HRV (rolling 1-min and 5-min windows)
  - beat cleaning: drop an interval if it deviates >16 bpm from the
    7-beat median; keep only if 5 consecutive intervals are normal
  - HR, RMSSD, SDNN, pNN50, LF & HF power, LF/HF peak frequencies,
    total power, normalised power, breathing rate

TEMPERATURE (per 30 s): mean, min, max, SD

CIRCADIAN (sensor-free, scaled to the night's length)
  - cosine (circadian drive), exponential decay (sleep pressure),
    linear 0→1 (time elapsed)

NORMALISE: per night, robust scaling on 5th–95th percentiles
           (skip for raw motion magnitude features)

MODEL: LightGBM, DART boosting, 500 trees
```

- The beat-cleaning rule, the normalization approach and the model settings all come straight from the paper.
- The sensor-free circadian features help because deep sleep clusters early in the night and REM late.
- For training data, use the Walch Apple Watch dataset (PhysioNet), which has wrist PPG and accelerometer data labeled against PSG.

**For your Fitbit Air:** the study used a finger ring. Expect somewhat lower accuracy from the wrist, and only partial accuracy if you can get HR but not beat-to-beat intervals.

---

Two of these need data your MCP may not expose yet. Strain needs intraday HR, and sleep staging needs beat-to-beat intervals plus raw motion. The readiness rule and Fitness Age work with the daily RHR and HRV you already pull. I can write these as a Python module for your MCP server next.

Sources:
- [Tanaka et al., 2001 (PubMed)](https://pubmed.ncbi.nlm.nih.gov/11153730/)
- [Exploratory analysis of age-based HRmax equations, PLOS ONE 2025](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12574831/)
- [Exploratory analysis of age-based HRmax equations (ResearchGate)](https://www.researchgate.net/publication/397064650_Exploratory_analysis_of_the_accuracy_of_age-based_maximal_heart_rate_equations_across_cardiorespiratory_fitness_levels)
- [Revisiting Age-Predicted Maximal Heart Rate](https://www.researchgate.net/publication/291017337_Revisiting_Age-Predicted_Maximal_Heart_Rate_Can_it_be_used_as_a_Valid_Measure_of_Effort)
- [Swain & Franklin: HRR vs VO₂R (JCEP)](https://jcep.kglmeridian.com/view/journals/ceph/10/3/article-p97.xml)
- [Swain: HRR and VO₂R intensities (JCEP PDF)](https://jcep.kglmeridian.com/downloadpdf/view/journals/ceph/12/3/article-p65.pdf)
- [HRR and VO₂R fractions are not equivalent (MSSE)](https://paulogentil.com/pdf/HRR%20and%20VO2R%20Fractions%20Are%20Not%20Equivalent%20-%20Is%20It%20Time%20to%20Rethink%20Aerobic%20Exercise%20Prescription%20Methods.pdf)
- [HUNT 3 cardio-respiratory reference data (PLOS ONE 2014)](https://doaj.org/article/e0dc3657f33c4051a75141ed6fedb84d)
- [Training-load methods vs fitness changes in cyclists](https://www.iat.uni-leipzig.de/datenbanken/iks/bdr/Record/4044811)
- [iTRIMP in professional youth soccer players](https://lida.sport-iat.de/ta/Record/4026417)
- [Training-load methods in cyclists (Hull repository)](https://hull-repository.worktribe.com/OutputFile/443111)
- [AIS HR/HRV best-practice guidelines](https://www.ais.gov.au/__data/assets/pdf_file/0013/1130260/HRV-BPG_FINAL.pdf)
- [Plews thesis on HRV monitoring (AUT)](https://openrepository.aut.ac.nz/items/d7b41d29-e92e-4acf-90ea-ed68d84d6c73)
- [HRV-guided training meta-analysis 2020 (IJERPH)](https://mdpi-res.com/d_attachment/ijerph/ijerph-17-07999/article_deploy/ijerph-17-07999.pdf)
- [HRV-guided training evidence summary](https://www.athletedata.health/guides/hrv-guided-training)
- [Nes et al., 2014: nonexercise fitness and mortality](https://research.uaeu.ac.ae/en/publications/a-simple-nonexercise-model-of-cardiorespiratory-fitness-predicts-/)
- [Non-exercise VO₂max equations table (JAHA)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7428991/table/jah35165-tbl-0001)
- [Loe et al., 2013 aerobic reference data](https://doaj.org/article/43df251f84264b35b45148071c431b1e)
- [Pyrkov et al., 2021 GeroSense (Aging)](https://covid19.neicon.ru/publication/4650)
- [Altini & Kinnunen, 2021 (Sensors)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8271886)
- [Walch Apple Watch sleep dataset (PhysioNet)](https://www.physionet.org/content/sleep-accel/)