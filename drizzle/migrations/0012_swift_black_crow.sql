CREATE TYPE "public"."task_automation" AS ENUM('won_follow_up', 'cold_check_in');--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "automation" "task_automation";--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "cold_since" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "task_one_won_follow_up" ON "task" USING btree ("deal_id") WHERE "task"."automation" = 'won_follow_up';--> statement-breakpoint
CREATE UNIQUE INDEX "task_one_check_in_per_cold_spell" ON "task" USING btree ("deal_id","cold_since") WHERE "task"."automation" = 'cold_check_in';--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_automation_on_deal" CHECK ("task"."automation" is null or "task"."deal_id" is not null);--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_cold_since_on_check_in" CHECK (("task"."automation" is not distinct from 'cold_check_in') = ("task"."cold_since" is not null));