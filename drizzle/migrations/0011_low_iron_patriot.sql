ALTER TABLE "activity" ADD COLUMN "source" text;--> statement-breakpoint
-- Notes enquiries already wrote: the first note with no person on each enquiry's deal (written with the deal).
UPDATE "activity" SET "source" = 'Web form'
WHERE "id" IN (
  SELECT DISTINCT ON ("activity"."deal_id") "activity"."id" FROM "activity"
  JOIN "enquiry" ON "enquiry"."deal_id" = "activity"."deal_id"
  WHERE "activity"."kind" = 'note'
  ORDER BY "activity"."deal_id", "activity"."created_at", "activity"."id"
) AND "user_id" IS NULL;
