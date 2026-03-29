CREATE TYPE "public"."brain_document_scope" AS ENUM('personal', 'workspace', 'org', 'synthesis');--> statement-breakpoint
CREATE TYPE "public"."feedback_category" AS ENUM('bug_report', 'feature_request', 'help_request', 'urgent_issue');--> statement-breakpoint
CREATE TYPE "public"."feedback_reply_author_type" AS ENUM('team', 'submitter', 'ai');--> statement-breakpoint
CREATE TYPE "public"."feedback_status" AS ENUM('new', 'ai_processed', 'escalated', 'auto_responded', 'reviewing', 'awaiting_response', 'converted', 'resolved', 'spam');--> statement-breakpoint
CREATE TYPE "public"."feedback_submitter_type" AS ENUM('human', 'ai_agent');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('owner', 'member', 'observer');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."platform_event_type" AS ENUM('sign_up_started', 'sign_up_completed', 'sign_up_failed', 'sign_in_success', 'sign_in_failed', 'capture_submitted', 'synthesis_generated', 'onboarding_started', 'onboarding_completed', 'transcription_started', 'transcription_completed', 'transcription_failed', 'conversation_created', 'message_sent', 'brain_document_created', 'canon_document_created', 'workspace_joined', 'workspace_created', 'signal_extracted', 'synthesis_completed', 'usage_blocked', 'api_error', 'client_error', 'mcp_connection', 'mcp_tool_called', 'mcp_auth_failed', 'api_key_created', 'api_key_revoked', 'feedback_submitted');--> statement-breakpoint
CREATE TYPE "public"."protocol_owner_type" AS ENUM('system', 'organization', 'workspace', 'user');--> statement-breakpoint
CREATE TYPE "public"."signal_priority" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."signal_source" AS ENUM('web', 'mcp', 'feedback');--> statement-breakpoint
CREATE TYPE "public"."signal_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."synthesis_change_type" AS ENUM('created', 'modified', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."synthesis_trigger" AS ENUM('conversation_end', 'manual', 'scheduled');--> statement-breakpoint
CREATE TYPE "public"."user_tier" AS ENUM('trial', 'active', 'suspended');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "brain_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"org_id" uuid,
	"user_id" uuid,
	"scope" "brain_document_scope" DEFAULT 'personal' NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"file_url" text,
	"file_type" text,
	"file_name" text,
	"parent_document_id" uuid,
	"chunk_index" integer,
	"embedding" vector(1536),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "feedback_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feedback_submission_id" uuid NOT NULL,
	"content" text NOT NULL,
	"author_type" "feedback_reply_author_type" NOT NULL,
	"author_name" text,
	"author_user_id" uuid,
	"is_internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"api_key_id" uuid,
	"tracking_id" text NOT NULL,
	"category" "feedback_category" NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"submitter_type" "feedback_submitter_type" DEFAULT 'human' NOT NULL,
	"submitter_email" text,
	"submitter_name" text,
	"submitter_external_id" text,
	"submitter_is_authenticated" boolean,
	"submitter_meta" jsonb,
	"current_url" text,
	"referrer_url" text,
	"page_title" text,
	"user_agent" text,
	"locale" text,
	"timezone" text,
	"ip_address" text,
	"geo_city" text,
	"geo_region" text,
	"geo_country" text,
	"browser_info" jsonb,
	"screen_info" jsonb,
	"hardware_info" jsonb,
	"network_info" jsonb,
	"performance_data" jsonb,
	"console_errors" jsonb,
	"device_fingerprint" jsonb,
	"custom_context" jsonb,
	"tags" text[],
	"priority" "signal_priority",
	"assignee_id" uuid,
	"embedding" vector(1536),
	"ai_priority" "signal_priority",
	"ai_category" "feedback_category",
	"ai_summary" text,
	"ai_confidence" real,
	"ai_response_draft" text,
	"sentiment_score" real,
	"fraud_risk_score" real,
	"duplicate_of_id" uuid,
	"ai_processed_at" timestamp,
	"status" "feedback_status" DEFAULT 'new' NOT NULL,
	"signal_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_submissions_tracking_id_unique" UNIQUE("tracking_id")
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"role" "membership_role" DEFAULT 'member' NOT NULL,
	"streak_count" integer DEFAULT 0 NOT NULL,
	"traction_score" real DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"audio_url" text,
	"attachments" jsonb,
	"metadata" jsonb,
	"coach_ids" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" uuid,
	"message_id" uuid,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"ai_priority" "signal_priority",
	"human_priority" "signal_priority",
	"status" "signal_status" DEFAULT 'open' NOT NULL,
	"reviewed_at" timestamp,
	"source" "signal_source" DEFAULT 'web' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "synthesis_commit_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commit_id" uuid NOT NULL,
	"signal_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "synthesis_commits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"parent_id" uuid,
	"summary" text NOT NULL,
	"trigger" "synthesis_trigger" NOT NULL,
	"signal_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "synthesis_document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"commit_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"change_type" "synthesis_change_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
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
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_documents" ADD CONSTRAINT "brain_documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_documents" ADD CONSTRAINT "brain_documents_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_documents" ADD CONSTRAINT "brain_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_documents" ADD CONSTRAINT "fk_brain_documents_parent" FOREIGN KEY ("parent_document_id") REFERENCES "public"."brain_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_replies" ADD CONSTRAINT "feedback_replies_feedback_submission_id_feedback_submissions_id_fk" FOREIGN KEY ("feedback_submission_id") REFERENCES "public"."feedback_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_replies" ADD CONSTRAINT "feedback_replies_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_submissions" ADD CONSTRAINT "feedback_submissions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_submissions" ADD CONSTRAINT "feedback_submissions_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_submissions" ADD CONSTRAINT "feedback_submissions_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_submissions" ADD CONSTRAINT "feedback_submissions_signal_id_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_submissions" ADD CONSTRAINT "fk_feedback_submissions_duplicate" FOREIGN KEY ("duplicate_of_id") REFERENCES "public"."feedback_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_events" ADD CONSTRAINT "platform_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_events" ADD CONSTRAINT "platform_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_events" ADD CONSTRAINT "platform_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocols" ADD CONSTRAINT "protocols_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synthesis_commit_signals" ADD CONSTRAINT "synthesis_commit_signals_commit_id_synthesis_commits_id_fk" FOREIGN KEY ("commit_id") REFERENCES "public"."synthesis_commits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synthesis_commit_signals" ADD CONSTRAINT "synthesis_commit_signals_signal_id_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synthesis_commits" ADD CONSTRAINT "synthesis_commits_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synthesis_commits" ADD CONSTRAINT "fk_synthesis_commits_parent" FOREIGN KEY ("parent_id") REFERENCES "public"."synthesis_commits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synthesis_document_versions" ADD CONSTRAINT "synthesis_document_versions_document_id_brain_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."brain_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synthesis_document_versions" ADD CONSTRAINT "synthesis_document_versions_commit_id_synthesis_commits_id_fk" FOREIGN KEY ("commit_id") REFERENCES "public"."synthesis_commits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_active_protocol_id_protocols_id_fk" FOREIGN KEY ("active_protocol_id") REFERENCES "public"."protocols"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_api_keys_user" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_api_keys_workspace" ON "api_keys" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_api_keys_active" ON "api_keys" USING btree ("revoked_at");--> statement-breakpoint
CREATE INDEX "idx_brain_documents_workspace" ON "brain_documents" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_brain_documents_user" ON "brain_documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_brain_documents_scope" ON "brain_documents" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "idx_brain_documents_parent_document" ON "brain_documents" USING btree ("parent_document_id");--> statement-breakpoint
CREATE INDEX "idx_brain_documents_parent_chunk" ON "brain_documents" USING btree ("parent_document_id","chunk_index");--> statement-breakpoint
CREATE INDEX "idx_conversations_workspace" ON "conversations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_user" ON "conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_updated" ON "conversations" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_email_verification_tokens_user" ON "email_verification_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_email_verification_tokens_token" ON "email_verification_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_feedback_replies_submission" ON "feedback_replies" USING btree ("feedback_submission_id");--> statement-breakpoint
CREATE INDEX "idx_feedback_replies_created" ON "feedback_replies" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_feedback_submissions_workspace" ON "feedback_submissions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_feedback_submissions_status" ON "feedback_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_feedback_submissions_category" ON "feedback_submissions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_feedback_submissions_priority" ON "feedback_submissions" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_feedback_submissions_assignee" ON "feedback_submissions" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "idx_feedback_submissions_created" ON "feedback_submissions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_feedback_submissions_ip" ON "feedback_submissions" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "idx_feedback_submissions_duplicate" ON "feedback_submissions" USING btree ("duplicate_of_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_memberships_user_workspace" ON "memberships" USING btree ("user_id","workspace_id");--> statement-breakpoint
CREATE INDEX "idx_messages_conversation" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_messages_created" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_user" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_token" ON "password_reset_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_platform_events_type" ON "platform_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_platform_events_created" ON "platform_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_platform_events_user" ON "platform_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_protocols_owner" ON "protocols" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "idx_protocols_public" ON "protocols" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "idx_protocols_category" ON "protocols" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_signals_workspace" ON "signals" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_signals_conversation" ON "signals" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_signals_message" ON "signals" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_signals_created" ON "signals" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_synthesis_commit_signals_unique" ON "synthesis_commit_signals" USING btree ("commit_id","signal_id");--> statement-breakpoint
CREATE INDEX "idx_synthesis_commit_signals_commit" ON "synthesis_commit_signals" USING btree ("commit_id");--> statement-breakpoint
CREATE INDEX "idx_synthesis_commit_signals_signal" ON "synthesis_commit_signals" USING btree ("signal_id");--> statement-breakpoint
CREATE INDEX "idx_synthesis_commits_workspace" ON "synthesis_commits" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_synthesis_commits_parent" ON "synthesis_commits" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_synthesis_commits_created" ON "synthesis_commits" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_synthesis_document_versions_document" ON "synthesis_document_versions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_synthesis_document_versions_commit" ON "synthesis_document_versions" USING btree ("commit_id");--> statement-breakpoint
CREATE INDEX "idx_usage_logs_user" ON "usage_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_usage_logs_created" ON "usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_workspaces_join_code" ON "workspaces" USING btree ("join_code");