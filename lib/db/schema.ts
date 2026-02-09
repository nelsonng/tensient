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

export const captureSourceEnum = pgEnum("capture_source", [
  "web",
  "slack",
  "voice",
  "api",
]);

export const protocolOwnerTypeEnum = pgEnum("protocol_owner_type", [
  "system",
  "organization",
  "workspace",
  "user",
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
  firstName: text("first_name"),
  lastName: text("last_name"),
  passwordHash: text("password_hash"),
  organizationId: uuid("organization_id").references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Protocols (Marketplace-Ready) ──────────────────────────────────────

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

// ── Canons (Strategic Truth) ───────────────────────────────────────────

export const canons = pgTable("canons", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id)
    .notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),
  rawInput: text("raw_input"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Captures (Raw Input) ───────────────────────────────────────────────

export const captures = pgTable(
  "captures",
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
    content: text("content").notNull(),
    source: captureSourceEnum("source").notNull().default("web"),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_captures_workspace").on(table.workspaceId),
    index("idx_captures_user").on(table.userId),
  ]
);

// ── Artifacts (Processed Truth) ────────────────────────────────────────

export const artifacts = pgTable(
  "artifacts",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    captureId: uuid("capture_id")
      .references(() => captures.id)
      .notNull(),
    canonId: uuid("canon_id").references(() => canons.id),
    driftScore: real("drift_score"), // 0.0 to 1.0
    sentimentScore: real("sentiment_score"), // -1.0 to 1.0
    content: text("content"),
    actionItems: jsonb("action_items"), // [{ task: string, status: string }]
    feedback: text("feedback"),
    embedding: vector("embedding", { dimensions: 1536 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_artifacts_capture").on(table.captureId),
    index("idx_artifacts_canon").on(table.canonId),
  ]
);
