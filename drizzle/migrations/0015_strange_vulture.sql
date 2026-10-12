CREATE TABLE "agent_last_use" (
	"client_id" text NOT NULL,
	"user_id" text NOT NULL,
	"used_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_last_use_client_id_user_id_pk" PRIMARY KEY("client_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "agent_last_use" ADD CONSTRAINT "agent_last_use_client_id_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_client"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_last_use" ADD CONSTRAINT "agent_last_use_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;