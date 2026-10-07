# SILA development-agent operating protocol

## Purpose

SILA development agents may accelerate research, implementation, review, QA and release preparation.
They are part of the **development plane**, not the traveler or agent product runtime. External agent
frameworks, browser companions, local shells and skill libraries are references or replaceable tools;
SILA must never require them in order to serve a traveler, verify evidence, publish an offer or operate
the production marketplace.

The operating rule is simple: **evidence over claims, bounded authority over convenience, and durable
state over hidden session memory.**

## 1. Isolated workspace first

Every non-trivial implementation runs in an **isolated workspace**: a feature branch, worktree,
sandbox or equivalent environment tied to an exact commit. Development agents do not write directly
to Production or the shared default branch merely because a tool exposes that capability.

Before implementation, record:
- repository and branch;
- exact starting SHA;
- intended files or subsystem;
- verification commands;
- external side effects that are explicitly out of scope.

Merges, Production deployment, publication, destructive database work and other shared side effects
remain separate release actions.

## 2. Least privilege and explicit capabilities

Agents operate with **least privilege**. Tool availability is not authorization.

- Read-only inspection is preferred until a write is necessary.
- Filesystem access is scoped to the approved project where the tool supports it.
- Shell access is treated as full user-level execution, not as a folder sandbox.
- External MCP/plugin actions inherit their own provider permissions and are never assumed harmless.
- Production credentials are never copied into prompts, logs, screenshots, test fixtures or durable ledgers.
- A security-sensitive action stops normal autonomous execution and requires an explicit release/security decision.

SILA's application runtime remains governed by its own Policy → Capability Registry → Provider →
Evidence → Audit chain. Development tools do not bypass product authorization.

## 3. Root cause before fix

For bugs, failed builds, integration problems or unexpected behavior: **root cause before fix**.

1. Reproduce or collect direct evidence.
2. Read the actual error and recent relevant changes.
3. Trace the failing value/state across component boundaries.
4. Form one falsifiable hypothesis.
5. Test the smallest change that distinguishes that hypothesis.
6. Only then implement the fix.

Three failed fix attempts are an architecture signal. Stop stacking patches and reconsider the design,
state ownership or dependency boundary.

## 4. Test-first behavior changes

New behavior, bug fixes and meaningful refactors use **test-first** development whenever the repository
can express the behavior automatically.

RED:
- add the smallest behavioral test;
- run it;
- prove it fails for the intended missing behavior, not a typo or setup error.

GREEN:
- implement the smallest production change;
- run the same test and the affected suite.

REFACTOR:
- simplify only while the suite stays green.

Generated files, pure documentation and one-off exploratory probes may not need a behavioral RED step,
but their outputs still require validation appropriate to the artifact.

## 5. No blind retries

There are **no blind retries** for mutations, deployments, provider writes or uncertain tool failures.

After a timeout or ambiguous mutation:
- inspect current state first;
- determine whether the action already happened;
- retry only when the operation is proven idempotent or the observed state proves it did not occur.

This applies to GitHub writes, database operations, email sends, deployments, storage mutations and
external provider calls.

## 6. Session ledger and resumability

Long-running work keeps a **session ledger** outside conversational memory. The ledger is a compact
record of facts, not hidden reasoning.

It records:
- goal and non-goals;
- branch/SHA/deployment under test;
- completed tasks and proof;
- open failures and exact evidence;
- rulings made when the plan was ambiguous;
- side effects already performed;
- release blockers;
- next safe action.

A resumed agent reads the ledger and current repository state before repeating work. Conversation
compaction or a new agent must not cause completed migrations, deployments or mutations to be replayed.

## 7. Review separation

For substantial changes, implementation and review are separate passes.

Review order:
1. spec/intent compliance;
2. security and permission boundaries;
3. code/data correctness;
4. UI/accessibility/RTL where relevant;
5. operational failure behavior;
6. code quality and unnecessary complexity.

An agent's own “done” report is never sufficient evidence.

## 8. Fresh verification before completion

No success statement without **fresh verification** on the exact state being claimed.

Before claiming a branch, preview or release is ready:
- verify the exact HEAD SHA;
- run the relevant contract/tests;
- run TypeScript/static checks;
- run the production build when runtime code changed;
- run deterministic design/accessibility checks for UI changes;
- inspect deployment/runtime health when a deployment is part of the claim;
- report any warnings or unverified surfaces explicitly.

A previous commit passing does not prove the current HEAD passes.

## 9. Production boundary

Production is a separate trust boundary.

Agents must not:
- migrate or reset Production because Preview is inconvenient;
- bind an unproven Preview to Production data;
- fabricate verified agents, suppliers, offers or customer evidence for a release demo;
- enable payment, booking, public indexing or external provider actions without their own release gate;
- expose secrets or personal data to third-party agent memory systems.

Production release requires exact-build evidence plus post-deploy smoke/health checks.

## 10. What we borrow — and what we do not

Useful patterns were studied from:
- Superpowers: structured design/planning, test-first behavior, systematic debugging, independent review,
  and verification-before-completion.
- Chat On Steroids: worker/session continuity, explicit permissions, resumability, mutation ambiguity
  handling and the warning that local shell/plugin access can exceed project-folder boundaries.

SILA adopts the engineering principles, not a runtime dependency on either project. In particular,
SILA does not depend on browser UI automation, local conversation recording, third-party session
capture or unbounded local command execution.

## Release checklist for agent-authored changes

- [ ] isolated workspace and exact SHA recorded
- [ ] least-privilege tool scope respected
- [ ] root cause established for bug fixes
- [ ] test-first RED/GREEN evidence for behavior changes where applicable
- [ ] no blind retries after ambiguous mutations
- [ ] session ledger updated for long-running work
- [ ] independent review performed for substantial changes
- [ ] fresh verification run on exact HEAD
- [ ] Production and security-sensitive actions kept behind their own release gate
