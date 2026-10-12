CREATE TABLE "client" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"made_from" text NOT NULL,
	"company_id" uuid,
	"contact_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_made_from" CHECK ("client"."made_from" in ('company', 'contact'))
);
--> statement-breakpoint
ALTER TABLE "deal" ADD COLUMN "client_id" uuid;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_one_per_company" ON "client" USING btree ("company_id") WHERE "client"."made_from" = 'company';--> statement-breakpoint
CREATE UNIQUE INDEX "client_one_per_contact" ON "client" USING btree ("contact_id") WHERE "client"."made_from" = 'contact';--> statement-breakpoint
CREATE INDEX "client_contact_id" ON "client" USING btree ("contact_id");--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deal_client_id" ON "deal" USING btree ("client_id");