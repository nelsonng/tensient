CREATE TYPE "public"."action_priority" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."action_status" AS ENUM('open', 'in_progress', 'blocked', 'done', 'wont_do');--> statement-breakpoint
CREATE TYPE "public"."capture_source" AS ENUM('web', 'slack', 'voice', 'api');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('owner', 'member', 'observer');--> statement-breakpoint
CREATE TYPE "public"."platform_event_type" AS ENUM('sign_up_started', 'sign_up_completed', 'sign_up_failed', 'sign_in_success', 'sign_in_failed', 'onboarding_started', 'onboarding_completed', 'strategy_created', 'capture_submitted', 'synthesis_generated', 'digest_generated', 'action_created', 'transcription_started', 'transcription_completed', 'transcription_failed', 'api_error', 'client_error');--> statement-breakpoint
CREATE TYPE "public"."protocol_owner_type" AS ENUM('system', 'organization', 'workspace', 'user');--> statement-breakpoint
CREATE TYPE "public"."user_tier" AS ENUM('trial', 'active', 'suspended');--> statement-breakpoint
CREATE TABLE "actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"artifact_id" uuid,
	"goal_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" "action_status" DEFAULT 'open' NOT NULL,
	"priority" "action_priority" DEFAULT 'medium' NOT NULL,
	"goal_alignment_score" real,
	"coach_attribution" text,
	"goal_pillar" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capture_id" uuid NOT NULL,
	"canon_id" uuid,
	"drift_score" real,
	"sentiment_score" real,
	"content" text,
	"action_items" jsonb,
	"feedback" text,
	"goal_pillar" text,
	"embedding" vector(1536),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"raw_input" text,
	"health_score" real,
	"health_analysis" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "captures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"content" text NOT NULL,
	"source" "capture_source" DEFAULT 'web' NOT NULL,
	"audio_url" text,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"week_start" timestamp NOT NULL,
	"items" jsonb NOT NULL,
	"summary" text,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"role" "membership_role" DEFAULT 'member' NOT NULL,
	"last_capture_at" timestamp,
	"streak_count" integer DEFAULT 0 NOT NULL,
	"traction_score" real DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"billing_email" text,
	"domain" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "platform_event_type" NOT NULL,
	"user_id" uuid,
	"workspace_id" uuid,
	"organization_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "protocols" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"system_prompt" text NOT NULL,
	"schema_def" jsonb,
	"reward_logic" jsonb,
	"category" text,
	"owner_type" "protocol_owner_type" DEFAULT 'system' NOT NULL,
	"owner_id" uuid,
	"created_by" uuid,
	"is_public" boolean DEFAULT false NOT NULL,
	"parent_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified" timestamp,
	"first_name" text,
	"last_name" text,
	"password_hash" text,
	"organization_id" uuid,
	"tier" "user_tier" DEFAULT 'trial' NOT NULL,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"signup_ip" text,
	"signup_city" text,
	"signup_region" text,
	"signup_country" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"join_code" text NOT NULL,
	"active_protocol_id" uuid,
	"ghost_team" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_join_code_unique" UNIQUE("join_code")
);
--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_goal_id_canons_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."canons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_capture_id_captures_id_fk" FOREIGN KEY ("capture_id") REFERENCES "public"."captures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_canon_id_canons_id_fk" FOREIGN KEY ("canon_id") REFERENCES "public"."canons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canons" ADD CONSTRAINT "canons_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captures" ADD CONSTRAINT "captures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captures" ADD CONSTRAINT "captures_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digests" ADD CONSTRAINT "digests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_events" ADD CONSTRAINT "platform_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_events" ADD CONSTRAINT "platform_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_events" ADD CONSTRAINT "platform_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocols" ADD CONSTRAINT "protocols_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_active_protocol_id_protocols_id_fk" FOREIGN KEY ("active_protocol_id") REFERENCES "public"."protocols"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_actions_workspace" ON "actions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_actions_user" ON "actions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_actions_status" ON "actions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_actions_goal" ON "actions" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "idx_artifacts_capture" ON "artifacts" USING btree ("capture_id");--> statement-breakpoint
CREATE INDEX "idx_artifacts_canon" ON "artifacts" USING btree ("canon_id");--> statement-breakpoint
CREATE INDEX "idx_captures_workspace" ON "captures" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_captures_user" ON "captures" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_digests_workspace_week" ON "digests" USING btree ("workspace_id","week_start");--> statement-breakpoint
CREATE INDEX "idx_email_verification_tokens_user" ON "email_verification_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_email_verification_tokens_token" ON "email_verification_tokens" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_memberships_user_workspace" ON "memberships" USING btree ("user_id","workspace_id");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_user" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_token" ON "password_reset_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_platform_events_type" ON "platform_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_platform_events_created" ON "platform_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_platform_events_user" ON "platform_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_protocols_owner" ON "protocols" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "idx_protocols_public" ON "protocols" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "idx_protocols_category" ON "protocols" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_usage_logs_user" ON "usage_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_usage_logs_created" ON "usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_workspaces_join_code" ON "workspaces" USING btree ("join_code");