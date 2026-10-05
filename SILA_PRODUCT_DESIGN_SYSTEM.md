# SILA / صلة — Product Design System v2

> Engineering-facing source of truth for applying the brand inside the product.
> Public name remains provisional until name clearance closes.

## 1. Brand idea

**صلة = طرفان + مساحة واضحة تربطهما.**

The product should communicate connection by making the relationship between:
- traveler,
- verified agent,
- information,
- verification scope,
- and decision

visible in the interface.

Do not decorate the product with generic travel symbols to make it feel branded.

## 2. Visual memory

Four repeatable signatures:

1. **Double-dot rhythm** — two points representing the two sides of the relationship.
2. **Information window** — large friendly rounded container; never bubbly or toy-like.
3. **Open interval** — negative space between information blocks; clarity before density.
4. **Fixed baseline** — short accent strip used to anchor headings, states or transitions.

## 3. Core palette

| Role | Token | HEX |
| --- | --- | --- |
| Brand Ink | deep | #08264A |
| Paper | mist | #F5F1E8 |
| Connection Signal | signal | #2E6FD8 |
| Signal Sky | sky | #7CC8E8 |
| Information Air | air / wash | #DFEBF1 |
| Dark Surface | inverse | #071829 |

### Semantic colors stay semantic

- Verification: green
- Warning: amber
- Error: red

**Signal/Sky must never mean “verified”.**
They express connection, selection, navigation and brand emphasis.

## 4. Logo

Production UI consumes approved vector masters from `public/brand/`.

Rules:
- Never recreate the mark with text.
- Preserve the approved English artwork.
- Preserve the Arabic kasra relationship: it belongs optically to **ص** and must not read as a fatha on **ل**.
- Arabic is the primary navigation/header expression.
- Bilingual lockup is appropriate in footer, onboarding, presentation and formal brand moments.

## 5. Typography

Product/UI:
- Arabic: IBM Plex Sans Arabic
- Data/technical labels: IBM Plex Mono

Logo artwork is not product typography.

Hierarchy:
- Hero: 48–72px web
- Page title: 36–60px web
- Section title: 24–48px
- Body: 15–18px
- Metadata: 11–13px

Use Arabic line-height generously. Avoid forced uppercase behaviors on Arabic.

## 6. Geometry

Web:
- Information window: `.sila-window` → 24px radius
- Controls: 12–16px radius
- Pills only for filters/status/small tags

Mobile:
- Master card: `radius.xl = 24`
- Standard control: 12px
- Touch target: >= 44px

## 7. Trust grammar

Every trust claim should answer, when relevant:

1. **Source** — who provided the information?
2. **Date** — when was it reviewed/updated?
3. **Status** — verified, reviewed, pending, warning?
4. **Scope** — what exactly did we check?
5. **Limitation** — what are we explicitly not guaranteeing?

A green badge is not enough.

## 8. Key components

### Offer Card
Must surface:
- offer identity
- agent identity
- verification state
- price type
- route/context
- CTA/entry affordance

Featured = brand accent.
Verified = semantic green.

### Agent Card
Must surface:
- real identity
- location
- verification
- response metrics
- specialties
- clear route to full profile

### Search / Filters
Active selection uses Signal Blue + Ink.
Do not use green for ordinary selection.

### Navigation
Primary agent acquisition CTA may use Signal Blue.
Trust/security controls keep semantic colors.

### Trust Scope
Use compact scope windows:
- identity reviewed
- license reviewed if applicable
- offer reviewed before publication
- trip outcome not guaranteed

## 9. Motion

Motion behavior:
- reveal
- connect
- hold
- progress

Avoid:
- excessive bounce
- decorative looping
- flight-path animation
- generic plane movement

Respect `prefers-reduced-motion`.
Lenis and Framer Motion are disabled/reduced when the OS requests reduced motion.

## 10. RTL

RTL is native, not mirrored afterward.

Rules:
- logical CSS properties: start/end
- Arabic is reading origin
- directional arrows checked in RTL context
- numbers remain legible with tabular/lining numerals where needed
- English names may stay LTR inside Arabic layouts

## 11. Accessibility

- visible focus ring uses Signal Blue
- semantic contrast must pass WCAG targets
- touch targets >= 44px
- color never carries status alone
- reduced motion is supported
- icon-only controls require accessible labels

## 12. Product migration boundary

Brand refactor may change:
- appearance
- copy
- metadata
- public naming
- motion
- assets

Brand refactor must not silently alter:
- authentication
- permissions
- database behavior
- verification rules
- payment/business logic
- storage/security policies

## 13. Current implementation anchors

- `src/lib/brand.ts`
- `src/app/globals.css`
- `src/components/brand/SilaLogo.tsx`
- `public/brand/asset-manifest.json`
- `mobile/src/theme.ts`
- `tests/brand-contract.test.ts`
- `tests/brand-config.test.ts`
- `tests/brand-token-sync.test.ts`

## 14. Merge gate

A public pilot release is ready when:
- CI green
- the exact tested Production release is READY on the existing Vercel link
- desktop and mobile RTL flows verified against isolated QA fixtures
- metadata/manifest QA
- public old-brand audit
- copy, navigation, forms, loading/error/empty states and account states match the shipped behavior

An isolated Preview is useful when available; it must never share the inherited
Production database. Final identity/name clearance remains a separate gate for
search indexing and the final branded launch. The owner deliberately selected
the existing Vercel address for the public pilot: a purchased domain is not a
pilot release prerequisite.

## 15. Immediate registration pilot

Account creation and agent verification are separate states. A new agent can
sign up and access their account immediately without documents. Verification is
a later step; human approval gates public discovery and offer publication.
An account with verification not started uses a neutral state and a clear next
action. Green indicates an actual verified state. Typed email is an unverified
login identifier, not evidence of email ownership.

Every functional change includes a review of affected navigation, Arabic copy,
forms and states. Keep persistent labels, mobile keyboards/autocomplete,
accessible password controls, 44 px touch targets and truthful empty states.
Public actions should point to capabilities that are actually available.

References reviewed on 2026-10-05:

- [Refero Styles](https://styles.refero.design/): Bevel spacing/rounded supporting
  surfaces, Vercel action hierarchy and Ramp border restraint; SILA keeps its own
  tokens and typography. Specific references and decisions are recorded in
  `docs/password-pilot-registration.md`.
- [Impeccable](https://github.com/pbakaus/impeccable): a useful vocabulary for
  reviewing hierarchy, onboarding, errors, overflow and copy. Its README was
  reviewed as guidance; its skill/CLI was not installed or run.
- [Agent Skills](https://github.com/addyosmani/agent-skills): engineering review,
  security, browser verification and rollout references. Validate behavior
  through actual CI/Production evidence, without treating repository popularity
  as proof of correctness.
- [Archify](https://github.com/tt-a1i/archify): a candidate for architecture and
  workflow communication, not a UI component system or a runtime dependency.
