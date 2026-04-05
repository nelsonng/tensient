CREATE TABLE "slack_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"slack_team_id" text NOT NULL,
	"slack_team_name" text NOT NULL,
	"slack_channel_id" text NOT NULL,
	"slack_channel_name" text NOT NULL,
	"bot_token" text NOT NULL,
	"installed_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "slack_connections_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
ALTER TABLE "feedback_submissions" ADD COLUMN "slack_message_id" text;--> statement-breakpoint
ALTER TABLE "slack_connections" ADD CONSTRAINT "slack_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_connections" ADD CONSTRAINT "slack_connections_installed_by_user_id_users_id_fk" FOREIGN KEY ("installed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_slack_connections_workspace" ON "slack_connections" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_slack_connections_team" ON "slack_connections" USING btree ("slack_team_id");