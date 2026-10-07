# SILA Open Source Radar

Status vocabulary: **ADOPT / PILOT / STUDY / WATCH / REJECT**

This file is a product-engineering radar, not a dependency wishlist.
A repository is adopted only when it solves a concrete SILA problem with acceptable
security, licensing, operational cost, and migration risk.

## Current decisions

| Project | Status | SILA role | Decision |
|---|---|---|---|
| Playwright | ADOPT | Browser + visual closure QA | Primary deterministic browser harness. Desktop/mobile, RTL, overflow, runtime errors and screenshots run against isolated fixtures. |
| axe-core | ADOPT | Accessibility gate | Run WCAG A/AA automation inside Playwright. Treat automated results as a floor, not a substitute for manual review. |
| Impeccable | ADOPT (dev tool) | Deterministic design lint | Keep as an external design-quality audit; current rebuild reached zero findings. Do not make runtime depend on it. |
| Superpowers | ADOPT (principles) | Development discipline | Test-first behavior, systematic debugging, review separation and fresh verification. Incorporated into SILA development-agent protocol. |
| Chat On Steroids | ADOPT (patterns) | Long-running dev-agent sessions | Borrow resume/session-ledger, worker isolation and mutation-ambiguity patterns. No runtime dependency. |
| claude-mem / Hindsight | STUDY (patterns) | Agent memory | Useful context-memory patterns for development agents. Do not send traveler/customer context to an external memory layer by default. |
| NVIDIA OpenShell | STUDY -> PILOT | Sandboxed development agents | Candidate for policy-bounded shell/network/filesystem execution when development automation expands. Not traveler runtime. |
| Microsoft Agent Governance Toolkit | ADOPT (architecture), WATCH dependency | Agent control plane | Borrow intervention points, deterministic fail-closed policy, identity and audit concepts. Public-preview dependency is not a production requirement. |
| MCP-Scan | PILOT (dev plane) | MCP/tool security | Candidate CI/dev scan for prompt injection, tool poisoning, config drift and rug-pull changes when persistent MCP integrations grow. |
| Promptfoo | PILOT when AI runtime is active | LLM evals + red team | Build model/prompt regression sets and adversarial checks before expanding model autonomy. Keep sensitive traveler data out of external eval providers. |
| Langfuse | PILOT before broad agent rollout | LLM observability + evals | Strong fit for traces, prompt versions, latency, cost, datasets and evaluation; prefer privacy-scoped/self-hostable deployment. |
| OpenTelemetry JS | ADOPT (standard), PILOT instrumentation | Runtime observability | Use vendor-neutral server traces/metrics before adding provider-specific telemetry. Browser instrumentation only after a measured need. |
| OpenFeature | WATCH -> PILOT at flag scale | Feature-flag contract | Current small set of environment gates is sufficient. Adopt a vendor-neutral API only when flag ownership/evaluation becomes complex. |
| Sentry | WATCH | App error observability | Useful, but overlaps with Vercel/runtime logs and future OTel. Add only if error triage needs exceed existing evidence. |
| Storybook | WATCH | Isolated UI workshop | Valuable later for a large reusable component catalog, but current Playwright fixtures already cover priority states. Avoid tool duplication now. |
| OpenClaw | ADOPT (patterns) | Agent runtime architecture | Use gateway/tool/policy/session/provenance patterns. Do not fork the whole platform. |
| Refero | ADOPT | UI/UX research | Mandatory reference-first workflow for major product surfaces. |
| LiteLLM | STUDY -> likely PILOT | Model gateway | Strong fit for provider routing, fallback, spend and virtual-key controls. Pilot only after runtime contracts are stable. |
| Langfuse | STUDY -> likely PILOT | AI observability/evals | Strong fit for traces, prompts, latency, cost and evaluation. Add before broad agent rollout. |
| pgvector | STUDY | Semantic retrieval | Prefer extending existing PostgreSQL before adding a separate vector database. |
| Firecrawl | STUDY | Web evidence acquisition | Candidate source adapter for source-aware travel intelligence; must preserve provenance and freshness. |
| Trigger.dev | STUDY | Durable background jobs | Candidate for long-running jobs, retries and schedules outside Vercel request lifetime. |
| Vercel AI SDK | STUDY | AI UI/streaming | Natural fit with Next.js; adopt only for product interaction surfaces that need streaming/tool UI. |
| Hugging Face Hub / Inference Providers | PILOT | Model lab, evals, red team | Use for model discovery/comparison, open-model experiments and adversarial evaluation. Do not make it a primary production runtime; free credits are limited and sensitive traveler data stays out. |
| LangGraph | WATCH | Stateful agent workflows | Useful patterns, but overlaps with SILA runtime/OpenClaw direction. Do not add until a concrete gap exists. |
| browser-use | WATCH | Browser fallback | Last-resort adapter for sites without reliable APIs. Never primary truth source. |
| n8n | WATCH | Operations integrations | Useful for internal ops and low-risk connectors; not a SILA core runtime dependency. |
| Temporal | WATCH | Heavy durable workflows | Powerful but excessive for current scale; reconsider when workflow durability needs exceed lighter options. |
| CrewAI / AutoGen-style frameworks | REJECT for now | Multi-agent framework | Avoid framework stacking and duplicated control planes. |
| humanlayer/12-factor-agents | ADOPT (principles) | Agent engineering doctrine | Own context/control flow, small focused agents, deterministic software around LLM decisions. |

## Stack discipline

SILA does **not** optimize for the number of frameworks installed. A new dependency must beat the
existing stack on a measurable gap.

Preferred order:

1. Strengthen an existing harness before introducing a parallel one.
2. Adopt standards and interfaces before vendors.
3. Keep development-agent tooling outside traveler runtime.
4. Keep privacy-sensitive context inside SILA-controlled boundaries.
5. Require a deterministic acceptance test and a removal path for every pilot.
6. Do not promote a WATCH/STUDY project because it is popular, starred or fashionable.

### Current quality stack

```text
Design tokens / product contracts
        ↓
TypeScript + lint + hermetic unit contracts
        ↓
PostgreSQL domain / tenant / migration tests
        ↓
Playwright functional browser QA
        ↓
Visual Closure (RTL / geometry / touch / overflow / screenshots)
        ↓
axe-core automated WCAG A/AA
        ↓
Protected Preview runtime health + error scan
        ↓
Human visual review
        ↓
Production release + post-deploy proof
```

### Future AI-control stack

```text
Policy / capability registry
        ↓
tool + provider adapters
        ↓
Promptfoo-style offline eval / red team
        ↓
MCP security scanning for development integrations
        ↓
OpenTelemetry traces
        ↓
Langfuse-style AI traces / datasets / evals
        ↓
human approval for high-risk or irreversible actions
```

This sequence deliberately puts evaluation and observability **before** broader autonomy.

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
