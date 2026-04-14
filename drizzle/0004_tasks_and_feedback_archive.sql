CREATE TYPE "public"."task_feedback_relationship" AS ENUM('related', 'blocks');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('backlog', 'todo', 'in_progress', 'in_review', 'testing', 'done');--> statement-breakpoint
CREATE TABLE "task_feedback_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"feedback_submission_id" uuid NOT NULL,
	"relationship" "task_feedback_relationship" DEFAULT 'related' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'backlog' NOT NULL,
	"priority" "signal_priority",
	"assignee_id" uuid,
	"created_by_id" uuid NOT NULL,
	"position" real DEFAULT 0 NOT NULL,
	"due_date" timestamp,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback_submissions" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "task_feedback_links" ADD CONSTRAINT "task_feedback_links_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_feedback_links" ADD CONSTRAINT "task_feedback_links_feedback_submission_id_feedback_submissions_id_fk" FOREIGN KEY ("feedback_submission_id") REFERENCES "public"."feedback_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_task_feedback_links_unique" ON "task_feedback_links" USING btree ("task_id","feedback_submission_id");--> statement-breakpoint
CREATE INDEX "idx_task_feedback_links_task" ON "task_feedback_links" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_task_feedback_links_feedback" ON "task_feedback_links" USING btree ("feedback_submission_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_workspace" ON "tasks" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_status" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tasks_assignee" ON "tasks" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_position" ON "tasks" USING btree ("workspace_id","status","position");--> statement-breakpoint
CREATE INDEX "idx_tasks_archived" ON "tasks" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "idx_feedback_submissions_archived" ON "feedback_submissions" USING btree ("archived_at");