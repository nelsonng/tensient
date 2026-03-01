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
  foreignKey,
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
  "synthesis",
]);

export const signalPriorityEnum = pgEnum("signal_priority", [
  "critical",
  "high",
  "medium",
  "low",
]);

export const signalStatusEnum = pgEnum("signal_status", [
  "open",
  "resolved",
  "dismissed",
]);

export const signalSourceEnum = pgEnum("signal_source", ["web", "mcp"]);

export const synthesisTriggerEnum = pgEnum("synthesis_trigger", [
  "conversation_end",
  "manual",
  "scheduled",
]);

export const synthesisChangeTypeEnum = pgEnum("synthesis_change_type", [
  "created",
  "modified",
  "deleted",
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
    parentDocumentId: uuid("parent_document_id"),
    chunkIndex: integer("chunk_index"),
    embedding: vector("embedding", { dimensions: 1536 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.parentDocumentId],
      foreignColumns: [table.id],
      name: "fk_brain_documents_parent",
    }).onDelete("cascade"),
    index("idx_brain_documents_workspace").on(table.workspaceId),
    index("idx_brain_documents_user").on(table.userId),
    index("idx_brain_documents_scope").on(table.scope),
    index("idx_brain_documents_parent_document").on(table.parentDocumentId),
    index("idx_brain_documents_parent_chunk").on(table.parentDocumentId, table.chunkIndex),
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
  "sign_up_started",
  "sign_up_completed",
  "sign_up_failed",
  "sign_in_success",
  "sign_in_failed",
  "capture_submitted",
  "synthesis_generated",
  "onboarding_started",
  "onboarding_completed",
  "transcription_started",
  "transcription_completed",
  "transcription_failed",
  "conversation_created",
  "message_sent",
  "brain_document_created",
  "canon_document_created",
  "workspace_joined",
  "workspace_created",
  "signal_extracted",
  "synthesis_completed",
  "usage_blocked",
  "api_error",
  "client_error",
  "mcp_connection",
  "mcp_tool_called",
  "mcp_auth_failed",
  "api_key_created",
  "api_key_revoked",
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

// ── Signals ──────────────────────────────────────────────────────────────

export const signals = pgTable(
  "signals",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "cascade",
    }),
    messageId: uuid("message_id").references(() => messages.id, {
      onDelete: "cascade",
    }),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    aiPriority: signalPriorityEnum("ai_priority"),
    humanPriority: signalPriorityEnum("human_priority"),
    status: signalStatusEnum("status").notNull().default("open"),
    reviewedAt: timestamp("reviewed_at"),
    source: signalSourceEnum("source").notNull().default("web"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_signals_workspace").on(table.workspaceId),
    index("idx_signals_conversation").on(table.conversationId),
    index("idx_signals_message").on(table.messageId),
    index("idx_signals_created").on(table.createdAt),
  ]
);

// ── Synthesis Commits (DAG) ─────────────────────────────────────────────

export const synthesisCommits = pgTable(
  "synthesis_commits",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    parentId: uuid("parent_id"),
    summary: text("summary").notNull(),
    trigger: synthesisTriggerEnum("trigger").notNull(),
    signalCount: integer("signal_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: "fk_synthesis_commits_parent",
    }),
    index("idx_synthesis_commits_workspace").on(table.workspaceId),
    index("idx_synthesis_commits_parent").on(table.parentId),
    index("idx_synthesis_commits_created").on(table.createdAt),
  ]
);

// ── Synthesis Document Versions ──────────────────────────────────────────

export const synthesisDocumentVersions = pgTable(
  "synthesis_document_versions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    documentId: uuid("document_id")
      .references(() => brainDocuments.id, { onDelete: "cascade" })
      .notNull(),
    commitId: uuid("commit_id")
      .references(() => synthesisCommits.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").notNull(),
    content: text("content"),
    changeType: synthesisChangeTypeEnum("change_type").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_synthesis_document_versions_document").on(table.documentId),
    index("idx_synthesis_document_versions_commit").on(table.commitId),
  ]
);

// ── Synthesis Commit Signals ─────────────────────────────────────────────

export const synthesisCommitSignals = pgTable(
  "synthesis_commit_signals",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    commitId: uuid("commit_id")
      .references(() => synthesisCommits.id, { onDelete: "cascade" })
      .notNull(),
    signalId: uuid("signal_id")
      .references(() => signals.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => [
    uniqueIndex("idx_synthesis_commit_signals_unique").on(
      table.commitId,
      table.signalId
    ),
    index("idx_synthesis_commit_signals_commit").on(table.commitId),
    index("idx_synthesis_commit_signals_signal").on(table.signalId),
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

// ── API Keys (MCP Auth) ────────────────────────────────────────────────

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    lastUsedAt: timestamp("last_used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => [
    index("idx_api_keys_user").on(table.userId),
    index("idx_api_keys_workspace").on(table.workspaceId),
    index("idx_api_keys_active").on(table.revokedAt),
  ]
);
