ALTER TABLE "deal" ADD COLUMN "won_on" date;--> statement-breakpoint
CREATE INDEX "deal_won_on" ON "deal" USING btree ("won_on");--> statement-breakpoint
-- Deals already at Won: the day of their latest move into Won, else of their last edit. Timestamps are stored as UTC
-- wall time (as Drizzle reads them); the day is the business's (TIME_ZONE in src/lib/dates.ts when this was written).
UPDATE "deal" SET "won_on" = ((coalesce(
	(SELECT max("activity"."created_at") FROM "activity"
		WHERE "activity"."deal_id" = "deal"."id" AND "activity"."kind" = 'stage_change' AND "activity"."body" LIKE 'Moved from % to Won'),
	"deal"."updated_at"
) AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York')::date
WHERE "deal"."stage" = 'Won';
