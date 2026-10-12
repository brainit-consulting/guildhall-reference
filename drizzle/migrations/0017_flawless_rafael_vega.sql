CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"client_id" uuid NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"budget" numeric(12, 2) NOT NULL,
	"start_on" date NOT NULL,
	"end_on" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_status" CHECK ("project"."status" in ('Active', 'Done')),
	CONSTRAINT "project_ends_after_start" CHECK ("project"."end_on" >= "project"."start_on"),
	CONSTRAINT "project_budget" CHECK ("project"."budget" >= 0)
);
--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_client_id" ON "project" USING btree ("client_id");