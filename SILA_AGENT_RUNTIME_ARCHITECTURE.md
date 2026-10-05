# SILA Agent Runtime Architecture Decision

Status: **ADOPTED**
Date: 2026-10-05
Scope: SILA / صلة

## Decision

SILA will adopt an internal **Agent Runtime / Gateway layer** inspired by selected OpenClaw architectural patterns.

This is **not** a fork of OpenClaw and does not replace the SILA application, database, auth boundary, marketplace, community, travel-intelligence services, or product UX.

SILA remains the system of record. The agent runtime is an internal execution layer behind SILA-controlled APIs and permissions.

## Why

The product roadmap already requires:
- multi-agent AI
- travel intelligence and supplier comparison
- Amadeus/GDS tools
- web/search tools
- Growth OS automation
- community intelligence
- agent copilot workflows
- trust/moderation workflows
- scheduled operational actions

OpenClaw demonstrates useful mature patterns for these needs:
- trusted gateway / untrusted execution separation
- tool and skill registries
- sessions and state
- model/runtime abstraction
- policy-as-code
- approvals
- sandbox-aware execution
- provenance/audit
- MCP/A2A-style interoperability

## Target architecture

```text
Traveler / Travel Agent / Admin
             |
          SILA UI
             |
       SILA Auth + APIs
             |
   Tenant / Role / Policy Boundary
             |
     SILA Agent Gateway
             |
   +---------+----------+----------+
   |         |          |          |
Travel    Growth     Trust      Community
Agent     Agent      Agent      Agent
   |
Tools / Providers
   +-- PostgreSQL / SILA data
   +-- Amadeus / GDS
   +-- Tavily / web research
   +-- OpenRouter / OpenAI / future models
   +-- Email / messaging adapters
   +-- Backblaze B2
```

## Non-negotiable security rules

1. The LLM is never an authorization boundary.
2. SILA auth, tenant identity, roles, and permissions remain authoritative.
3. Tool access is enforced in code, not only by prompts.
4. High-risk writes require deterministic policy and human approval where appropriate.
5. Agent execution must be sandboxed or otherwise isolated before privileged tools are exposed.
6. Credentials must be scoped per provider/tool and kept out of model context wherever possible.
7. Every consequential action must have provenance/audit metadata.
8. No shared OpenClaw-style gateway is exposed directly as a hostile multi-tenant boundary.
9. Production actions fail closed when policy, credentials, or ownership context is missing.

## Initial agent set

### 1. Travel Intelligence Agent
Understands traveler intent, gathers source-aware evidence, compares options, and explains tradeoffs.

### 2. Flight / GDS Agent
Uses Amadeus and future GDS/provider tools through narrow read/action contracts.

### 3. Visa & Readiness Agent
Produces evidence-aware guidance with source, freshness, jurisdiction, and uncertainty.

### 4. Travel Agent Copilot
Helps verified agencies create offers, handle inquiries, follow up, and decide next actions.

### 5. Growth Agent
Operates through the existing Growth OS state machine and approval/risk gates.

### 6. Trust Agent
Assists moderation, anomaly detection, policy checks, review integrity, and unsafe-claim detection.

### 7. Community Intelligence Agent
Turns community activity into reusable knowledge and connects:
Question -> Discussion -> Knowledge -> Intent -> Offer -> Compare -> Decision.

### 8. Operations Agent
Handles reminders, stale inquiries, expiry checks, supplier-health signals, and operational queues.

## Runtime strategy

Use a provider-neutral model router.

```text
SILA Agent Runtime
   +-- fast model
   +-- strong reasoning model
   +-- coding/harness runtime where needed
   +-- future local/specialized models
```

Existing configuration seams remain useful:
- AI_MODEL_FAST
- AI_MODEL_STRONG
- OPENROUTER_API_KEY
- OPENAI_API_KEY
- TAVILY_API_KEY
- AMADEUS_CLIENT_ID
- AMADEUS_CLIENT_SECRET

No single model vendor should become a product-level dependency.

## Deployment

Do **not** embed a full long-running agent gateway inside the Vercel request lifecycle.

Preferred topology:

```text
Vercel: SILA Web + public/product APIs
                 |
       authenticated internal API
                 |
Persistent Agent Runtime service
                 |
     sandboxed/scoped workers + tools
```

The runtime may initially be implemented with SILA-native components while borrowing OpenClaw contracts and patterns. Direct OpenClaw components should only be adopted where they reduce risk or implementation cost without importing unnecessary platform complexity.

## OpenClaw adoption rule

Adopt capabilities in this order:

1. existing SILA owner/component
2. narrow SILA tool contract
3. reusable agent-runtime capability
4. OpenClaw-derived/adapted component when clearly superior
5. never import a large subsystem merely because it already exists

Avoid a full repository fork.

## Refero design rule

Refero is adopted as the primary reference-research layer for substantial SILA UI/UX work.

For new major product surfaces:
1. **Styles** for visual direction
2. **Screens** for concrete UI patterns
3. **Flows** for multi-step journey logic
4. synthesize a SILA-specific reference lock
5. implement
6. visual QA against the reference lock

Priority surfaces for Refero research:
- Traveler Intelligence workspace
- offer comparison and decision experience
- Travel Agent Copilot workspace
- agency dashboard
- trust/review/moderation surfaces
- community-to-intent flows
- onboarding and identity/verification journeys
- mobile product patterns

Refero is a design-research dependency, not a backend/runtime dependency.

## Phased implementation

### Phase A — contracts first
- define AgentRequest / AgentRun / ToolCall / Approval / Evidence / AuditEvent contracts
- introduce tool registry
- introduce policy evaluation layer
- keep all tools read-only initially

### Phase B — Travel Intelligence
- model router
- Tavily/search adapter
- Amadeus adapter
- source/evidence normalization
- comparison agent
- traceable outputs

### Phase C — Copilot + Growth
- agency copilot
- Growth OS tools
- approval-required mutations
- scheduled follow-up primitives

### Phase D — Trust + Community
- moderation assistance
- policy checks
- community knowledge extraction
- intent linkage

### Phase E — action layer
Only after observability, permissions, approvals, sandboxing, and rollback are proven:
- outbound messaging
- supplier-side mutations
- automated operational actions

## Success criteria

The architecture is successful when SILA can add or swap:
- models
- suppliers
- search providers
- messaging channels
- specialized agents
- tools

without rewriting the product UI, auth model, or core marketplace state machine.

The long-term target is not "SILA with AI features."

The target is:

**SILA as a Travel Intelligence + Agent Operating System with a trusted marketplace and network layer.**
