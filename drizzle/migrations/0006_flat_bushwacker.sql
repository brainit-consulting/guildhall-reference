CREATE TYPE "public"."activity_kind" AS ENUM('note', 'call', 'meeting', 'stage_change');--> statement-breakpoint
CREATE TABLE "activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "activity_kind" NOT NULL,
	"body" text NOT NULL,
	"user_id" text,
	"contact_id" uuid,
	"company_id" uuid,
	"deal_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "activity_on_one_record" CHECK (num_nonnulls("activity"."contact_id", "activity"."company_id", "activity"."deal_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_contact_id" ON "activity" USING btree ("contact_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_company_id" ON "activity" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_deal_id" ON "activity" USING btree ("deal_id","created_at");