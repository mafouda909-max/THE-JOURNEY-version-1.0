# SILA Interface Design Standard

**Purpose:** project-specific design quality rules for the existing SILA product.  
**Status:** apply to new marketplace and community interfaces; improve existing surfaces in focused, reviewable changes.

## References assessed

- [AI Design Skills](https://github.com/elayadesign/ai-design-skills) — landing-page structure and component-state guidance.
- [Redesign Skill](https://github.com/elayadesign/redesign-skill) — audit existing screens first, identify missing states, then improve them without rewriting the app.
- Both upstream repositories declare MIT licensing. This document is a project-specific synthesis; it does not copy their full skill text.

## 1. SILA remains the source of visual truth

Do not replace SILA's brand system with a generic external skill palette.

Current generated tokens in `src/styles/sila-generated.css`:
- Ink: `#08264A`
- Horizon: `#184F7B`
- Signal: `#2E6FD8`
- Sky: `#7CC8E8`
- Air: `#DFEBF1`
- Paper: `#F5F1E8`
- Cloud: `#FFFFFF`
- Dark: `#071829`
- Text: `#102A43`
- Muted: `#5F6F7E`
- Outline: `#DDE7ED`
- Semantic tokens: verified, warning and error.

The generated CSS is build output. Edit source design tokens and their generator, not `sila-generated.css`.

Use existing font loading, Tailwind configuration, spacing, radius, shadows and motion tokens. Do not introduce fonts, icon packages, gradients, arbitrary colors, arbitrary z-index values or animation libraries without a demonstrated gap and dependency review.

## 2. Start with the user task, not the component library

For every screen, document:
- primary user and their current state;
- one primary job to complete;
- the information required to decide;
- the next action and its consequence;
- what must remain private;
- how the screen behaves when data is absent, stale, loading or invalid.

For a new public landing page, choose one audience, one offer and one primary action. Use a clear hero, proof next to claims, a short workflow explanation and objection handling. Do not apply a marketing landing-page section list to authenticated operational dashboards.

## 3. Marketplace request and quote UX

The multi-provider request experience must make these facts visible:
- one request has one stable reference;
- the number and identity of providers receiving the request;
- request delivery is not an offer or a booking;
- each provider creates a separate proposal under the same request;
- prices are comparable only when currency and service scope match;
- source evidence, freshness and unknowns are distinct from agency claims;
- the traveler selects a proposal, then contacts the provider directly outside SILA.

Do not show an aggregate “best offer” when currencies, dates, passengers, inclusions, fare conditions, cancellation or service scope are materially different. Explain why an item is not directly comparable.

## 4. Visual hierarchy and layout

- Use the current SILA token palette and flat surfaces.
- Prefer a clear reading path and meaningful alignment over decorative cards.
- Do not default to three equal feature cards. Use an asymmetric layout, a two-column request/summary arrangement or a compact comparison table when the information calls for it.
- Avoid nesting cards inside cards without a hierarchy reason.
- Keep information-dense dashboards appropriately dense; keep public discovery pages spacious.
- Align labels, quote totals, terms and actions across comparable proposal rows.
- Use Arabic-first content with correct RTL direction. English technical labels may remain secondary when they are established domain terms.
- Use real Arabic interface copy. Never ship filler, fake reviews, invented provider badges or round-number sample pricing as live evidence.

## 5. Interaction states are part of the design

Every data view must have explicit:
- loading state shaped like the final content;
- empty state that explains the next useful action;
- error state that identifies the failed action and allows a safe retry;
- disabled state with a reason;
- success state that confirms exactly what happened;
- expired/stale state when data or links are no longer actionable.

Every interactive element requires keyboard access, visible focus, pressed/disabled feedback, and a mobile target large enough to activate reliably. Never rely on color alone to communicate status.

Respect reduced motion. Prefer the current SILA easing/timing tokens; do not add motion merely to decorate an action.

## 6. Copy and trust language

Use specific verbs and explicit actor labels. Distinguish:
- “الوكالة أفادت” from “تحققت صلة”;
- “المسافر وافق على العرض” from “تم تأكيد الخدمة”;
- “تم إرسال الطلب إلى خمس جهات” from “خمس جهات قدمت عروضًا”.

Never call a request a booking, a quote an issued ticket, an agency statement an independently verified source, or an activated quote a supplier reservation.

Avoid vague CTAs such as “إرسال” when a more exact action is available. Use “أرسل الطلب إلى مقدمي الخدمة” or “راجع العرض” when those are the actual outcomes.

## 7. Design review workflow

1. Inspect the current page, components, tokens and relevant tests.
2. Record the visual/interaction diagnosis before editing.
3. Fix the highest-impact, lowest-risk issue first.
4. Build one section or workflow at a time; preserve working behavior.
5. Test at desktop and mobile widths and in Arabic RTL.
6. Validate loading, empty, error, disabled, focus and reduced-motion states.
7. Run the exact repository checks before calling the screen ready.

Figma-specific variable/component rules apply only when a Figma file is being edited. They do not justify installing a Figma-specific skill or changing code tokens during ordinary repository work.
