import { pgTable, pgEnum, text, uuid, integer, smallint, numeric, boolean, timestamp, date, unique, jsonb, primaryKey, doublePrecision, bigserial, customType } from 'drizzle-orm/pg-core';

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
    hrvVariant: text('hrv_variant'), // 'sdnn' | 'rmssd'; baselines are per variant
    sleepSource: text('sleep_source'), // source_id of the connection that won, for the UI label
    hrvSource: text('hrv_source'),
    rhrSource: text('rhr_source'),
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
    hidden: boolean('hidden').default(false).notNull(), // set after enough reports (drizzle/0009)
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
    hidden: boolean('hidden').default(false).notNull(), // set after enough reports (drizzle/0009)
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  }).enableRLS();

  // 9b. Reports on shared foods / recipes (drizzle/0009_content_moderation.sql)
  export const contentReports = pgTable('content_reports', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').references(() => userProfiles.id, { onDelete: 'set null' }), // null once the reporter deleted their account; the report still counts
    kind: text('kind').notNull(), // 'food' | 'recipe'
    itemId: uuid('item_id').notNull(),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  }, (t) => ({ once: unique().on(t.userId, t.kind, t.itemId) })).enableRLS();
  // ---- Data connectors (docs/data-connectors.md section 5; SQL in drizzle/0008_data_connectors.sql) ----
  const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });

  export const sourceId = pgEnum('source_id', ['healthkit', 'health_connect', 'google_health']);
  export const connectionStatus = pgEnum('connection_status', [
    'connecting', 'connected', 'partial', 'stale', 'needs_reauth', 'collector_missing', 'error', 'not_connected',
  ]);

  export const devices = pgTable('devices', {
    id: uuid('id').primaryKey(), // generated on the phone, kept in expo-secure-store
    userId: text('user_id').references(() => userProfiles.id, { onDelete: 'cascade' }).notNull(),
    platform: text('platform').notNull(), // 'ios' | 'android'
    name: text('name').notNull(),
    appVersion: text('app_version'),
    pushToken: text('push_token'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
  }).enableRLS();

  export const connections = pgTable('connections', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').references(() => userProfiles.id, { onDelete: 'cascade' }).notNull(),
    source: sourceId('source').notNull(),
    status: connectionStatus('status').default('connecting').notNull(),
    collectorDeviceId: uuid('collector_device_id').references(() => devices.id),
    grantedMetrics: text('granted_metrics').array().default([]).notNull(),
    grantedScopes: text('granted_scopes').array(),
    externalUserId: text('external_user_id'), // google_health: healthUserId
    connectedAt: timestamp('connected_at', { withTimezone: true }).defaultNow().notNull(),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    lastSyncError: jsonb('last_sync_error'),
    backfillCompletedAt: timestamp('backfill_completed_at', { withTimezone: true }),
  }, (t) => [unique().on(t.userId, t.source)]).enableRLS();

  export const syncCursors = pgTable('sync_cursors', {
    connectionId: uuid('connection_id').references(() => connections.id, { onDelete: 'cascade' }).notNull(),
    metric: text('metric').notNull(),
    cursor: text('cursor').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  }, (t) => [primaryKey({ columns: [t.connectionId, t.metric] })]).enableRLS();

  export const oauthTokens = pgTable('oauth_tokens', {
    connectionId: uuid('connection_id').primaryKey().references(() => connections.id, { onDelete: 'cascade' }),
    refreshTokenEnc: bytea('refresh_token_enc').notNull(), // AES-256-GCM
    accessTokenEnc: bytea('access_token_enc'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    scopes: text('scopes').array().notNull(),
  }).enableRLS();

  export const samples = pgTable('samples', {
    id: text('id').primaryKey(), // hash(source, metric, originId): idempotent upserts
    userId: text('user_id').references(() => userProfiles.id, { onDelete: 'cascade' }).notNull(),
    connectionId: uuid('connection_id').references(() => connections.id, { onDelete: 'cascade' }).notNull(),
    source: sourceId('source').notNull(),
    metric: text('metric').notNull(),
    variant: text('variant'), // 'sdnn' | 'rmssd' for HRV
    value: doublePrecision('value'),
    unit: text('unit').notNull(),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    tzOffsetMinutes: smallint('tz_offset_minutes').notNull(),
    originApp: text('origin_app'),
    originDevice: text('origin_device'),
    originId: text('origin_id').notNull(),
    payload: jsonb('payload'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).defaultNow().notNull(),
  }).enableRLS();

  export const metricPreferences = pgTable('metric_preferences', {
    userId: text('user_id').references(() => userProfiles.id, { onDelete: 'cascade' }).notNull(),
    metric: text('metric').notNull(),
    connectionOrder: uuid('connection_order').array().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  }, (t) => [primaryKey({ columns: [t.userId, t.metric] })]).enableRLS();

  export const dailySummaries = pgTable('daily_summaries', {
    userId: text('user_id').references(() => userProfiles.id, { onDelete: 'cascade' }).notNull(),
    localDate: date('local_date').notNull(),
    metric: text('metric').notNull(),
    value: doublePrecision('value'), // null = no data, not zero
    unit: text('unit').notNull(),
    connectionId: uuid('connection_id').references(() => connections.id, { onDelete: 'set null' }),
    variant: text('variant'),
    payload: jsonb('payload'),
  }, (t) => [primaryKey({ columns: [t.userId, t.localDate, t.metric] })]).enableRLS();

  export const originMap = pgTable('origin_map', {
    originApp: text('origin_app').primaryKey(),
    label: text('label').notNull(),
    mirrorsSource: sourceId('mirrors_source'),
  }).enableRLS();

  // Postgres-backed job queue (replaces pgmq); drained by POST /api/v1/jobs/run.
  export const jobs = pgTable('jobs', {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    kind: text('kind').notNull(),
    payload: jsonb('payload').default({}).notNull(),
    runAt: timestamp('run_at', { withTimezone: true }).defaultNow().notNull(),
    attempts: integer('attempts').default(0).notNull(),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  }).enableRLS();

  // Single-use OAuth `state` nonces for the Google Health connect flow.
  export const oauthStates = pgTable('oauth_states', {
    nonce: text('nonce').primaryKey(),
    userId: text('user_id').references(() => userProfiles.id, { onDelete: 'cascade' }).notNull(),
    deviceId: uuid('device_id'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  }).enableRLS();
