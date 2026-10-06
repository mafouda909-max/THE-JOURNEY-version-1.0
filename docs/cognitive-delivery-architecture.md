# SILA Cognitive Delivery Architecture

This document separates three concerns that should not be collapsed into one agentic layer.

## 1. Development-agent plane

ACP is useful here: editor/IDE clients can connect to coding agents through one interoperable protocol. Treat ACP v1 as the stable compatibility target; do not make the public SILA runtime depend on an editor protocol.

Development agents may consume:
- canonical design tokens,
- component contracts,
- test results,
- accessibility rules,
- deployment metadata,
- approved cloud documentation.

Every agent-authored UI change must pass design-token sync, typecheck, unit contracts, build and responsive browser QA before release.

## 2. Product-agent plane

The product runtime may use AI for bounded tasks: summarization, decision support, evidence comparison, tool planning and generative content inside a fixed component grammar.

The product runtime must not:
- freely regenerate navigation or control locations,
- infer emotion from hidden biometrics,
- fabricate urgency,
- claim a provider action occurred before verification,
- make irreversible changes without explicit user action.

Generative UI means bounded composition, not unbounded screen mutation.

## 3. Analytics and anticipation plane

Start with privacy-safe product telemetry already close to the decision funnel. If event volume later justifies a warehouse such as BigQuery, export only a documented event contract.

Useful signals:
- repeated retries,
- repeated backtracking between the same two steps,
- abandoned decision step,
- stale evidence encountered,
- time-to-next-safe-action.

These are friction signals, not diagnoses of anxiety.

Never send:
- passport numbers,
- raw free-text travel prompts,
- email addresses,
- identity documents,
- private agent evidence,
- hidden sensor data.

Predictive prefetch is allowed only when it reduces latency without changing a decision or incurring an external cost before consent.

## 4. Cloud steering

Cloud-aware coding plugins can help development agents understand deployment, logs and provider configuration. They do not replace Vercel autoscaling or the application's own observability.

Do not engineer around a universal 150 ms promise. Set measurable budgets per interaction class and optimize the slow path that matters:
- local visual feedback: immediate,
- navigation shell response: perceptually instant,
- network decision result: progressive feedback with clear bounded states,
- provider research: cancellable and evidence-scoped.

## 5. Release rule

No cognitive or generative UI change reaches Production until the exact release has:
1. token integrity,
2. typecheck,
3. unit/contract tests,
4. production build,
5. mobile and desktop RTL visual QA,
6. reduced-motion verification,
7. no new runtime errors.
