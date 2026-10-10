ALTER TABLE "deal" ADD COLUMN "last_activity_at" timestamp;--> statement-breakpoint
-- Deals already in use get the latest activity logged on them, their contact or their company.
UPDATE "deal" SET "last_activity_at" = (
  SELECT max(a."created_at") FROM "activity" a
  WHERE a."deal_id" = "deal"."id" OR a."contact_id" = "deal"."contact_id" OR a."company_id" = "deal"."company_id"
);