# THE JOURNEY — Design System Audit
## V1.1 Revised

**Status:** DESIGN SYSTEM — LOCKED  
**Audit Scope:** Canonical Stitch Design System + representative screens  
**Brand Direction:** Ink & Horizon  
**Primary Product:** THE JOURNEY / الرحلة

> **Amendment V1.1.1 — August 2026 (ratified, see docs/ARCHITECTURE_DECISIONS.md):**
> 1. Title MD line-height corrected to **26px** (canonical per `DESIGN.md`; prior "27px" was an erratum).
> 2. Shadow tokens completed to the full union with BRAND_GUIDELINES §6: **XS and XL added**.
> 3. Radius clarified: badges/status pills/filter chips/rating pills = `rounded-full`; `rounded-sm` (6px) reserved for **tags and small buttons only**.

---

## 1. Executive Summary

The THE JOURNEY design system has been reviewed against the canonical `DESIGN.md` specification.

The system is considered **locked for V1.1**. The audit confirms alignment across:

- Brand color hierarchy
- Semantic color usage
- Arabic-first typography
- RTL layout behavior
- Responsive desktop/mobile structure
- Radius and shape semantics
- Spacing rhythm
- Elevation and depth
- Component consistency
- Traveler, Agent, and Admin environments

No application-code implementation is included in this audit.

---

## 2. Canonical Design System Source

The canonical source of truth is:

`DESIGN.md`

All UI implementation and future Stitch screens must follow `DESIGN.md`.

If a screen conflicts with this document, the design-system rules take precedence unless an explicit product decision supersedes them.

---

## 3. Brand Direction

### Design Language

THE JOURNEY is built around four principles:

1. **Clarity**
2. **Trust**
3. **Depth**
4. **Arabic-first**

The visual direction is **Ink & Horizon**, using Deep Ink Blue and Warm Stone to establish authority, trust, and human warmth.

The product must not visually drift toward:

- Generic OTA / booking-engine aesthetics
- Discount marketplace aesthetics
- Social-network styling
- Government-portal styling
- Startup-demo aesthetics
- Excessive gradients
- Glow effects
- Decorative color noise

---

## 4. Color Audit

### Primary Brand Colors

| Role | Token | HEX | Canonical Usage |
|---|---|---|---|
| Primary | Deep Ink | `#1A2B6D` | Primary actions, active navigation, brand-critical elements |
| Secondary | Warm Stone | `#7A6655` | Secondary actions and supporting elements |
| Accent | Discovery Gold | `#D4890A` | Timers and premium badges, used sparingly |
| Background | Near White | `#F6F7FA` | Main page background |
| Surface | White | `#FFFFFF` | Cards, modals, elevated surfaces |
| Text Primary | Near Black | `#141A2C` | Headings and primary body text |
| Text Muted | Muted Slate | `#545D73` | Supporting text and captions |

### Semantic Colors

Semantic colors are strictly reserved for communication of state and urgency.

| Semantic Role | HEX | Allowed Usage |
|---|---|---|
| SUCCESS | `#159050` | Verified Agent, Confirmed Price, Successful completion |
| WARNING | `#C87A06` | Pending Review, Near Expiration, Attention Required |
| ERROR | `#BE2A2A` | Validation Errors, Rejected Offers, Rejected Verification, Destructive Actions |
| INFO | `#2563A8` | Informational banners, system messages, neutral guidance |

### Audit Result

**PASS**

Semantic colors are not to be used as decorative brand colors.

Discovery Gold must remain restrained, with a maximum of approximately two prominent uses per screen.

---

## 5. Typography Audit

### Canonical Typeface

**IBM Plex Sans Arabic**

The type system is Arabic-first and supports both Arabic and Latin content.

### Primary Scale

| Style | Size | Weight | Line Height |
|---|---:|---:|---:|
| Display XL | 56px | 700 | 64px |
| Display LG | 48px | 700 | 60px |
| Display MD | 40px | 700 | 52px |
| Headline LG | 32px | 600 | 40px |
| Headline MD | 24px | 600 | 32px |
| Title LG | 20px | 600 | 28px |
| Title MD | 18px | 600 | 26px |
| Body LG | 18px | 400 | 28px |
| Body MD | 16px | 400 | 24px |
| Body SM | 14px | 400 | 20px |
| Label LG | 14px | 500 | 20px |
| Label MD | 13px | 500 | 18px |
| Label SM | 11px | 500 | 16px |

### Audit Result

**PASS**

Typography follows the Arabic-first hierarchy and maintains appropriate weight and scale relationships across desktop and mobile.

RTL reading direction remains the priority.

---

## 6. Radius & Shape Audit

### Canonical Radius Rules

The design system intentionally does **not** force every component to use the same radius.

| Component Type | Radius |
|---|---:|
| Standard buttons | `rounded-md` / 8px |
| Inputs | `rounded-md` / 8px |
| Standard cards | `rounded-md` / 8px |
| Interactive containers | `rounded-md` / 8px |
| Tags & small buttons | `rounded-sm` / 6px |
| Verification badges | `rounded-full` / 9999px |
| Status chips | `rounded-full` / 9999px |
| Filter chips | `rounded-full` / 9999px |
| Rating pills | `rounded-full` / 9999px |
| Compact categorical pills | `rounded-full` / 9999px |
| Hero Search Module | `rounded-xl` / 16px |
| Large elements | `rounded-xl` / 16px |

### Audit Result

**PASS**

The previous radius conflict has been resolved.

Semantic pills and badges use `rounded-full`, while standard interactive surfaces retain the 8px default.

---

## 7. Spacing & Rhythm Audit

### Base Unit

**4px**

All spacing values should be multiples of 4px.

### Layout

- Desktop: 12-column grid
- Desktop maximum width: 1280px
- Desktop gutter: 24px
- Mobile side margin: 16px
- Mobile: single-column layout
- Small stack: 8px
- Medium stack: 16px
- Large stack: 32px

### Audit Result

**PASS**

The spacing system supports a consistent visual rhythm and predictable responsive behavior.

---

## 8. Responsive & RTL Audit

### Desktop

- 12-column grid
- Maximum content width: 1280px
- 24px gutters
- Editorial/premium composition

### Mobile

- Single-column structure
- 16px side margins
- Fluid component behavior
- Priority content retained above secondary content

### RTL

The product is Arabic-first.

Requirements:

- Text flows right-to-left
- Primary text alignment is right
- Navigation and content hierarchy mirror appropriately
- Directional icons must be reviewed individually rather than blindly mirrored
- Numeric and code content may preserve LTR treatment where appropriate

### Audit Result

**PASS**

RTL and responsive behavior are consistent with the canonical system.

---

## 9. Elevation & Depth Audit

The system uses tonal layering and restrained ambient shadows.

### Level 0

Near White background:

`#F6F7FA`

### Level XS

White surface with:

`0 1px 2px rgba(20,26,44,0.06)`

### Level 1

White surface with:

`0 2px 8px rgba(20,26,44,0.08)`

### Level 2

White surface with:

`0 4px 16px rgba(20,26,44,0.10)`

### Level 3

White surface with:

`0 8px 32px rgba(20,26,44,0.12)`

### Level XL

White surface with:

`0 16px 48px rgba(20,26,44,0.16)`

### Restrictions

- No colored shadows
- No glow effects
- No excessive elevation
- Depth must communicate hierarchy, not decoration

### Audit Result

**PASS**

---

## 10. Iconography Audit

### Canonical Icon System

**Material Symbols**

- Outlined 400 for standard icons
- Filled icons for active states

Icons should remain:

- Simple
- Consistent
- Functional
- Visually subordinate to primary content

Avoid decorative icon substitutions that introduce a different visual language.

### Audit Result

**PASS**

---

## 11. Component Semantics

### Buttons

Standard buttons use `rounded-md` and the approved brand hierarchy.

Primary actions use Deep Ink.

Secondary actions use the appropriate secondary treatment.

Destructive actions use ERROR semantics only.

### Inputs

Inputs use:

- 8px radius
- Clear labels
- RTL text flow
- Accessible focus indication
- Semantic validation states

### Cards

Cards use:

- White surface
- 8px radius
- Tonal shadow
- Clear information hierarchy
- No decorative colored shadows

### Badges & Chips

Verification, status, filter, rating, and categorical pills use:

`rounded-full`

Their color must communicate semantic meaning rather than decoration.

---

## 12. Representative Screen Audit

The design system was validated against six representative environments:

1. Home
2. Search Results
3. Offer Detail
4. Agent Profile
5. Agent Dashboard
6. Admin Dashboard

### Home

**Status: PASS**

- Brand hierarchy is clear
- Primary search module follows the large-radius rule
- Deep Ink establishes primary action hierarchy
- Arabic typography is dominant
- Discovery Gold remains restrained

### Search Results

**Status: PASS**

- Filters use pill/chip semantics
- Offer cards maintain standard 8px radius
- Price hierarchy remains clear
- Semantic status colors remain reserved

### Offer Detail

**Status: PASS**

- Price presentation uses strong numeric hierarchy
- Verified and confirmed states use SUCCESS
- Expiry/urgency uses WARNING
- CTA hierarchy remains consistent

### Agent Profile

**Status: PASS**

- Verified badge uses SUCCESS
- Trust information is prioritized
- Cards and content containers follow standard radius rules
- Typography supports Arabic-first reading

### Agent Dashboard

**Status: PASS**

- Business information remains dominant
- Status states use semantic colors
- Data density is controlled
- Navigation and actions follow the brand hierarchy

### Admin Dashboard

**Status: PASS**

- Administrative density does not break the visual system
- Review/rejection states use WARNING/ERROR appropriately
- Primary administrative actions remain Deep Ink
- System remains visually consistent with traveler and agent environments

---

## 13. Accessibility & Legibility

The design system should preserve:

- Strong text/background contrast
- Clear interactive states
- Meaningful labels
- Non-color-only communication of status
- Readable Arabic typography
- Adequate touch targets on mobile
- Clear focus states

Semantic color must never be the only indicator of status.

---

## 14. Brand Drift Prevention

Future screens must not introduce:

- New primary brand colors without approval
- Alternative typography systems
- Random border-radius values
- Colored shadows
- Glow effects
- Excessive gradients
- Decorative semantic colors
- Unapproved icon families
- Uncontrolled spacing values

Any exception should be documented as a deliberate design decision.

---

## 15. Implementation Rules

Before creating a new screen:

1. Reference `DESIGN.md`.
2. Reuse existing tokens and component patterns.
3. Preserve RTL behavior.
4. Use the correct semantic color.
5. Use the correct radius category.
6. Preserve the 4px spacing rhythm.
7. Validate desktop and mobile.
8. Check typography hierarchy.
9. Check accessibility and legibility.
10. Confirm the screen does not introduce brand drift.

---

## 16. Final Audit Checklist

| Area | Result |
|---|---|
| Brand colors | PASS |
| Semantic colors | PASS |
| Typography | PASS |
| Arabic / RTL | PASS |
| Desktop layout | PASS |
| Mobile layout | PASS |
| Radius system | PASS |
| Badges / chips | PASS |
| Spacing rhythm | PASS |
| Elevation | PASS |
| Iconography | PASS |
| Traveler screens | PASS |
| Agent screens | PASS |
| Admin screens | PASS |
| Brand consistency | PASS |

---

# FINAL STATUS

## DESIGN SYSTEM — LOCKED

The THE JOURNEY V1.1 design system is considered internally consistent and ready to serve as the visual source of truth for subsequent product implementation.

**Important:** Locking the design system does not mean the product is fully implemented. It means that future implementation should build against this established visual and semantic foundation.

No application-code assumptions should override the canonical rules in `DESIGN.md` without an explicit product/design decision.

**Next phase:** Product implementation and workflow construction may proceed using the locked design system.
