CREATE TYPE "public"."asset_class" AS ENUM('Equity', 'Index', 'Forex', 'Commodity', 'US Index', 'Crypto');--> statement-breakpoint
CREATE TYPE "public"."currency_code" AS ENUM('INR', 'USD');--> statement-breakpoint
CREATE TYPE "public"."instrument_type" AS ENUM('Cash', 'Futures', 'Options');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TYPE "public"."trade_direction" AS ENUM('Long', 'Short');--> statement-breakpoint
CREATE TYPE "public"."trade_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE "tenant_memberships" (
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "membership_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_memberships_pk" PRIMARY KEY("tenant_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_normalized_check" CHECK ("tenants"."slug" = lower("tenants"."slug")),
	CONSTRAINT "tenants_slug_format_check" CHECK ("tenants"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
	CONSTRAINT "tenants_name_not_blank_check" CHECK (length(trim("tenants"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "trading_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text DEFAULT 'Main' NOT NULL,
	"default_currency" "currency_code" DEFAULT 'INR' NOT NULL,
	"is_default" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "trading_accounts_name_not_blank_check" CHECK (length(trim("trading_accounts"."name")) > 0),
	CONSTRAINT "trading_accounts_default_not_archived_check" CHECK (not "trading_accounts"."is_default" or "trading_accounts"."archived_at" is null)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"display_username" text NOT NULL,
	"display_name" text,
	"legacy_password_hash" text,
	"legacy_password_salt" text,
	"legacy_totp_secret" text,
	"totp_verified" boolean DEFAULT false NOT NULL,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"account_locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_normalized_check" CHECK ("users"."username" = lower("users"."username")),
	CONSTRAINT "users_username_not_blank_check" CHECK (length(trim("users"."username")) >= 3),
	CONSTRAINT "users_failed_login_attempts_nonnegative_check" CHECK ("users"."failed_login_attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_accounts" ADD CONSTRAINT "trading_accounts_owner_membership_fk" FOREIGN KEY ("tenant_id","owner_user_id") REFERENCES "public"."tenant_memberships"("tenant_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_memberships_user_idx" ON "tenant_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_slug_unique" ON "tenants" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "trading_accounts_owner_name_unique" ON "trading_accounts" USING btree ("tenant_id","owner_user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "trading_accounts_one_default_per_owner_unique" ON "trading_accounts" USING btree ("tenant_id","owner_user_id") WHERE "trading_accounts"."is_default" = true;--> statement-breakpoint
CREATE INDEX "trading_accounts_tenant_idx" ON "trading_accounts" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "users" USING btree ("username");