CREATE TABLE "custom_foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"serving_size_g" numeric(7, 2) NOT NULL,
	"calories" integer NOT NULL,
	"protein_g" numeric(7, 2) NOT NULL,
	"carbs_g" numeric(7, 2) NOT NULL,
	"fats_g" numeric(7, 2) NOT NULL,
	"barcode" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_foods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "custom_recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"total_servings" integer DEFAULT 1 NOT NULL,
	"total_calories" integer NOT NULL,
	"total_protein_g" numeric(7, 2) NOT NULL,
	"total_carbs_g" numeric(7, 2) NOT NULL,
	"total_fats_g" numeric(7, 2) NOT NULL,
	"ingredients_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_recipes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "custom_foods" ADD CONSTRAINT "custom_foods_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_recipes" ADD CONSTRAINT "custom_recipes_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;