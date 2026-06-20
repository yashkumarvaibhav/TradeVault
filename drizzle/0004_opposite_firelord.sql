ALTER TABLE "trades" DROP CONSTRAINT "trades_creator_membership_fk";
--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_creator_membership_fk" FOREIGN KEY ("tenant_id","created_by_user_id") REFERENCES "public"."tenant_memberships"("tenant_id","user_id") ON DELETE no action ON UPDATE no action;