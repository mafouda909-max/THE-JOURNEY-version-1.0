# THE JOURNEY — الرحلة : MASTER HANDOFF & AGENT COLLABORATION PROTOCOL

> Status: **ARENA (REMOTE ENGINEERING) ↔ OPENCODE (LOCAL DESIGN) COLLABORATION ESTABLISHED**
> Baseline Branch: `main`
> Repository Commit: `5fb5c16` (Baseline THE JOURNEY marketplace & launch readiness architecture)
> Timestamp: 2026-08-30

---

## 1. AGENT ROLES & OWNERSHIP BOUNDARIES

```
+-------------------------------------------------------------------------+
|                  CANONICAL GITHUB REPOSITORY (ONE CODEBASE)             |
+------------------------------------+------------------------------------+
                                     |
           +-------------------------+-------------------------+
           |                                                   |
           v                                                   v
+------------------------------------+   +------------------------------------+
| ARENA.AI (REMOTE ENGINEERING AGENT) |   | OPENCODE (LOCAL DESIGN AGENT)      |
|  - Backend, APIs, Database Schema  |   |  - Figma Desktop & ai.to.design   |
|  - AI Orchestrator & Tavily Intel  |   |  - Brand System & Visual Language  |
|  - Identity Assurance & KYC Engine |   |  - Design System & Component UI    |
|  - Automation OS & Risk Engine     |   |  - Frontend Visual Implementations |
|  - Code Review & Integration Tests |   |  - Figma ↔ Code Synchronization    |
+------------------------------------+   +------------------------------------+
```

### Roles:
1. **Arena Agent (Primary Remote Engineering Brain)**:
   - Backend APIs, PostgreSQL database schema & migrations, security boundaries, rate limiting, dual AI provider failover (OpenRouter + OpenAI), Tavily research provider, MCP server logic (`travel-intelligence-mcp`), identity assurance, KYC presigned access URLs, lead qualification SLAs, revenue intelligence, automation OS, and master test validation.
2. **OpenCode Agent (Local Design & Visual Implementation Brain)**:
   - Runs on the user's local desktop machine. Handles local Figma Desktop integration via `@ai.to.design/figma-connector`, Brand Identity creation, Design System tokens, Figma prototypes, visual QA, and React frontend UI component styling.

---

## 2. BRANCHING STRATEGY & COLLABORATION WORKFLOW

- **`main`**: Canonical stable production baseline. Code must pass `npm run typecheck`, `npm run build`, and `npx tsx scripts/accept-journey.ts` before merging.
- **`feature/*`**: Arena remote engineering tasks (e.g. `feature/ai-resilience-enhancement`, `feature/analytics-telemetry`).
- **`design/*`**: OpenCode local design & UI implementation tasks (e.g. `design/brand-identity-system`, `design/offer-card-redesign`).

---

## 3. COMMIT DISCIPLINE & NAMING CONVENTIONS

- **Design Commits**: `design: establish Journey brand system and design tokens`
- **UI Components**: `ui: implement offer card v2 component`
- **Frontend Integration**: `feat(ui): integrate travel assistant layout`
- **Backend Infrastructure**: `feat(ai): improve offer verification pipeline`
- **Security & Fixes**: `fix(security): sanitize external identity payloads`

---

## 4. AGENT INTEGRATION & VALIDATION PROTOCOL

Whenever OpenCode pushes `design/*` or `ui/*` commits to GitHub, Arena executes the **Validation Protocol**:
1. `git pull` & diff inspection (`git diff`).
2. Run TypeScript typecheck (`npm run typecheck` -> 0 errors).
3. Run Next.js production build (`npm run build` -> successful compilation).
4. Run System Acceptance Suite (`npx tsx scripts/accept-journey.ts` -> 100% pass).
5. Run Identity Hardening Test (`npx tsx scripts/eval-identity-linking.ts` -> 13/13 pass).
6. Verify design token consistency between Figma tokens and React frontend components.

---

## 5. PROVIDER OPERATIONAL MATRIX SUMMARY

| Component / Provider | Status | Runtime Evidence |
|---|---|---|
| **PostgreSQL Database** | **LIVE & HARDENED (LOCAL CONTAINER)** | Port 5432, 15 domain tables, 41 indexes, 8ms latency |
| **OpenRouter + OpenAI AI** | **CONNECTED & LIVE** | Authenticated probe verified in 134ms |
| **Tavily Web Research** | **CONNECTED & LIVE** | Live search probe verified in 273ms |
| **Travel Intelligence MCP** | **TOOL_CALL_VERIFIED** | stdio JSON-RPC process tool call verified in 589ms |
| **Travel Readiness Engine** | **HARDENED & VERIFIED** | Evaluates travel readiness & dynamic checklists |
| **Identity Assurance & Linking** | **HARDENED & VERIFIED** | 13/13 attack test suite passed in `scripts/eval-identity-linking.ts` |
| **Resend Email** | **READY_FOR_CONFIGURATION** | `resend` SDK active; probe returns `NOT_CONFIGURED` |
| **Cloudflare R2** | **READY_FOR_CONFIGURATION** | Private storage provider active with presigned access URLs |

---

## 6. VALIDATION RESULTS SUMMARY

- **TypeScript (`npm run typecheck`)**: **0 errors**.
- **Production Build (`npm run build`)**: Compiled successfully in 11.4s.
- **Identity Hardening Suite (`scripts/eval-identity-linking.ts`)**: Passed **13/13 tests (100%)**.
- **System Acceptance Test (`scripts/accept-journey.ts`)**: Passed 100% in **6,507ms**.
- **Live Health Endpoint (`GET /api/health`)**: `200 OK` (`database.status: "HEALTHY"`, latency 8ms).
