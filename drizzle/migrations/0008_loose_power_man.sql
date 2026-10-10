CREATE TABLE "task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"due_on" date NOT NULL,
	"done_at" timestamp,
	"contact_id" uuid,
	"company_id" uuid,
	"deal_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_on_one_record" CHECK (num_nonnulls("task"."contact_id", "task"."company_id", "task"."deal_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_contact_id" ON "task" USING btree ("contact_id","due_on");--> statement-breakpoint
CREATE INDEX "task_company_id" ON "task" USING btree ("company_id","due_on");--> statement-breakpoint
CREATE INDEX "task_deal_id" ON "task" USING btree ("deal_id","due_on");--> statement-breakpoint
CREATE INDEX "task_open_due_on" ON "task" USING btree ("due_on") WHERE "task"."done_at" is null;