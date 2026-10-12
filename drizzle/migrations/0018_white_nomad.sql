CREATE SEQUENCE "public"."invoice_number" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "business_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "business_settings_one_row" CHECK ("business_settings"."id" = 1),
	CONSTRAINT "business_settings_tax_rate" CHECK ("business_settings"."tax_rate" >= 0 and "business_settings"."tax_rate" <= 100)
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer DEFAULT nextval('invoice_number') NOT NULL,
	"client_id" uuid NOT NULL,
	"project_id" uuid,
	"issue_on" date NOT NULL,
	"due_on" date NOT NULL,
	"tax_rate" numeric(5, 2) NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_number_unique" UNIQUE("number"),
	CONSTRAINT "invoice_status" CHECK ("invoice"."status" in ('Draft', 'Sent', 'Paid')),
	CONSTRAINT "invoice_due_after_issue" CHECK ("invoice"."due_on" >= "invoice"."issue_on"),
	CONSTRAINT "invoice_tax_rate" CHECK ("invoice"."tax_rate" >= 0 and "invoice"."tax_rate" <= 100)
);
--> statement-breakpoint
CREATE TABLE "invoice_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	CONSTRAINT "invoice_line_quantity" CHECK ("invoice_line"."quantity" > 0),
	CONSTRAINT "invoice_line_unit_price" CHECK ("invoice_line"."unit_price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_client_id" ON "invoice" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "invoice_project_id" ON "invoice" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_line_position" ON "invoice_line" USING btree ("invoice_id","position");