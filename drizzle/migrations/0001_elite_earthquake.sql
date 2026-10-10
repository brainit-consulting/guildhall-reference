CREATE TABLE "allowed_email" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "allowed_email_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "user_one_owner" ON "user" USING btree ("role") WHERE "user"."role" = 'owner';--> statement-breakpoint
-- Copies that already have accounts (from before B6): the earliest one is the owner.
UPDATE "user" SET "role" = 'owner' WHERE "id" = (SELECT "id" FROM "user" ORDER BY "created_at", "id" LIMIT 1) AND NOT EXISTS (SELECT 1 FROM "user" WHERE "role" = 'owner');
