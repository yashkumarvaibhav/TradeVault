ALTER TABLE "instruments" ADD COLUMN "expiry_date" date;--> statement-breakpoint
ALTER TABLE "instruments" ADD COLUMN "option_side" text;--> statement-breakpoint
ALTER TABLE "instruments" ADD COLUMN "strike_price" numeric(20, 6);--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "expiry_date" date;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "option_side" text;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "strike_price" numeric(20, 6);--> statement-breakpoint
ALTER TABLE "instruments" ADD CONSTRAINT "instruments_option_side_check" CHECK ("instruments"."option_side" is null or "instruments"."option_side" in ('Call', 'Put'));--> statement-breakpoint
ALTER TABLE "instruments" ADD CONSTRAINT "instruments_strike_price_positive_check" CHECK ("instruments"."strike_price" is null or "instruments"."strike_price" > 0);--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_option_side_check" CHECK ("trades"."option_side" is null or "trades"."option_side" in ('Call', 'Put'));--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_strike_price_positive_check" CHECK ("trades"."strike_price" is null or "trades"."strike_price" > 0);