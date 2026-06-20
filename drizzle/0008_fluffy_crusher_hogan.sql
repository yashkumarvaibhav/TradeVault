CREATE TYPE "public"."note_collection" AS ENUM('none', 'setups', 'risk-rules', 'mistakes', 'tags');--> statement-breakpoint
CREATE TYPE "public"."note_type" AS ENUM('general', 'pre-trade', 'post-trade', 'daily-journal');--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body_text" text DEFAULT '' NOT NULL,
	"body_json" jsonb,
	"note_type" "note_type" DEFAULT 'general' NOT NULL,
	"collection" "note_collection" DEFAULT 'none' NOT NULL,
	"is_template" boolean DEFAULT false NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"linked_trade_id" uuid,
	"linked_playbook_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notes_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "notes_title_not_blank_check" CHECK (length(trim("notes"."title")) > 0)
);
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_tenant_account_fk" FOREIGN KEY ("tenant_id","account_id") REFERENCES "public"."trading_accounts"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_creator_membership_fk" FOREIGN KEY ("tenant_id","created_by_user_id") REFERENCES "public"."tenant_memberships"("tenant_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_tenant_trade_fk" FOREIGN KEY ("tenant_id","linked_trade_id") REFERENCES "public"."trades"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_tenant_playbook_fk" FOREIGN KEY ("tenant_id","linked_playbook_id") REFERENCES "public"."playbooks"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notes_tenant_account_updated_idx" ON "notes" USING btree ("tenant_id","account_id","updated_at");--> statement-breakpoint
CREATE INDEX "notes_tenant_trade_idx" ON "notes" USING btree ("tenant_id","linked_trade_id");