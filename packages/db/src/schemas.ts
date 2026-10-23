import { pgTable, text, uuid, integer, numeric, boolean, timestamp, date, unique, jsonb } from 'drizzle-orm/pg-core';

// Access control lives in the Next.js API (verifies the Clerk token, queries as a privileged role).
// RLS is enabled with no policies on every table => direct anon/authenticated access (e.g. Supabase REST) is denied.

  // 1. User Profiles
  export const userProfiles = pgTable('user_profiles', {
    id: text('id').primaryKey(), // Auth user ID
    email: text('email').notNull().unique(),
    displayName: text('display_name').notNull(),
    chronologicalBirthdate: date('chronological_birthdate').notNull(),
    heightCm: numeric('height_cm', { precision: 5, scale: 2 }).notNull(),
    sex: text('sex').default('prefer_not_to_say').notNull(), // 'male' | 'female' | 'prefer_not_to_say'
    weightKg: numeric('weight_kg', { precision: 5, scale: 2 }), // nullable; step-burn BMR uses this
    waistCm: numeric('waist_cm', { precision: 5, scale: 1 }),  // nullable; VO₂max unavailable until set
    syncStartTimestamp: timestamp('sync_start_timestamp', { withTimezone: true }).defaultNow().notNull(),
    waterGoalMl: integer('water_goal_ml').default(3000).notNull(),
    waterReminderIntervalMins: integer('water_reminder_interval_mins').default(90).notNull(),
    waterReminderEnabled: boolean('water_reminder_enabled').default(true).notNull(),
    waterReminderStartMin: integer('water_reminder_start_min').default(480).notNull(),  // minutes from local midnight (480 = 8:00 AM)
    waterReminderEndMin: integer('water_reminder_end_min').default(1320).notNull(),     // 1320 = 10:00 PM
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  }).enableRLS();

  // 2. Day-of-Week Custom Macro Goals (0 = Sunday, 1 = Monday ... 6 = Saturday)
  export const dailyMacroGoals = pgTable('daily_macro_goals', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').references(() => userProfiles.id, { onDelete: 'cascade' }).notNull(),
    dayOfWeek: integer('day_of_week').notNull(),
    targetCalories: integer('target_calories').default(2300).notNull(),
    targetProteinG: integer('target_protein_g').default(180).notNull(),
    targetCarbsG: integer('target_carbs_g').default(220).notNull(),
    targetFatsG: integer('target_fats_g').default(65).notNull(),
  }, (t) => [unique().on(t.userId, t.dayOfWeek)]).enableRLS();

  // 3. Daily Food Logs (Strictly by Date)
  export const foodLogs = pgTable('food_logs', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').references(() => userProfiles.id, { onDelete: 'cascade' }).notNull(),
    logDate: date('log_date').notNull(),
    mealType: text('meal_type').notNull(), // 'breakfast' | 'lunch' | 'dinner' | 'snack'
    foodName: text('food_name').notNull(),
    servingQuantity: numeric('serving_quantity', { precision: 7, scale: 2 }).notNull(),
    servingUnit: text('serving_unit').notNull(),
    calories: integer('calories').notNull(),
    proteinG: numeric('protein_g', { precision: 7, scale: 2 }).notNull(),
    carbsG: numeric('carbs_g', { precision: 7, scale: 2 }).notNull(),
    fatsG: numeric('fats_g', { precision: 7, scale: 2 }).notNull(),
    source: text('source').notNull(),
    loggedAt: timestamp('logged_at', { withTimezone: true }).defaultNow().notNull(),
  }).enableRLS();

  // 4. Water Logs
  export const waterLogs = pgTable('water_logs', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').references(() => userProfiles.id, { onDelete: 'cascade' }).notNull(),
    logDate: date('log_date').notNull(),
    amountMl: integer('amount_ml').notNull(),
    loggedAt: timestamp('logged_at', { withTimezone: true }).defaultNow().notNull(),
  }, (t) => [unique().on(t.userId, t.logDate)]).enableRLS();

  // 5. Workout Logs & HR Zones (1-5)
  export const workoutLogs = pgTable('workout_logs', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').references(() => userProfiles.id, { onDelete: 'cascade' }).notNull(),
    externalId: text('external_id'),
    source: text('source').notNull(), // 'fitbit' | 'apple_health' | 'google_health'
    workoutType: text('workout_type').notNull(),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    durationSeconds: integer('duration_seconds').notNull(),
    activeCalories: integer('active_calories').notNull(),
    avgHeartRate: integer('avg_heart_rate'),
    maxHeartRate: integer('max_heart_rate'),
    zone1Seconds: integer('zone1_seconds').default(0).notNull(),
    zone2Seconds: integer('zone2_seconds').default(0).notNull(),
    zone3Seconds: integer('zone3_seconds').default(0).notNull(),
    zone4Seconds: integer('zone4_seconds').default(0).notNull(),
    zone5Seconds: integer('zone5_seconds').default(0).notNull(),
    dedupedStatus: text('deduped_status').default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  }).enableRLS();

  // 6. Daily Vitals, Readiness & Body Age
  export const dailyVitalsSummary = pgTable('daily_vitals_summary', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').references(() => userProfiles.id, { onDelete: 'cascade' }).notNull(),
    summaryDate: date('summary_date').notNull(),
    // Readiness: null = not enough data (cold-start); tier: 'high'|'normal'|'low'
    readinessTier: text('readiness_tier'),
    rhrFlag: boolean('rhr_flag').default(false).notNull(),
    // Strain
    trimpRaw: numeric('trimp_raw', { precision: 7, scale: 2 }),
    dayStrain: numeric('day_strain', { precision: 4, scale: 2 }),
    // Sleep
    sleepScore: integer('sleep_score'),
    sleepNeedSeconds: integer('sleep_need_seconds'),
    sleepDebtSeconds: integer('sleep_debt_seconds'),
    sleepEfficiencyPct: integer('sleep_efficiency_pct'),
    sleepEfficiencyLabel: text('sleep_efficiency_label'), // 'SE' | 'SME'
    sleepDurationSeconds: integer('sleep_duration_seconds'),
    deepSleepSeconds: integer('deep_sleep_seconds'),
    remSleepSeconds: integer('rem_sleep_seconds'),
    lightSleepSeconds: integer('light_sleep_seconds'),
    awakeSeconds: integer('awake_seconds'),
    timeInBedSeconds: integer('time_in_bed_seconds'),
    // HRV / HR
    overnightHrvRmssd: numeric('overnight_hrv_rmssd', { precision: 5, scale: 2 }),
    restingHeartRate: integer('resting_heart_rate'),
    // Body age (null until waistCm is set)
    vo2maxMlKgMin: numeric('vo2max_ml_kg_min', { precision: 5, scale: 2 }),
    fitnessAge: numeric('fitness_age', { precision: 4, scale: 2 }),
    // Scale
    scaleWeightKg: numeric('scale_weight_kg', { precision: 5, scale: 2 }),
    weightSource: text('weight_source'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  }, (t) => [unique().on(t.userId, t.summaryDate)]).enableRLS();

  // 7. Wearable Priorities (Fitbit 1st by default)
  export const wearableSettings = pgTable('wearable_settings', {
    userId: text('user_id').primaryKey().references(() => userProfiles.id, { onDelete: 'cascade' }),
    priority1: text('priority_1').default('fitbit').notNull(),
    priority2: text('priority_2').default('apple_health').notNull(),
    priority3: text('priority_3').default('google_health').notNull(),
    humeScaleConnected: boolean('hume_scale_connected').default(false).notNull(),
    fittrConnected: boolean('fittr_connected').default(false).notNull(),
    fiteloConnected: boolean('fitelo_connected').default(false).notNull(),
    appleHealthConnected: boolean('apple_health_connected').default(false).notNull(),
    healthConnectConnected: boolean('health_connect_connected').default(false).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  }).enableRLS();

  // 8. Custom Foods (user-defined)
  export const customFoods = pgTable('custom_foods', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').references(() => userProfiles.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    brand: text('brand'),
    servingSizeG: numeric('serving_size_g', { precision: 7, scale: 2 }).notNull(),
    calories: integer('calories').notNull(),
    proteinG: numeric('protein_g', { precision: 7, scale: 2 }).notNull(),
    carbsG: numeric('carbs_g', { precision: 7, scale: 2 }).notNull(),
    fatsG: numeric('fats_g', { precision: 7, scale: 2 }).notNull(),
    barcode: text('barcode'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  }).enableRLS();

  // 9. Custom Recipes (ingredients stored as JSON)
  export const customRecipes = pgTable('custom_recipes', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').references(() => userProfiles.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    totalServings: integer('total_servings').default(1).notNull(),
    totalCalories: integer('total_calories').notNull(),
    totalProteinG: numeric('total_protein_g', { precision: 7, scale: 2 }).notNull(),
    totalCarbsG: numeric('total_carbs_g', { precision: 7, scale: 2 }).notNull(),
    totalFatsG: numeric('total_fats_g', { precision: 7, scale: 2 }).notNull(),
    ingredientsJson: jsonb('ingredients_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  }).enableRLS();