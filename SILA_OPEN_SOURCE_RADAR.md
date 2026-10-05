# SILA Open Source Radar

Status vocabulary: **ADOPT / PILOT / STUDY / WATCH / REJECT**

This file is a product-engineering radar, not a dependency wishlist.
A repository is adopted only when it solves a concrete SILA problem with acceptable
security, licensing, operational cost, and migration risk.

## Current decisions

| Project | Status | SILA role | Decision |
|---|---|---|---|
| OpenClaw | ADOPT (patterns) | Agent runtime architecture | Use gateway/tool/policy/session/provenance patterns. Do not fork the whole platform. |
| Refero | ADOPT | UI/UX research | Mandatory reference-first workflow for major product surfaces. |
| LiteLLM | STUDY -> likely PILOT | Model gateway | Strong fit for provider routing, fallback, spend and virtual-key controls. Pilot only after runtime contracts are stable. |
| Langfuse | STUDY -> likely PILOT | AI observability/evals | Strong fit for traces, prompts, latency, cost and evaluation. Add before broad agent rollout. |
| pgvector | STUDY | Semantic retrieval | Prefer extending existing PostgreSQL before adding a separate vector database. |
| Firecrawl | STUDY | Web evidence acquisition | Candidate source adapter for source-aware travel intelligence; must preserve provenance and freshness. |
| Trigger.dev | STUDY | Durable background jobs | Candidate for long-running jobs, retries and schedules outside Vercel request lifetime. |
| Vercel AI SDK | STUDY | AI UI/streaming | Natural fit with Next.js; adopt only for product interaction surfaces that need streaming/tool UI. |
| LangGraph | WATCH | Stateful agent workflows | Useful patterns, but overlaps with SILA runtime/OpenClaw direction. Do not add until a concrete gap exists. |
| browser-use | WATCH | Browser fallback | Last-resort adapter for sites without reliable APIs. Never primary truth source. |
| n8n | WATCH | Operations integrations | Useful for internal ops and low-risk connectors; not a SILA core runtime dependency. |
| Temporal | WATCH | Heavy durable workflows | Powerful but excessive for current scale; reconsider when workflow durability needs exceed lighter options. |
| CrewAI / AutoGen-style frameworks | REJECT for now | Multi-agent framework | Avoid framework stacking and duplicated control planes. |
| humanlayer/12-factor-agents | ADOPT (principles) | Agent engineering doctrine | Own context/control flow, small focused agents, deterministic software around LLM decisions. |

## Admission criteria

A repository may move toward ADOPT only when all are true:

1. It solves a currently observed problem.
2. It does not duplicate an existing SILA capability without a clear win.
3. Security boundaries remain controlled by SILA.
4. Licensing is compatible with intended use.
5. The dependency can be isolated behind a SILA-owned interface.
6. Failure degrades safely.
7. Removal or replacement is feasible.
8. We can test the integration with deterministic acceptance criteria.

## Near-term sequence

1. Stabilize SILA Agent Runtime contracts and policy.
2. Add observability before broadening autonomy.
3. Pilot model gateway.
4. Pilot evidence acquisition.
5. Add durable background execution.
6. Add semantic retrieval only when a measured use case requires it.

## Research domains

Continuously scan for useful work in:
- travel technology / GDS / NDC
- ranking and recommendation
- trust, fraud and reputation
- marketplace mechanics
- CRM and lead operations
- source-aware RAG and knowledge systems
- agent runtimes and tool security
- background workflows and scheduling
- AI observability and evaluation
- community knowledge graphs
- identity and authorization
- browser automation
- maps and geo search
- document verification

The rule is simple: **borrow proven engineering, keep SILA's product logic and trust boundary.**
