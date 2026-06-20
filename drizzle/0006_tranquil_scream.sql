ALTER TABLE "trades" ADD CONSTRAINT "trades_tenant_id_unique" UNIQUE("tenant_id","id");--> statement-breakpoint
CREATE TABLE "trade_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"trade_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"original_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"caption" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trade_attachments_size_check" CHECK ("trade_attachments"."size_bytes" > 0 and "trade_attachments"."size_bytes" <= 5242880),
	CONSTRAINT "trade_attachments_content_type_check" CHECK ("trade_attachments"."content_type" in ('image/png', 'image/jpeg', 'image/webp', 'application/pdf'))
);
--> statement-breakpoint
ALTER TABLE "trade_attachments" ADD CONSTRAINT "trade_attachments_tenant_account_fk" FOREIGN KEY ("tenant_id","account_id") REFERENCES "public"."trading_accounts"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_attachments" ADD CONSTRAINT "trade_attachments_tenant_trade_fk" FOREIGN KEY ("tenant_id","trade_id") REFERENCES "public"."trades"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_attachments" ADD CONSTRAINT "trade_attachments_creator_membership_fk" FOREIGN KEY ("tenant_id","created_by_user_id") REFERENCES "public"."tenant_memberships"("tenant_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trade_attachments_storage_key_unique" ON "trade_attachments" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "trade_attachments_tenant_trade_idx" ON "trade_attachments" USING btree ("tenant_id","trade_id","created_at");