import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { accounts, agents } from "@/db/schema";

// Phase 1 Agency domain. Existing accounts/sessions remain authoritative.
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

export type AgencyWorkspace = typeof agencyWorkspaces.$inferSelect;
export type AgencyMembership = typeof agencyMemberships.$inferSelect;
export type AgencyDomainEvent = typeof agencyDomainEvents.$inferSelect;
