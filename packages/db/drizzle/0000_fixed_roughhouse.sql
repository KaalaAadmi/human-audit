CREATE TABLE "daily_macro_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"day_of_week" integer NOT NULL,
	"target_calories" integer DEFAULT 2300 NOT NULL,
	"target_protein_g" integer DEFAULT 180 NOT NULL,
	"target_carbs_g" integer DEFAULT 220 NOT NULL,
	"target_fats_g" integer DEFAULT 65 NOT NULL,
	CONSTRAINT "daily_macro_goals_user_id_day_of_week_unique" UNIQUE("user_id","day_of_week")
);
--> statement-breakpoint
ALTER TABLE "daily_macro_goals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "daily_vitals_summary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"summary_date" date NOT NULL,
	"readiness_score" integer NOT NULL,
	"day_strain" numeric(4, 2) NOT NULL,
	"sleep_score" integer NOT NULL,
	"sleep_duration_seconds" integer NOT NULL,
	"deep_sleep_seconds" integer NOT NULL,
	"rem_sleep_seconds" integer NOT NULL,
	"light_sleep_seconds" integer NOT NULL,
	"awake_seconds" integer NOT NULL,
	"overnight_hrv_rmssd" numeric(5, 2),
	"resting_heart_rate" integer,
	"body_age" numeric(4, 2) NOT NULL,
	"scale_weight_kg" numeric(5, 2),
	"weight_source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_vitals_summary_user_id_summary_date_unique" UNIQUE("user_id","summary_date")
);
--> statement-breakpoint
ALTER TABLE "daily_vitals_summary" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "food_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"log_date" date NOT NULL,
	"meal_type" text NOT NULL,
	"food_name" text NOT NULL,
	"serving_quantity" numeric(7, 2) NOT NULL,
	"serving_unit" text NOT NULL,
	"calories" integer NOT NULL,
	"protein_g" numeric(7, 2) NOT NULL,
	"carbs_g" numeric(7, 2) NOT NULL,
	"fats_g" numeric(7, 2) NOT NULL,
	"source" text NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "food_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"chronological_birthdate" date NOT NULL,
	"height_cm" numeric(5, 2) NOT NULL,
	"sync_start_timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"water_goal_ml" integer DEFAULT 3000 NOT NULL,
	"water_reminder_interval_mins" integer DEFAULT 90 NOT NULL,
	"water_reminder_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "water_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"log_date" date NOT NULL,
	"amount_ml" integer NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "water_logs_user_id_log_date_unique" UNIQUE("user_id","log_date")
);
--> statement-breakpoint
ALTER TABLE "water_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "wearable_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"priority_1" text DEFAULT 'fitbit' NOT NULL,
	"priority_2" text DEFAULT 'apple_health' NOT NULL,
	"priority_3" text DEFAULT 'google_health' NOT NULL,
	"hume_scale_connected" boolean DEFAULT false NOT NULL,
	"fittr_connected" boolean DEFAULT false NOT NULL,
	"fitelo_connected" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wearable_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workout_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"external_id" text,
	"source" text NOT NULL,
	"workout_type" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"duration_seconds" integer NOT NULL,
	"active_calories" integer NOT NULL,
	"avg_heart_rate" integer,
	"max_heart_rate" integer,
	"zone1_seconds" integer DEFAULT 0 NOT NULL,
	"zone2_seconds" integer DEFAULT 0 NOT NULL,
	"zone3_seconds" integer DEFAULT 0 NOT NULL,
	"zone4_seconds" integer DEFAULT 0 NOT NULL,
	"zone5_seconds" integer DEFAULT 0 NOT NULL,
	"deduped_status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workout_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "daily_macro_goals" ADD CONSTRAINT "daily_macro_goals_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_vitals_summary" ADD CONSTRAINT "daily_vitals_summary_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_logs" ADD CONSTRAINT "food_logs_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "water_logs" ADD CONSTRAINT "water_logs_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wearable_settings" ADD CONSTRAINT "wearable_settings_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;