ALTER TABLE "api_keys" ADD COLUMN "scope" text DEFAULT 'secret' NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "allowed_origins" text[];