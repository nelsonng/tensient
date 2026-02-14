import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  real,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
  vector,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── Enums ──────────────────────────────────────────────────────────────

export const membershipRoleEnum = pgEnum("membership_role", [
  "owner",
  "member",
  "observer",
]);

export const protocolOwnerTypeEnum = pgEnum("protocol_owner_type", [
  "system",
  "organization",
  "workspace",
  "user",
]);

export const userTierEnum = pgEnum("user_tier", [
  "trial",
  "active",
  "suspended",
]);

export const messageRoleEnum = pgEnum("message_role", ["user", "assistant"]);

export const brainDocumentScopeEnum = pgEnum("brain_document_scope", [
  "personal",
  "workspace",
  "org",
]);

// ── Organizations ──────────────────────────────────────────────────────

export const organizations = pgTable("organizations", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  billingEmail: text("billing_email"),
  domain: text("domain"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Users ──────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified"), // null = unverified
  firstName: text("first_name"),
  lastName: text("last_name"),
  passwordHash: text("password_hash"),
  organizationId: uuid("organization_id").references(() => organizations.id),
  tier: userTierEnum("tier").notNull().default("trial"),
  isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
  signupIp: text("signup_ip"),
  signupCity: text("signup_city"),
  signupRegion: text("signup_region"),
  signupCountry: text("signup_country"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Protocols (Coaches in UI) ──────────────────────────────────────────

export const protocols = pgTable(
  "protocols",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    description: text("description"),
    systemPrompt: text("system_prompt").notNull(),
    schemaDef: jsonb("schema_def"),
    rewardLogic: jsonb("reward_logic"),
    category: text("category"),

    // Ownership & scoping
    ownerType: protocolOwnerTypeEnum("owner_type").notNull().default("system"),
    ownerId: uuid("owner_id"), // Polymorphic: org, workspace, or user id
    createdBy: uuid("created_by").references(() => users.id),

    // Marketplace
    isPublic: boolean("is_public").default(false).notNull(),
    parentId: uuid("parent_id"), // Self-referencing FK for fork chains
    version: integer("version").default(1).notNull(),
    usageCount: integer("usage_count").default(0).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_protocols_owner").on(table.ownerType, table.ownerId),
    index("idx_protocols_public").on(table.isPublic),
    index("idx_protocols_category").on(table.category),
  ]
);

// ── Workspaces ─────────────────────────────────────────────────────────

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    joinCode: text("join_code").notNull().unique(),
    activeProtocolId: uuid("active_protocol_id").references(
      () => protocols.id
    ),
    ghostTeam: jsonb("ghost_team"), // [{ name: string, role: string }] from onboarding ramble
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_workspaces_join_code").on(table.joinCode),
  ]
);

// ── Memberships (PLG Engine) ───────────────────────────────────────────

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id)
      .notNull(),
    role: membershipRoleEnum("role").notNull().default("member"),

    // Gamification
    lastCaptureAt: timestamp("last_capture_at"),
    streakCount: integer("streak_count").default(0).notNull(),
    tractionScore: real("traction_score").default(0).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_memberships_user_workspace").on(
      table.userId,
      table.workspaceId
    ),
  ]
);

// ── Conversations ──────────────────────────────────────────────────────

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id)
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    title: text("title"), // AI-generated, user-renamable
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_conversations_workspace").on(table.workspaceId),
    index("idx_conversations_user").on(table.userId),
    index("idx_conversations_updated").on(table.updatedAt),
  ]
);

// ── Messages ───────────────────────────────────────────────────────────

export const messages = pgTable(
  "messages",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    audioUrl: text("audio_url"), // Vercel Blob URL for voice input
    attachments: jsonb("attachments"), // [{url, filename, contentType, sizeBytes}]
    metadata: jsonb("metadata"), // scores, actions, coaching questions, alignment explanation
    coachIds: jsonb("coach_ids"), // array of coach UUIDs active for this turn
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_messages_conversation").on(table.conversationId),
    index("idx_messages_created").on(table.createdAt),
  ]
);

// ── Brain Documents (Personal Brain + Workspace Canon) ─────────────────

export const brainDocuments = pgTable(
  "brain_documents",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id)
      .notNull(),
    orgId: uuid("org_id").references(() => organizations.id), // for future org-level Canon
    userId: uuid("user_id").references(() => users.id), // null = shared Canon, non-null = personal Brain
    scope: brainDocumentScopeEnum("scope").notNull().default("personal"),
    title: text("title").notNull(),
    content: text("content"), // markdown or extracted text from uploaded file
    fileUrl: text("file_url"), // Vercel Blob URL for uploaded files
    fileType: text("file_type"), // pdf, image, etc.
    fileName: text("file_name"), // original filename
    embedding: vector("embedding", { dimensions: 1536 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_brain_documents_workspace").on(table.workspaceId),
    index("idx_brain_documents_user").on(table.userId),
    index("idx_brain_documents_scope").on(table.scope),
  ]
);

// ── Password Reset Tokens ───────────────────────────────────────────────

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    token: text("token").notNull(), // SHA-256 hash of the raw token
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_password_reset_tokens_user").on(table.userId),
    index("idx_password_reset_tokens_token").on(table.token),
  ]
);

// ── Email Verification Tokens ──────────────────────────────────────────

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    token: text("token").notNull(), // SHA-256 hash of the raw token
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_email_verification_tokens_user").on(table.userId),
    index("idx_email_verification_tokens_token").on(table.token),
  ]
);

// ── Platform Events (Admin Observability) ─────────────────────────────

export const platformEventTypeEnum = pgEnum("platform_event_type", [
  // Lifecycle
  "sign_up_started",
  "sign_up_completed",
  "sign_up_failed",
  "sign_in_success",
  "sign_in_failed",
  "onboarding_started",
  "onboarding_completed",
  // Product usage
  "strategy_created",
  "capture_submitted",
  "synthesis_generated",
  "digest_generated",
  "action_created",
  "transcription_started",
  "transcription_completed",
  "transcription_failed",
  // V2 events
  "conversation_created",
  "message_sent",
  "brain_document_created",
  "canon_document_created",
  // Errors
  "api_error",
  "client_error",
]);

export const platformEvents = pgTable(
  "platform_events",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    type: platformEventTypeEnum("type").notNull(),
    userId: uuid("user_id").references(() => users.id),
    workspaceId: uuid("workspace_id").references(() => workspaces.id),
    organizationId: uuid("organization_id").references(() => organizations.id),
    metadata: jsonb("metadata"), // flexible payload: error message, stack, route, context
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_platform_events_type").on(table.type),
    index("idx_platform_events_created").on(table.createdAt),
    index("idx_platform_events_user").on(table.userId),
  ]
);

// ── Usage Logs (Cost Control) ──────────────────────────────────────────

export const usageLogs = pgTable(
  "usage_logs",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id)
      .notNull(),
    operation: text("operation").notNull(), // 'conversation' | 'brain' | 'canon'
    inputTokens: integer("input_tokens").default(0).notNull(),
    outputTokens: integer("output_tokens").default(0).notNull(),
    estimatedCostCents: integer("estimated_cost_cents").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_usage_logs_user").on(table.userId),
    index("idx_usage_logs_created").on(table.createdAt),
  ]
);
