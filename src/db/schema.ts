import {
  pgTable,
  serial,
  integer,
  index,
  text,
  varchar,
  boolean,
  real,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── THE JOURNEY / الرحلة — marketplace core ───────────────────────────

export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  displayName: text("display_name").notNull(),
  latinName: text("latin_name").notNull(),
  bio: text("bio").notNull(),
  photoUrl: text("photo_url").notNull(),
  city: text("city").notNull(),
  country: text("country").notNull(),
  licenseType: varchar("license_type", { length: 16 }).notNull(), // individual | agency
  licenseNumber: varchar("license_number", { length: 40 }),
  verificationStatus: varchar("verification_status", { length: 16 })
    .notNull()
    .default("in_review"), // pending | in_review | verified | rejected | suspended
  verifiedAt: timestamp("verified_at"),
  specialtyTags: text("specialty_tags").array().notNull().default([]),
  languages: text("languages").array().notNull().default([]),
  responseRate: real("response_rate").notNull().default(0), // 0–100
  avgResponseHours: real("avg_response_hours").notNull().default(24),
  totalTrips: integer("total_trips").notNull().default(0),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const offers = pgTable("offers", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  titleEn: text("title_en"),
  description: text("description").notNull(),
  tripType: varchar("trip_type", { length: 16 }).notNull(), // umrah | package | visa | flight | hotel | cruise
  originCity: text("origin_city").notNull(),
  destinationCity: text("destination_city").notNull(),
  destinationCountry: text("destination_country").notNull(),
  destinationCountryEn: text("destination_country_en").notNull(),
  departureDate: timestamp("departure_date"),
  durationDays: integer("duration_days"),
  priceAmount: integer("price_amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("SAR"),
  priceType: varchar("price_type", { length: 16 }).notNull().default("per_person"), // per_person | per_group | starting_from
  includes: text("includes").array().notNull().default([]),
  excludes: text("excludes").array().notNull().default([]),
  minTravelers: integer("min_travelers").notNull().default(1),
  maxTravelers: integer("max_travelers").notNull().default(8),
  status: varchar("status", { length: 20 }).notNull().default("pending_review"), // draft | pending_review | published | expired | rejected | archived
  rejectionReason: text("rejection_reason"),
  heroImage: text("hero_image").notNull(),
  isFeatured: boolean("is_featured").notNull().default(false),
  viewCount: integer("view_count").notNull().default(0),
  contactCount: integer("contact_count").notNull().default(0),
  publishedAt: timestamp("published_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
},
  (t) => [
    index("offers_status_idx").on(t.status),
    index("offers_agent_idx").on(t.agentId),
  ],
);

export const contactRequests = pgTable("contact_requests", {
  id: serial("id").primaryKey(),
  offerId: integer("offer_id")
    .notNull()
    .references(() => offers.id, { onDelete: "cascade" }),
  agentId: integer("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  travelerName: text("traveler_name").notNull(),
  travelerEmail: text("traveler_email").notNull(),
  message: text("message").notNull(),
  travelerCount: integer("traveler_count").notNull().default(2),
  travelDates: text("travel_dates"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  offerSnapshot: text("offer_snapshot"), // JSON string
  status: varchar("status", { length: 20 }).notNull().default("new"), // new | viewed | responded | closed | cancelled
  createdAt: timestamp("created_at").notNull().defaultNow(),
  respondedAt: timestamp("responded_at"),
},
  (t) => [
    index("contact_requests_offer_idx").on(t.offerId),
    index("contact_requests_email_offer_idx").on(t.travelerEmail, t.offerId),
  ],
);

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  reviewerName: text("reviewer_name").notNull(),
  rating: integer("rating").notNull(), // 1–5
  content: text("content").notNull(),
  isVerifiedTransaction: boolean("is_verified_transaction")
    .notNull()
    .default(false),
  isVisible: boolean("is_visible").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Agent KYC / KYB Document Verification ─────────────────────────────
export const agentDocuments = pgTable(
  "agent_documents",
  {
    id: serial("id").primaryKey(),
    agentId: integer("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    documentType: varchar("document_type", { length: 32 }).notNull(),
    storageKey: text("storage_key").notNull(),
    originalName: text("original_name").notNull(),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    expiresAt: timestamp("expires_at"),
    verifiedAt: timestamp("verified_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("agent_documents_agent_idx").on(t.agentId)],
);

// ── Growth OS substrate (Stage 3–4) ──────────────────────────────────

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  objective: text("objective").notNull(),
  audience: text("audience").notNull(),
  channels: text("channels").array().notNull().default([]),
  hypothesis: text("hypothesis").notNull(),
  kpi: text("kpi").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("draft"),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const contentItems = pgTable("content_items", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => campaigns.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  channel: varchar("channel", { length: 24 }).notNull(),
  contentType: varchar("content_type", { length: 24 }).notNull(),
  body: text("body").notNull(),
  cta: text("cta"),
  risk: varchar("risk", { length: 8 }).notNull().default("low"),
  status: varchar("status", { length: 16 }).notNull().default("draft"),
  scheduledFor: timestamp("scheduled_for"),
  publishedAt: timestamp("published_at"),
  performanceNote: text("performance_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
},
  (t) => [index("content_items_status_idx").on(t.status)],
);

export const experiments = pgTable("experiments", {
  id: serial("id").primaryKey(),
  hypothesis: text("hypothesis").notNull(),
  metric: text("metric").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("running"),
  result: text("result"),
  decision: varchar("decision", { length: 12 }),
  owner: text("owner").notNull().default("Growth"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
});

// ── Identity & Account Management ─────────────────────────────────────
export const accounts = pgTable(
  "accounts",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 200 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: varchar("role", { length: 16 }).notNull(), // traveler | agent | admin
    displayName: text("display_name").notNull(),
    agentId: integer("agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("accounts_agent_idx").on(t.agentId)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    token: varchar("token", { length: 80 }).notNull().unique(),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("sessions_account_idx").on(t.accountId)],
);

export const linkedIdentities = pgTable(
  "linked_identities",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 24 }).notNull(),
    providerSubject: varchar("provider_subject", { length: 120 }).notNull(),
    email: varchar("email", { length: 200 }),
    linkedAt: timestamp("linked_at").notNull().defaultNow(),
  },
  (t) => [
    index("linked_identities_account_idx").on(t.accountId),
    index("linked_identities_subject_idx").on(t.provider, t.providerSubject),
  ],
);

// ── Central Canonical Travel Fact Store ────────────────────────────────
export const travelFacts = pgTable(
  "travel_facts",
  {
    id: serial("id").primaryKey(),
    subject: varchar("subject", { length: 120 }).notNull(), // e.g. 'country:SA', 'airport:RUH', 'visa:SA->GE'
    attribute: varchar("attribute", { length: 80 }).notNull(), // e.g. 'visa_required', 'passport_validity_months', 'transit_rule'
    value: text("value").notNull(),
    source: text("source").notNull(),
    sourceType: varchar("source_type", { length: 32 }).notNull().default("AGENT_REPORTED"), // OFFICIAL_GOVERNMENT | AIRLINE_SUPPLIER | VERIFIED | SOURCE_REPORTED | AGENT_REPORTED | AI_INFERRED
    authorityLevel: integer("authority_level").notNull().default(1), // 1 (lowest) to 5 (official government)
    retrievedAt: timestamp("retrieved_at").notNull().defaultNow(),
    checkedAt: timestamp("checked_at").notNull().defaultNow(),
    validUntil: timestamp("valid_until"),
    freshnessStatus: varchar("freshness_status", { length: 16 }).notNull().default("UNKNOWN"), // FRESH | AGING | STALE | EXPIRED | UNKNOWN | CONFLICTED
    confidenceScore: real("confidence_score").notNull().default(0.5), // 0.0 - 1.0
    status: varchar("status", { length: 16 }).notNull().default("VERIFIED"),
    externalReference: text("external_reference"),
  },
  (t) => [
    index("travel_facts_subj_attr_idx").on(t.subject, t.attribute),
    index("travel_facts_freshness_idx").on(t.freshnessStatus),
  ],
);

export const travelKnowledge = pgTable(
  "travel_knowledge",
  {
    id: serial("id").primaryKey(),
    category: varchar("category", { length: 24 }).notNull(),
    country: varchar("country", { length: 64 }).notNull(),
    destinationCountry: varchar("destination_country", { length: 64 }),
    dataPayload: text("data_payload").notNull(),
    sourceType: varchar("source_type", { length: 24 }).notNull().default("AGENT_REPORTED"),
    freshnessStatus: varchar("freshness_status", { length: 16 }).notNull().default("UNKNOWN"),
    sourceUrl: text("source_url"),
    retrievedAt: timestamp("retrieved_at").notNull().defaultNow(),
    checkedAt: timestamp("checked_at").notNull().defaultNow(),
    validUntil: timestamp("valid_until"),
  },
  (t) => [
    index("travel_knowledge_cat_country_idx").on(t.category, t.country),
    index("travel_knowledge_freshness_idx").on(t.freshnessStatus),
  ],
);

// ── Autonomous Workflows Execution Store ──────────────────────────────
export const workflows = pgTable(
  "workflows",
  {
    id: serial("id").primaryKey(),
    workflowId: varchar("workflow_id", { length: 80 }).notNull(),
    runId: varchar("run_id", { length: 80 }).notNull().unique(),
    triggerEvent: varchar("trigger_event", { length: 80 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | running | completed | failed | retrying
    retryCount: integer("retry_count").notNull().default(0),
    errors: text("errors"),
    result: text("result"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (t) => [
    index("workflows_id_idx").on(t.workflowId),
    index("workflows_status_idx").on(t.status),
  ],
);

// ── Notifications: in-app, event-driven, idempotent ──────────────────
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 40 }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    link: varchar("link", { length: 200 }),
    idempotencyKey: varchar("idempotency_key", { length: 140 }).notNull().unique(),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("notifications_account_idx").on(t.accountId, t.createdAt)],
);

// ── Trust/Risk foundation: immutable admin audit trail ────────────────
export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    actor: varchar("actor", { length: 48 }).notNull().default("admin"),
    action: varchar("action", { length: 48 }).notNull(),
    targetType: varchar("target_type", { length: 24 }).notNull(),
    targetId: integer("target_id").notNull(),
    reason: text("reason"),
    prevState: varchar("prev_state", { length: 24 }),
    newState: varchar("new_state", { length: 24 }),
    meta: text("meta"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("audit_target_idx").on(t.targetType, t.targetId),
    index("audit_created_idx").on(t.createdAt),
  ],
);

// Analytics telemetry — decoupled from business tables on purpose.
export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 48 }).notNull(),
    offerId: integer("offer_id"),
    agentId: integer("agent_id"),
    meta: text("meta"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("events_name_idx").on(t.name)],
);

export const agentsRelations = relations(agents, ({ many }) => ({
  offers: many(offers),
  contactRequests: many(contactRequests),
  reviews: many(reviews),
  documents: many(agentDocuments),
}));

export const agentDocumentsRelations = relations(agentDocuments, ({ one }) => ({
  agent: one(agents, { fields: [agentDocuments.agentId], references: [agents.id] }),
}));

export const offersRelations = relations(offers, ({ one, many }) => ({
  agent: one(agents, { fields: [offers.agentId], references: [agents.id] }),
  contactRequests: many(contactRequests),
}));

export const contactRequestsRelations = relations(
  contactRequests,
  ({ one }) => ({
    offer: one(offers, {
      fields: [contactRequests.offerId],
      references: [offers.id],
    }),
    agent: one(agents, {
      fields: [contactRequests.agentId],
      references: [agents.id],
    }),
  }),
);

export const reviewsRelations = relations(reviews, ({ one }) => ({
  agent: one(agents, { fields: [reviews.agentId], references: [agents.id] }),
}));

export type Agent = typeof agents.$inferSelect;
export type AgentDocument = typeof agentDocuments.$inferSelect;
export type AnalyticsEvent = typeof events.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type LinkedIdentity = typeof linkedIdentities.$inferSelect;
export type TravelFact = typeof travelFacts.$inferSelect;
export type TravelKnowledge = typeof travelKnowledge.$inferSelect;
export type WorkflowRun = typeof workflows.$inferSelect;
export type AppNotification = typeof notifications.$inferSelect;
export type ContentItem = typeof contentItems.$inferSelect;
export type Experiment = typeof experiments.$inferSelect;
export type Offer = typeof offers.$inferSelect;
export type ContactRequest = typeof contactRequests.$inferSelect;
export type Review = typeof reviews.$inferSelect;
