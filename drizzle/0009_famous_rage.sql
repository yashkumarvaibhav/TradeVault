ALTER TABLE "trades" ADD COLUMN "mfe_price" numeric(20, 6);--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "mae_price" numeric(20, 6);--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "mfe_amount" numeric(20, 6);--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "mae_amount" numeric(20, 6);--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "mfe_r" numeric(16, 6);--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "mae_r" numeric(16, 6);--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "captured_move_pct" numeric(16, 6);--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_mfe_price_positive_check" CHECK ("trades"."mfe_price" is null or "trades"."mfe_price" > 0);--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_mae_price_positive_check" CHECK ("trades"."mae_price" is null or "trades"."mae_price" > 0);--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_mfe_amount_nonnegative_check" CHECK ("trades"."mfe_amount" is null or "trades"."mfe_amount" >= 0);--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_mae_amount_nonnegative_check" CHECK ("trades"."mae_amount" is null or "trades"."mae_amount" >= 0);--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_mfe_r_nonnegative_check" CHECK ("trades"."mfe_r" is null or "trades"."mfe_r" >= 0);--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_mae_r_nonnegative_check" CHECK ("trades"."mae_r" is null or "trades"."mae_r" >= 0);