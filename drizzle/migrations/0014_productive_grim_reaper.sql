CREATE TABLE "agent_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" text NOT NULL,
	"agent_name" text NOT NULL,
	"user_id" text,
	"tool" text NOT NULL,
	"summary" text NOT NULL,
	"record_type" text,
	"record_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_log_record" CHECK (("agent_log"."record_type" is null) = ("agent_log"."record_id" is null)),
	CONSTRAINT "agent_log_record_type" CHECK ("agent_log"."record_type" in ('contact', 'company', 'deal'))
);
--> statement-breakpoint
ALTER TABLE "agent_log" ADD CONSTRAINT "agent_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_log_created_at" ON "agent_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "agent_log_client_id" ON "agent_log" USING btree ("client_id","created_at");