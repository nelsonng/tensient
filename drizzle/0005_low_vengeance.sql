CREATE TABLE "workspace_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"display_name" text NOT NULL,
	"email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "assignee_person_id" uuid;--> statement-breakpoint
ALTER TABLE "workspace_people" ADD CONSTRAINT "workspace_people_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_people" ADD CONSTRAINT "workspace_people_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_workspace_people_workspace" ON "workspace_people" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_workspace_people_user" ON "workspace_people" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_workspace_people_workspace_email" ON "workspace_people" USING btree ("workspace_id","email");--> statement-breakpoint
INSERT INTO "workspace_people" ("workspace_id", "user_id", "display_name", "email")
SELECT DISTINCT
	"tasks"."workspace_id",
	"users"."id",
	COALESCE(NULLIF(trim(concat_ws(' ', "users"."first_name", "users"."last_name")), ''), "users"."email", "users"."id"::text),
	"users"."email"
FROM "tasks"
INNER JOIN "users" ON "users"."id" = "tasks"."assignee_id"
WHERE "tasks"."assignee_id" IS NOT NULL
ON CONFLICT ("workspace_id", "email") DO NOTHING;--> statement-breakpoint
UPDATE "tasks"
SET "assignee_person_id" = "workspace_people"."id"
FROM "workspace_people"
WHERE "tasks"."workspace_id" = "workspace_people"."workspace_id"
	AND "tasks"."assignee_id" = "workspace_people"."user_id"
	AND "tasks"."assignee_person_id" IS NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_person_id_workspace_people_id_fk" FOREIGN KEY ("assignee_person_id") REFERENCES "public"."workspace_people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tasks_assignee_person" ON "tasks" USING btree ("assignee_person_id");