CREATE TABLE "close_reasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "close_reasons_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "close_reasons_name_not_blank_check" CHECK (length(trim("close_reasons"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "instruments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"name" text,
	"asset_class" "asset_class" NOT NULL,
	"instrument_type" "instrument_type" NOT NULL,
	"subcategory" text,
	"default_trading_style" text,
	"default_quantity" numeric(20, 6),
	"default_multiplier" numeric(20, 6),
	"default_platform" text,
	"default_currency" "currency_code" NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instruments_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "instruments_symbol_not_blank_check" CHECK (length(trim("instruments"."symbol")) > 0),
	CONSTRAINT "instruments_default_quantity_positive_check" CHECK ("instruments"."default_quantity" is null or "instruments"."default_quantity" > 0),
	CONSTRAINT "instruments_default_multiplier_positive_check" CHECK ("instruments"."default_multiplier" is null or "instruments"."default_multiplier" > 0)
);
--> statement-breakpoint
CREATE TABLE "playbooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"market_scope" text,
	"setup_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playbooks_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "playbooks_name_not_blank_check" CHECK (length(trim("playbooks"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "strategies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "strategies_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "strategies_name_not_blank_check" CHECK (length(trim("strategies"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"instrument_id" uuid,
	"strategy_id" uuid,
	"playbook_id" uuid,
	"close_reason_id" uuid,
	"symbol" text NOT NULL,
	"asset_class" "asset_class" NOT NULL,
	"instrument_type" "instrument_type" NOT NULL,
	"subcategory" text,
	"trading_style" text,
	"platform" text,
	"direction" "trade_direction" NOT NULL,
	"status" "trade_status" DEFAULT 'open' NOT NULL,
	"currency" "currency_code" NOT NULL,
	"entry_at" timestamp with time zone NOT NULL,
	"entry_price" numeric(20, 6) NOT NULL,
	"exit_at" timestamp with time zone,
	"exit_price" numeric(20, 6),
	"quantity" numeric(20, 6) NOT NULL,
	"multiplier" numeric(20, 6) DEFAULT '1' NOT NULL,
	"stop_loss" numeric(20, 6),
	"planned_target" numeric(20, 6),
	"manual_pnl" numeric(20, 6),
	"fees" numeric(20, 6) DEFAULT '0' NOT NULL,
	"fx_to_account" numeric(20, 8) DEFAULT '1' NOT NULL,
	"planned_risk" numeric(20, 6),
	"planned_reward_risk" numeric(16, 6),
	"realized_pnl" numeric(20, 6),
	"realized_r" numeric(16, 6),
	"confidence" integer,
	"emotion" text,
	"setup_checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"rule_violations" text,
	"linked_note" text,
	"notes" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trades_symbol_not_blank_check" CHECK (length(trim("trades"."symbol")) > 0),
	CONSTRAINT "trades_entry_price_positive_check" CHECK ("trades"."entry_price" > 0),
	CONSTRAINT "trades_quantity_positive_check" CHECK ("trades"."quantity" > 0),
	CONSTRAINT "trades_multiplier_positive_check" CHECK ("trades"."multiplier" > 0),
	CONSTRAINT "trades_fees_nonnegative_check" CHECK ("trades"."fees" >= 0),
	CONSTRAINT "trades_fx_positive_check" CHECK ("trades"."fx_to_account" > 0),
	CONSTRAINT "trades_confidence_range_check" CHECK ("trades"."confidence" is null or "trades"."confidence" between 1 and 5),
	CONSTRAINT "trades_exit_after_entry_check" CHECK ("trades"."exit_at" is null or "trades"."exit_at" >= "trades"."entry_at"),
	CONSTRAINT "trades_closed_has_result_check" CHECK ("trades"."status" = 'open' or ("trades"."exit_at" is not null and ("trades"."exit_price" is not null or "trades"."manual_pnl" is not null))),
	CONSTRAINT "trades_directional_stop_check" CHECK ("trades"."stop_loss" is null or ("trades"."direction" = 'Long' and "trades"."stop_loss" < "trades"."entry_price") or ("trades"."direction" = 'Short' and "trades"."stop_loss" > "trades"."entry_price")),
	CONSTRAINT "trades_directional_target_check" CHECK ("trades"."planned_target" is null or ("trades"."direction" = 'Long' and "trades"."planned_target" > "trades"."entry_price") or ("trades"."direction" = 'Short' and "trades"."planned_target" < "trades"."entry_price"))
);
--> statement-breakpoint
ALTER TABLE "close_reasons" ADD CONSTRAINT "close_reasons_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instruments" ADD CONSTRAINT "instruments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playbooks" ADD CONSTRAINT "playbooks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_accounts" ADD CONSTRAINT "trading_accounts_tenant_id_unique" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_tenant_account_fk" FOREIGN KEY ("tenant_id","account_id") REFERENCES "public"."trading_accounts"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_creator_membership_fk" FOREIGN KEY ("tenant_id","created_by_user_id") REFERENCES "public"."tenant_memberships"("tenant_id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_tenant_instrument_fk" FOREIGN KEY ("tenant_id","instrument_id") REFERENCES "public"."instruments"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_tenant_strategy_fk" FOREIGN KEY ("tenant_id","strategy_id") REFERENCES "public"."strategies"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_tenant_playbook_fk" FOREIGN KEY ("tenant_id","playbook_id") REFERENCES "public"."playbooks"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_tenant_close_reason_fk" FOREIGN KEY ("tenant_id","close_reason_id") REFERENCES "public"."close_reasons"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "close_reasons_tenant_name_unique" ON "close_reasons" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "instruments_tenant_symbol_type_unique" ON "instruments" USING btree ("tenant_id","symbol","instrument_type");--> statement-breakpoint
CREATE INDEX "instruments_tenant_symbol_idx" ON "instruments" USING btree ("tenant_id","symbol");--> statement-breakpoint
CREATE UNIQUE INDEX "playbooks_tenant_name_unique" ON "playbooks" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "strategies_tenant_name_unique" ON "strategies" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "trades_tenant_account_entry_idx" ON "trades" USING btree ("tenant_id","account_id","entry_at");--> statement-breakpoint
CREATE INDEX "trades_tenant_symbol_idx" ON "trades" USING btree ("tenant_id","symbol");--> statement-breakpoint
CREATE INDEX "trades_tenant_status_idx" ON "trades" USING btree ("tenant_id","status");
