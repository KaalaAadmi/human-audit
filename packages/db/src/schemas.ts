import { pgTable, text, integer, numeric, boolean, timestamp, date } from 'drizzle-orm/pg-core';

  // 1. User Profiles
  export const userProfiles = pgTable('user_profiles', {
    id: text('id').primaryKey(), // Auth user ID
    email: text('email').notNull().unique(),
    displayName: text('display_name').notNull(),
    chronologicalBirthdate: date('chronological_birthdate').notNull(),
    heightCm: numeric('height_cm', { precision: 5, scale: 2 }).notNull(),
    syncStartTimestamp: timestamp('sync_start_timestamp', { withTimezone: true }).defaultNow().notNull(),
    waterGoalMl: integer('water_goal_ml').default(3000).notNull(),
    waterReminderIntervalMins: integer('water_reminder_interval_mins').default(90).notNull(),
    waterReminderEnabled: boolean('water_reminder_enabled').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  });

  // 2. Day-of-Week Custom Macro Goals (0 = Sunday, 1 = Monday ... 6 = Saturday)
  export const dailyMacroGoals = pgTable('daily_macro_goals', {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => userProfiles.id, { onDelete: 'cascade' }).notNull(),
    dayOfWeek: integer('day_of_week').notNull(),
    targetCalories: integer('target_calories').default(2300).notNull(),
    targetProteinG: integer('target_protein_g').default(180).notNull(),
    targetCarbsG: integer('target_carbs_g').default(220).notNull(),
    targetFatsG: integer('target_fats_g').default(65).notNull(),
  });

  // 3. Daily Food Logs (Strictly by Date)
  export const foodLogs = pgTable('food_logs', {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => userProfiles.id, { onDelete: 'cascade' }).notNull(),
    logDate: date('log_date').notNull(),
    mealType: text('meal_type').notNull(), // 'breakfast' | 'lunch' | 'dinner' | 'snack'
    foodName: text('food_name').notNull(),
    servingQuantity: numeric('serving_quantity', { precision: 5, scale: 2 }).notNull(),
    servingUnit: text('serving_unit').notNull(),
    calories: integer('calories').notNull(),
    proteinG: numeric('protein_g', { precision: 5, scale: 2 }).notNull(),
    carbsG: numeric('carbs_g', { precision: 5, scale: 2 }).notNull(),
    fatsG: numeric('fats_g', { precision: 5, scale: 2 }).notNull(),
    source: text('source').notNull(),
    loggedAt: timestamp('logged_at', { withTimezone: true }).defaultNow().notNull(),
  });

  // 4. Water Logs
  export const waterLogs = pgTable('water_logs', {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => userProfiles.id, { onDelete: 'cascade' }).notNull(),
    logDate: date('log_date').notNull(),
    amountMl: integer('amount_ml').notNull(),
    loggedAt: timestamp('logged_at', { withTimezone: true }).defaultNow().notNull(),
  });

  // 5. Workout Logs & HR Zones (1-5)
  export const workoutLogs = pgTable('workout_logs', {
    id: text('id').primaryKey(),
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
  });

  // 6. Daily Vitals, Readiness & Body Age
  export const dailyVitalsSummary = pgTable('daily_vitals_summary', {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => userProfiles.id, { onDelete: 'cascade' }).notNull(),
    summaryDate: date('summary_date').notNull(),
    readinessScore: integer('readiness_score').notNull(),
    dayStrain: numeric('day_strain', { precision: 4, scale: 2 }).notNull(),
    sleepScore: integer('sleep_score').notNull(),
    sleepDurationSeconds: integer('sleep_duration_seconds').notNull(),
    deepSleepSeconds: integer('deep_sleep_seconds').notNull(),
    remSleepSeconds: integer('rem_sleep_seconds').notNull(),
    lightSleepSeconds: integer('light_sleep_seconds').notNull(),
    awakeSeconds: integer('awake_seconds').notNull(),
    overnightHrvRmssd: numeric('overnight_hrv_rmssd', { precision: 5, scale: 2 }),
    restingHeartRate: integer('resting_heart_rate'),
    bodyAge: numeric('body_age', { precision: 4, scale: 2 }).notNull(),
    scaleWeightKg: numeric('scale_weight_kg', { precision: 5, scale: 2 }),
    weightSource: text('weight_source'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  });

  // 7. Wearable Priorities (Fitbit 1st by default)
  export const wearableSettings = pgTable('wearable_settings', {
    userId: text('user_id').primaryKey().references(() => userProfiles.id, { onDelete: 'cascade' }),
    priority1: text('priority_1').default('fitbit').notNull(),
    priority2: text('priority_2').default('apple_health').notNull(),
    priority3: text('priority_3').default('google_health').notNull(),
    humeScaleConnected: boolean('hume_scale_connected').default(false).notNull(),
    fittrConnected: boolean('fittr_connected').default(false).notNull(),
    fiteloConnected: boolean('fitelo_connected').default(false).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  });