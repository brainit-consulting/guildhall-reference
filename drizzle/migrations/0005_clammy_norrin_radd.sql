CREATE TYPE "public"."deal_stage" AS ENUM('New', 'Contacted', 'Proposal', 'Won', 'Lost');--> statement-breakpoint
CREATE TABLE "deal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"value" numeric(12, 2),
	"stage" "deal_stage" DEFAULT 'New' NOT NULL,
	"contact_id" uuid,
	"company_id" uuid,
	"expected_close" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deal_created_at" ON "deal" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "deal_by_stage" ON "deal" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "deal_contact_id" ON "deal" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "deal_company_id" ON "deal" USING btree ("company_id");