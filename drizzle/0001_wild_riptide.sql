ALTER TABLE "feedback_submissions" ADD COLUMN "rating_value" real;--> statement-breakpoint
ALTER TABLE "feedback_submissions" ADD COLUMN "rating_scale" real;--> statement-breakpoint
ALTER TABLE "feedback_submissions" ADD COLUMN "rating_type" text;--> statement-breakpoint
ALTER TABLE "feedback_submissions" ADD COLUMN "responses" jsonb;--> statement-breakpoint
CREATE INDEX "idx_feedback_submissions_rating_type" ON "feedback_submissions" USING btree ("rating_type");