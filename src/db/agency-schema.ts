import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { accounts, agents, contactRequests, offers } from "@/db/schema";

// Canonical Agency + Commercial domain schema.
// Marketplace tables stay in schema.ts; all agency-owned operational truth lives here.

export const agencyWorkspaces = pgTable(
  "agency_workspaces",
  {
    id: serial("id").primaryKey(),
    agentId: integer("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    status: varchar("status", { length: 16 }).notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("agency_workspaces_agent_uidx").on(t.agentId),
    index("agency_workspaces_status_idx").on(t.status),
    check("agency_workspaces_status_check", sql`${t.status} IN ('active', 'suspended', 'closed')`),
  ],
);

export const agencyMemberships = pgTable(
  "agency_memberships",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => agencyWorkspaces.id, { onDelete: "cascade" }),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 16 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("agency_memberships_workspace_account_uidx").on(t.workspaceId, t.accountId),
    index("agency_memberships_account_idx").on(t.accountId),
    index("agency_memberships_workspace_status_idx").on(t.workspaceId, t.status),
    check("agency_memberships_role_check", sql`${t.role} IN ('owner', 'member')`),
    check("agency_memberships_status_check", sql`${t.status} IN ('active', 'disabled')`),
  ],
);

export const agencyDomainEvents = pgTable(
  "agency_domain_events",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => agencyWorkspaces.id, { onDelete: "restrict" }),
    actorAccountId: integer("actor_account_id").references(() => accounts.id, { onDelete: "set null" }),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    referenceType: varchar("reference_type", { length: 32 }),
    referenceId: integer("reference_id"),
    correlationId: varchar("correlation_id", { length: 80 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("agency_domain_events_workspace_created_idx").on(t.workspaceId, t.createdAt),
    index("agency_domain_events_actor_idx").on(t.actorAccountId),
    index("agency_domain_events_type_idx").on(t.eventType),
  ],
);

export const agencyClients = pgTable(
  "agency_clients",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull().references(() => agencyWorkspaces.id, { onDelete: "cascade" }),
    platformAccountId: integer("platform_account_id").references(() => accounts.id, { onDelete: "set null" }),
    displayName: text("display_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    preferredLanguage: varchar("preferred_language", { length: 16 }),
    createdByAccountId: integer("created_by_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("agency_clients_workspace_idx").on(t.workspaceId, t.createdAt),
    check("agency_clients_contact_check", sql`${t.platformAccountId} IS NOT NULL OR ${t.email} IS NOT NULL OR ${t.phone} IS NOT NULL`),
  ],
);

export const agencyOpportunities = pgTable(
  "agency_opportunities",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull().references(() => agencyWorkspaces.id, { onDelete: "cascade" }),
    clientId: integer("client_id").notNull().references(() => agencyClients.id, { onDelete: "restrict" }),
    source: varchar("source", { length: 20 }).notNull(),
    sourceContactRequestId: integer("source_contact_request_id").references(() => contactRequests.id, { onDelete: "set null" }),
    stage: varchar("stage", { length: 20 }).notNull().default("new"),
    assignedAccountId: integer("assigned_account_id").references(() => accounts.id, { onDelete: "set null" }),
    title: text("title"),
    outcomeReason: text("outcome_reason"),
    wonQuoteVersionId: integer("won_quote_version_id"),
    createdByAccountId: integer("created_by_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    closedAt: timestamp("closed_at"),
  },
  (t) => [
    index("agency_opportunities_workspace_stage_idx").on(t.workspaceId, t.stage, t.updatedAt),
    index("agency_opportunities_client_idx").on(t.clientId, t.createdAt),
    uniqueIndex("agency_opportunities_source_contact_uidx").on(t.workspaceId, t.sourceContactRequestId),
    check("agency_opportunities_source_check", sql`${t.source} IN ('marketplace','manual','referral','repeat','partner')`),
    check("agency_opportunities_stage_check", sql`${t.stage} IN ('new','qualified','sourcing','quoted','negotiating','won','lost','cancelled')`),
    check(
      "agency_opportunities_closed_check",
      sql`(${t.stage} IN ('won','lost','cancelled') AND ${t.closedAt} IS NOT NULL) OR (${t.stage} NOT IN ('won','lost','cancelled') AND ${t.closedAt} IS NULL)`,
    ),
  ],
);

export const agencyIntentVersions = pgTable(
  "agency_intent_versions",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull().references(() => agencyWorkspaces.id, { onDelete: "cascade" }),
    opportunityId: integer("opportunity_id").notNull().references(() => agencyOpportunities.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    intentSnapshot: jsonb("intent_snapshot").$type<Record<string, unknown>>().notNull(),
    provenance: jsonb("provenance").$type<Record<string, unknown>>().notNull().default({}),
    createdByAccountId: integer("created_by_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("agency_intent_versions_opportunity_revision_uidx").on(t.opportunityId, t.revision),
    index("agency_intent_versions_workspace_created_idx").on(t.workspaceId, t.createdAt),
    check("agency_intent_versions_revision_check", sql`${t.revision} > 0`),
  ],
);

export const agencySupplierOptions = pgTable(
  "agency_supplier_options",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull().references(() => agencyWorkspaces.id, { onDelete: "cascade" }),
    opportunityId: integer("opportunity_id").notNull().references(() => agencyOpportunities.id, { onDelete: "cascade" }),
    category: varchar("category", { length: 24 }).notNull(),
    supplierName: text("supplier_name").notNull(),
    description: text("description").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    costAmountMinor: bigint("cost_amount_minor", { mode: "number" }).notNull(),
    commissionExpectedMinor: bigint("commission_expected_minor", { mode: "number" }).notNull().default(0),
    sourceType: varchar("source_type", { length: 24 }).notNull(),
    sourceRef: text("source_ref"),
    observedAt: timestamp("observed_at").notNull(),
    validUntil: timestamp("valid_until"),
    status: varchar("status", { length: 16 }).notNull().default("active"),
    createdByAccountId: integer("created_by_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("agency_supplier_options_opportunity_idx").on(t.opportunityId, t.status, t.createdAt),
    check("agency_supplier_options_category_check", sql`${t.category} IN ('flight','hotel','transfer','activity','insurance','visa','fee','other')`),
    check("agency_supplier_options_source_check", sql`${t.sourceType} IN ('supplier_quote','booking_engine','contract','manual','platform')`),
    check("agency_supplier_options_status_check", sql`${t.status} IN ('active','expired','selected','rejected')`),
    check("agency_supplier_options_cost_check", sql`${t.costAmountMinor} >= 0 AND ${t.commissionExpectedMinor} >= 0`),
    check("agency_supplier_options_currency_check", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check("agency_supplier_options_validity_check", sql`${t.validUntil} IS NULL OR ${t.validUntil} >= ${t.observedAt}`),
  ],
);

export const agencyQuotes = pgTable(
  "agency_quotes",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull().references(() => agencyWorkspaces.id, { onDelete: "cascade" }),
    opportunityId: integer("opportunity_id").notNull().references(() => agencyOpportunities.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 16 }).notNull().default("draft"),
    createdByAccountId: integer("created_by_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("agency_quotes_opportunity_idx").on(t.opportunityId, t.createdAt),
    check("agency_quotes_status_check", sql`${t.status} IN ('draft','sent','accepted','declined','expired','superseded')`),
  ],
);

export const agencyQuoteVersions = pgTable(
  "agency_quote_versions",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull().references(() => agencyWorkspaces.id, { onDelete: "cascade" }),
    opportunityId: integer("opportunity_id").notNull().references(() => agencyOpportunities.id, { onDelete: "cascade" }),
    quoteId: integer("quote_id").notNull().references(() => agencyQuotes.id, { onDelete: "cascade" }),
    intentVersionId: integer("intent_version_id").notNull().references(() => agencyIntentVersions.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    costTotalMinor: bigint("cost_total_minor", { mode: "number" }).notNull(),
    sellTotalMinor: bigint("sell_total_minor", { mode: "number" }).notNull(),
    commissionExpectedMinor: bigint("commission_expected_minor", { mode: "number" }).notNull().default(0),
    grossProfitMinor: bigint("gross_profit_minor", { mode: "number" }).notNull(),
    marginBps: integer("margin_bps").notNull(),
    markupBps: integer("markup_bps").notNull(),
    linesSnapshot: jsonb("lines_snapshot").$type<Record<string, unknown>[]>().notNull(),
    clientFacingTerms: text("client_facing_terms"),
    validUntil: timestamp("valid_until"),
    integrityDigest: varchar("integrity_digest", { length: 64 }).notNull(),
    createdByAccountId: integer("created_by_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("agency_quote_versions_quote_version_uidx").on(t.quoteId, t.version),
    uniqueIndex("agency_quote_versions_digest_uidx").on(t.integrityDigest),
    index("agency_quote_versions_opportunity_idx").on(t.opportunityId, t.createdAt),
    check("agency_quote_versions_version_check", sql`${t.version} > 0`),
    check("agency_quote_versions_currency_check", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check("agency_quote_versions_totals_check", sql`${t.costTotalMinor} >= 0 AND ${t.sellTotalMinor} >= 0 AND ${t.commissionExpectedMinor} >= 0`),
    check("agency_quote_versions_digest_check", sql`${t.integrityDigest} ~ '^[0-9a-f]{64}$'`),
  ],
);

export const agencyCommercialActivities = pgTable(
  "agency_commercial_activities",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull().references(() => agencyWorkspaces.id, { onDelete: "cascade" }),
    opportunityId: integer("opportunity_id").notNull().references(() => agencyOpportunities.id, { onDelete: "cascade" }),
    quoteId: integer("quote_id").references(() => agencyQuotes.id, { onDelete: "set null" }),
    quoteVersionId: integer("quote_version_id").references(() => agencyQuoteVersions.id, { onDelete: "set null" }),
    activityType: varchar("activity_type", { length: 24 }).notNull(),
    actorAccountId: integer("actor_account_id").references(() => accounts.id, { onDelete: "set null" }),
    channel: varchar("channel", { length: 20 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp("occurred_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("agency_commercial_activities_opportunity_idx").on(t.opportunityId, t.occurredAt),
    index("agency_commercial_activities_quote_idx").on(t.quoteId, t.occurredAt),
    check("agency_commercial_activities_type_check", sql`${t.activityType} IN ('quote_sent','quote_viewed','follow_up','client_response','outcome_won','outcome_lost')`),
  ],
);

export const agencyIntelligenceSignals = pgTable(
  "agency_intelligence_signals",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull().references(() => agencyWorkspaces.id, { onDelete: "cascade" }),
    opportunityId: integer("opportunity_id").notNull().references(() => agencyOpportunities.id, { onDelete: "cascade" }),
    quoteVersionId: integer("quote_version_id").references(() => agencyQuoteVersions.id, { onDelete: "set null" }),
    signalKind: varchar("signal_kind", { length: 32 }).notNull(),
    severity: varchar("severity", { length: 16 }).notNull(),
    score: real("score").notNull(),
    explanation: text("explanation").notNull(),
    recommendedAction: text("recommended_action").notNull(),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    modelName: varchar("model_name", { length: 64 }).notNull().default("deterministic-rules-v1"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("agency_intelligence_signals_opportunity_idx").on(t.opportunityId, t.createdAt),
    check("agency_intelligence_signals_severity_check", sql`${t.severity} IN ('info','attention','high')`),
    check("agency_intelligence_signals_score_check", sql`${t.score} >= 0 AND ${t.score} <= 1`),
  ],
);

export const agencyMarketplaceProjections = pgTable(
  "agency_marketplace_projections",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull().references(() => agencyWorkspaces.id, { onDelete: "cascade" }),
    opportunityId: integer("opportunity_id").notNull().references(() => agencyOpportunities.id, { onDelete: "cascade" }),
    quoteVersionId: integer("quote_version_id").notNull().references(() => agencyQuoteVersions.id, { onDelete: "restrict" }),
    offerId: integer("offer_id").references(() => offers.id, { onDelete: "set null" }),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    projectionPayload: jsonb("projection_payload").$type<Record<string, unknown>>().notNull(),
    createdByAccountId: integer("created_by_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("agency_marketplace_projections_quote_version_uidx").on(t.quoteVersionId),
    uniqueIndex("agency_marketplace_projections_offer_uidx").on(t.offerId),
    check("agency_marketplace_projections_status_check", sql`${t.status} IN ('draft','pending_review','published','withdrawn')`),
  ],
);

export type AgencyWorkspace = typeof agencyWorkspaces.$inferSelect;
export type AgencyMembership = typeof agencyMemberships.$inferSelect;
export type AgencyDomainEvent = typeof agencyDomainEvents.$inferSelect;
export type AgencyClient = typeof agencyClients.$inferSelect;
export type AgencyOpportunity = typeof agencyOpportunities.$inferSelect;
export type AgencyIntentVersion = typeof agencyIntentVersions.$inferSelect;
export type AgencySupplierOption = typeof agencySupplierOptions.$inferSelect;
export type AgencyQuote = typeof agencyQuotes.$inferSelect;
export type AgencyQuoteVersion = typeof agencyQuoteVersions.$inferSelect;
export type AgencyCommercialActivity = typeof agencyCommercialActivities.$inferSelect;
export type AgencyIntelligenceSignal = typeof agencyIntelligenceSignals.$inferSelect;
export type AgencyMarketplaceProjection = typeof agencyMarketplaceProjections.$inferSelect;
