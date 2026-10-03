# SILA / صلة — Preview Visual QA

**Preview commit reviewed:** `b3d765749273aab94d6196ec01ee3551ca251f70`  
**Deployment:** Vercel Preview  
**Result:** structurally and visually coherent enough to continue; public launch still blocked by name clearance and external cutover gates.

## Verified in a real browser

- Arabic RTL layout is active.
- Approved Arabic SVG logo renders cleanly in the header.
- Public visible name is **صلة / SILA**; no visible THE JOURNEY / الرحلة string was found on the reviewed public pages.
- Core palette is visibly present: Ink / Paper / Apricot.
- Hero hierarchy is strong and readable.
- Search and content windows read as a coherent rounded system.
- Double-dot / relationship signature is visible in the hero/header language.
- Footer works as a dark visual bookend.
- Public information architecture reads clearly: trust → offers → process → agents.

## QA findings and disposition

### Legacy support email
The preview still shows `hello@alrihla.travel`.

**Disposition:** intentionally retained as a fallback until the new sending/support domain is verified. Do not invent or publish an unverified SILA email address.

### Search information window
The outer search container already uses `.sila-window` (24px). Individual form controls remain tighter by design so the hierarchy reads as **window > controls**.

**Disposition:** keep.

### Apricot CTA contrast
Calculated contrast:
- Ink `#08264A` on Apricot `#FFC5AB`: approximately **9.97:1**

**Disposition:** passes comfortably for normal text.

### Empty offer/agent counts in preview
The reviewed preview can show zero marketplace data because it is an isolated preview environment.

**Disposition:** not treated as a brand-layout defect. Production data behavior is a separate release check.

### Navigation CTA position
The acquisition CTA remains at the opposite edge of the logo/navigation cluster.

**Disposition:** keep for now. It creates useful separation between browsing navigation and the agency-acquisition action; no RTL usability break was observed.

## Automated protection added

- Web/mobile token parity test
- Core/semantic contrast test
- Public-brand naming contract
- Build-safe public URL/email config test
- Reduced-motion behavior for Lenis and Framer Motion
- Brand-vs-verification color separation

## Remaining visual QA

Before production merge:
- physical iOS/Android device screenshots
- data-populated offer/agent pages
- final mobile app icon/splash integration
- final social-card raster integration
- final domain/email appearance
- final name-clearance outcome
