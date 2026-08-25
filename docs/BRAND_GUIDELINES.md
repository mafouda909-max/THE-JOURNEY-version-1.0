# BRAND GUIDELINES — THE JOURNEY / الرحلة

> Version 1.1 — August 2026 | Revised Visual Identity Direction

---

## 1. VISUAL IDENTITY OVERVIEW

The visual identity of THE JOURNEY is built on four pillars:

1. **Clarity** — Every visual element serves communication, not decoration
2. **Trust** — The aesthetic must feel professional, stable, and credible
3. **Depth** — Tonal layering creates hierarchy without relying on decoration
4. **Arabic-first** — The system is designed RTL-native, with Arabic as the primary language

---

## 2. COLOR SYSTEM

### 2.1 Why We Are Changing the Existing Palette

The existing Stitch palette (Electric Blue #1a56db + Burnt Orange #904d00) has structural problems:

- The orange secondary reads as aggressive and impulsive — not aligned with trust positioning
- The blue-on-white combination is generic (used by virtually every fintech and travel OTA)
- The color temperature creates a technological coldness that conflicts with the human brand personality
- The orange-blue combination is culturally associated with budget airlines and discount travel in the Arab market — the opposite of the premium trust positioning we need

### 2.2 New Color Direction: Ink & Horizon

**Concept:** The palette draws from the moment just before dawn over a horizon — deep, grounded, with a warm breath of light. It projects depth, intelligence, and quiet confidence.

### 2.3 Primary Color — Deep Ink Blue

This is not the generic tech-blue. It is a deeper, more sophisticated blue with a slight warmth — the blue of serious institutions, not startups.

```
Primary:              hsl(222, 72%, 22%)   →  #1A2B6D  (Deep Ink)
Primary Light:        hsl(222, 70%, 38%)   →  #2643A8  (Horizon Blue)
Primary Container:    hsl(222, 60%, 94%)   →  #EEF1FB  (Light Ink Wash)
On Primary:           #FFFFFF
On Primary Container: hsl(222, 72%, 18%)   →  #162258
```

**Why this blue:** It signals authority, trust, and intelligence without being cold or corporate. It reads well in both Arabic and English typography. It is distinctive in the travel category where lighter blues dominate.

### 2.4 Secondary Color — Warm Stone

Replacing the orange with a sophisticated warm neutral that suggests reliability and approachability:

```
Secondary:             hsl(30, 18%, 40%)   →  #7A6655  (Warm Stone)
Secondary Light:       hsl(30, 22%, 55%)   →  #A68C7A  (Sand)
Secondary Container:   hsl(30, 22%, 94%)   →  #F5EFE9  (Parchment)
On Secondary:          #FFFFFF
On Secondary Container: hsl(30, 18%, 25%)  →  #4D3D31
```

**Why warm stone:** It gives the interface warmth and humanity without the aggression of orange. It pairs with the ink blue to create a premium, editorial feel.

### 2.5 Accent Color — Discovery Gold (Used Sparingly)

Used only for: active offer timers, premium badges, featured status.

```
Accent:              hsl(40, 80%, 48%)    →  #D4890A  (Warm Gold)
Accent Light:        hsl(40, 90%, 92%)   →  #FDF2DC  (Soft Amber)
```

**Usage rule:** Maximum 2 instances per screen. Never as backgrounds. Only for critical trust signals and time-sensitive elements.

### 2.6 Semantic Colors

```
Success:              hsl(152, 70%, 32%)  →  #159050  (Verified Green)
Success Container:    hsl(152, 70%, 94%)  →  #E5F7ED
On Success:           #FFFFFF

Warning:              hsl(38, 92%, 40%)   →  #C87A06  (Amber Alert)
Warning Container:    hsl(38, 90%, 92%)   →  #FDF1DC
On Warning:           #FFFFFF

Error:                hsl(0, 72%, 42%)    →  #BE2A2A  (Firm Red)
Error Container:      hsl(0, 70%, 95%)    →  #FBEBEB
On Error:             #FFFFFF

Info:                 hsl(210, 65%, 40%)  →  #2563A8  (Deep Horizon)
Info Container:       hsl(210, 60%, 94%)  →  #EAF2FB
On Info:              #FFFFFF
```

**Key rule for Verified Green:** This color is EXCLUSIVELY reserved for verified agent status and confirmed price indicators. Never use it decoratively.

### 2.7 Surface & Background System

```
Background:              hsl(220, 20%, 97%)  →  #F6F7FA  (Near White)
Surface:                 #FFFFFF
Surface Container Low:   hsl(220, 20%, 96%)  →  #F3F4F8
Surface Container:       hsl(220, 20%, 93%)  →  #ECEEF4
Surface Container High:  hsl(220, 20%, 90%)  →  #E4E6EE
Surface Container Highest: hsl(220, 20%, 86%) → #DADDE8

Surface Dim (Overlays):  hsl(220, 20%, 88%)  →  #DDE0EB
Surface Inverse:         hsl(222, 45%, 18%)  →  #1D2748
On Surface Inverse:      hsl(220, 20%, 95%)  →  #F0F1F7
```

### 2.8 Text Colors

```
On Background (Primary text):   hsl(222, 30%, 12%)  →  #141A2C  (Near Black)
On Surface Variant (Secondary): hsl(222, 15%, 38%)  →  #545D73  (Muted Slate)
Outline:                        hsl(222, 12%, 65%)  →  #959DB3  (Subtle Border)
Outline Variant:                hsl(222, 15%, 84%)  →  #D2D6E3  (Faint Border)
```

---

## 3. TYPOGRAPHY SYSTEM

### 3.1 Why Typography Is the Brand

For an Arabic-first product, typography IS the brand. The typeface carries the entire personality in every headline, label, and body paragraph.

### 3.2 Primary Arabic Typeface: IBM Plex Sans Arabic

**KEEP IBM Plex Sans Arabic** — It is an excellent choice and rare enough to be distinctive:

- Geometric yet humanist — projects intelligence without coldness
- Strong at display sizes in Arabic
- Excellent Latin fallback (IBM Plex Sans for English)
- Outstanding numeral design — critical for price display
- Readable at small sizes — critical for mobile UI
- Not decorative — perfect for a trust-first product
- Available on Google Fonts

**What we are changing:** How we use it. The current implementation does not exploit the full typographic range of the typeface.

### 3.3 Typography Scale (Final)

```
Display XL:     56px / Line 64px / Weight 700 / Tracking -0.03em
                Arabic headlines, hero sections only

Display LG:     48px / Line 60px / Weight 700 / Tracking -0.02em
                Primary page titles, search results header

Display MD:     40px / Line 52px / Weight 700 / Tracking -0.01em
                Section headlines, landing page sections

Headline LG:    32px / Line 40px / Weight 600 / Tracking -0.01em
                Agent profile names, offer titles

Headline MD:    24px / Line 32px / Weight 600 / Tracking 0
                Card titles, modal headers

Title LG:       20px / Line 28px / Weight 600 / Tracking 0
                Navigation items, sub-section headers

Title MD:       18px / Line 26px / Weight 600 / Tracking 0
                Card sub-headers, tab labels

Body LG:        18px / Line 28px / Weight 400 / Tracking 0
                Primary body text, descriptions

Body MD:        16px / Line 24px / Weight 400 / Tracking 0
                Standard UI text, form labels

Body SM:        14px / Line 20px / Weight 400 / Tracking 0
                Supporting text, secondary info

Label LG:       14px / Line 20px / Weight 500 / Tracking 0
                Buttons, badges, tabs (active)

Label MD:       13px / Line 18px / Weight 500 / Tracking 0.01em
                Small badges, chips, status labels

Label SM:       11px / Line 16px / Weight 500 / Tracking 0.04em
                Airport codes, timestamps, metadata
```

### 3.4 Special Typography Treatments

**Airport Codes / Flight Numbers:**
- Font: IBM Plex Mono (monospace companion) OR IBM Plex Sans Arabic with tabular-nums
- Weight: 600
- Letter-spacing: 0.08em
- Size: 13px at normal, 16px at featured

**Prices:**
- Font: IBM Plex Sans Arabic
- Weight: 700
- Size: Scales from 20px (list) to 32px (detail page)
- Numeral style: tabular, lining

**Arabic Labels in English UI:**
- Always IBM Plex Sans Arabic
- Never switch to a decorative Arabic font

---

## 4. LOGO DIRECTION

### 4.1 Concept: The Route Mark (V1.1 Refined)

The logo captures the essence of a journey — a path leading to a destination. 
It must communicate **Journey, Direction, and Destination** without relying on overused travel clichés (no airplane, no globe, no generic map pin).

**Execution:**
- A minimal, geometric route/path mark that terminates in a destination dot.
- Example structure: A clean, curved or angled line segment that flows from one point and ends decisively in a solid circle (dot).
- Extremely simple, enabling it to scale perfectly to small sizes.
- Works beautifully as a standalone icon, an app icon, or a favicon.

### 4.2 Wordmarks

**Arabic Wordmark (Primary):**
- Text: **الرحلة**
- Typeface: IBM Plex Sans Arabic (700 Bold)
- Tracking: 0 (natural Arabic spacing)
- Color: `#1A2B6D` (Deep Ink) or `#FFFFFF` (on dark)

**English Wordmark (Secondary):**
- Text: **THE JOURNEY**
- Typeface: IBM Plex Sans (500 Medium)
- Tracking: +0.12em
- Case: All caps
- Size: ~55% of the Arabic wordmark height
- Color: `#1A2B6D`

### 4.3 Recommended Lockups

| Name | Composition | Use |
|------|------------|-----|
| **Primary** | Route Mark (Path + Dot) + Arabic Wordmark (large) + English Wordmark (small, below) | Marketing, desktop header, print |
| **Compact** | Route Mark + Arabic Wordmark only | App navigation bar, mobile header |
| **Horizontal EN** | Route Mark + "THE JOURNEY" + Arabic subtitle | English-first contexts |
| **Symbol only** | Route Mark alone | App icon, favicon, embossed |
| **Monochrome** | Full primary lockup in single color | Black-on-white, white-on-dark |

### 4.4 Favicon / App Icon / Minimum Size

- **Favicon (16x16 / 32x32):** Route Mark symbol only, `#1A2B6D` on transparent/white.
- **App Icon (1024x1024):** Route Mark symbol centered on `#1A2B6D` background, symbol in `#FFFFFF`.
- **Minimum Size:** Symbol only (16px), Compact Lockup (80px wide), Primary Lockup (120px wide).
- **Clear Space:** Equal to the x-height of "الرحلة" at the current display size.

---

## 5. BORDER RADIUS SYSTEM

```
None:    0px     — Dividers, data tables
XS:      4px     — Tags, code elements
SM:      6px     — Chips, badges, small buttons
MD:      8px     — Buttons, inputs, standard cards (PRIMARY RADIUS)
LG:      12px    — Feature cards, modals
XL:      16px    — Hero search module, highlighted sections
2XL:     24px    — Large feature panels
Full:    9999px  — Pills, avatar rings, selection chips
```

**Key rule:** The search module uses XL (16px). Standard interactive elements use MD (8px). Pills/badges use Full.

---

## 6. SHADOW SYSTEM (Tonal + Ambient)

```
Shadow XS:   0 1px 2px rgba(20,26,44,0.06)       — Inputs at rest
Shadow SM:   0 2px 8px rgba(20,26,44,0.08)       — Cards at rest
Shadow MD:   0 4px 16px rgba(20,26,44,0.10)      — Cards on hover
Shadow LG:   0 8px 32px rgba(20,26,44,0.12)      — Modals, drawers
Shadow XL:   0 16px 48px rgba(20,26,44,0.16)     — Full-screen overlays
```

No colored shadows. No glow effects. No neumorphism.

---

## 7. SPACING SYSTEM

Base unit: 4px

```
2:    8px    — Tight internal padding (badge, chip)
3:    12px   — Input internal padding
4:    16px   — Standard component padding
5:    20px   — Section internal padding
6:    24px   — Grid gutter, standard gap
8:    32px   — Section separation
10:   40px   — Desktop horizontal margin
12:   48px   — Large section separation
16:   64px   — Hero section padding
20:   80px   — Major section breaks
```

Container max: 1280px
Desktop margin: 40px (each side)
Mobile margin: 16px (each side)
Tablet: 24px

---

## 8. ICONOGRAPHY

**Icon library:** Google Material Symbols (Outlined weight, 24px base)
**Customization:** Do not mix icon styles. Filled style used only for "active" state in navigation.
**Size scale:** 16px (dense UI), 20px (standard), 24px (default), 32px (featured), 48px (empty states)

**Custom icon needs (to be designed):**
- Verified agent badge (shield + checkmark, distinct from Material)
- Trust score indicator (custom star/rating system)
- Route indicator (origin to destination arrow)

---

## 9. PHOTOGRAPHY STYLE

**Subject:** Real people traveling, real agents working, real destinations
**Tone:** Warm, documentary, authentic — not staged stock photography
**Color grading:** Desaturated slightly, warm shadows — never cold, blue-filtered
**People:** Diverse representation of Arab travelers and professionals
**Destinations:** Architectural, cultural, not generic beach/paradise

**Forbidden photography:**
- No stock photography of white Western travelers
- No oversaturated tropical beaches
- No generic airplane window shots
- No stock "happy family vacation" images

---

## 10. ILLUSTRATION STYLE

**Usage:** Only for empty states, onboarding, and error states
**Style:** Geometric line illustration, minimal color fill, 2-color palette (primary + one accent)
**Character:** Avoid faces. Use abstract representations of people (silhouettes, paths).
**Voice:** Every illustration tells a mini-story ("No results yet — try different filters")

---

## 11. MOTION PRINCIPLES

**Principle:** Motion should feel purposeful, not decorative.

```
Duration XS:   100ms — State changes (hover, active)
Duration SM:   200ms — Micro-interactions (badge appear, toggle)
Duration MD:   300ms — Component transitions (panel open, tab switch)
Duration LG:   400ms — Page transitions, modal appear
Duration XL:   500ms — Full screen transitions

Easing:  Deceleration (ease-out) for elements entering the screen
         Acceleration (ease-in) for elements leaving
         Standard (ease-in-out) for state changes
```

**Forbidden motion:**
- No bouncing/spring animations (signals playfulness, not trust)
- No continuous animations on idle state
- No parallax scrolling on core content

---

## 12. DARK MODE DIRECTION

Dark mode is planned but deferred from MVP. The design system must be structured so dark mode can be added without a redesign.

**Planned dark surface:** hsl(222, 35%, 10%) — a warm near-black, not pure black

---

## 13. RTL IMPLEMENTATION RULES

1. All layouts are RTL-first. LTR is the secondary adaptation.
2. Icons that imply direction (arrows, chevrons) MUST be mirrored in RTL.
3. Text alignment is right-aligned by default.
4. Navigation reads right-to-left.
5. Sidebar filters appear on the RIGHT side in desktop RTL.
6. Progress indicators flow right-to-left.
7. Form fields: label right-aligned, text input right-aligned.
8. Dates: Use Arabic-Indic numerals option in Arabic content, Western numerals in English.
9. The back button in mobile navigation: points LEFT in RTL (toward right in flow).

---

*Document Owner: Product & Brand Team*
*Status: V1.1 — REVISED*
*Depends on: BRAND_STRATEGY.md (approved)*
*Next: PRODUCT_SPEC.md*
