# UX AUDIT — THE JOURNEY / الرحلة

> Version 1.1 — August 2026 | Revised Stitch Project Deep Audit

---

## 1. AUDIT METHODOLOGY

This audit is based on a complete review of all screens in the Stitch project (`projects/7267556688057933535`). Each screen was categorized by:

- Screen name and Arabic title
- Device type (Desktop / Mobile)
- Flow it belongs to
- Current state assessment
- Brand alignment assessment
- Completeness assessment
- Action required

**Note on Architecture:** Only full navigable pages are treated as distinct screens. Modals, bottom sheets, drawers, and inline component states (like filters or inline contact tracking) are considered parts of their parent screens, not independent routes.

---

## 2. COMPLETE SCREEN INVENTORY

### Category A: Core Traveler Flows

| Screen ID | Title | Device | State | Brand | Complete | Action |
|-----------|-------|--------|-------|-------|----------|--------|
| `ca1851637d` | الصفحة الرئيسية (v1) | Desktop | Good foundation | Provisional | 70% | REDESIGN |
| `821fbcf55` | الصفحة الرئيسية (v2) | Desktop | Strong layout | Provisional | 75% | REDESIGN |
| `e57b1c26` | نتائج البحث - القاهرة إلى إسطنبول | Desktop | Good structure | Provisional | 80% | REDESIGN |
| `992785e0` | تفاصيل العرض | Desktop | Excellent depth | Provisional | 85% | REDESIGN |
| `72e429df` | ملف الوكيل | Desktop | Excellent structure | Provisional | 80% | REDESIGN |
| `e4e45f24` | التقييمات والمراجعات | Desktop | Good | Provisional | 75% | KEEP + REBRAND |
| `c96d7b0d` | حالات المسافر | Desktop | Catalog screen | Provisional | 60% | REMOVE |

### Category B: Search Filters (Mobile States)

*(Note: These are considered states/bottom sheets of the Search screen, not separate pages)*

| Screen ID | Title | Device | State | Brand | Complete | Action |
|-----------|-------|--------|-------|-------|----------|--------|
| `ab446878` | فلاتر البحث - الافتراضية | Mobile | Good | Provisional | 80% | MERGE (State) |
| `6120a794` | فلاتر البحث - تم الاختيار | Mobile | Good | Provisional | 80% | MERGE (State) |
| `61ef7a12` | فلاتر - توسيع الطيران | Mobile | Good | Provisional | 75% | MERGE (State) |
| `25014b68` | فلاتر - تجربة محسنة | Mobile | Better | Provisional | 85% | MERGE (State) |
| `7a73ac10` | نتائج - فلاتر نشطة | Mobile | Good | Provisional | 80% | MERGE (State) |
| `015b739c` | نتائج - لا توجد نتائج (v1) | Mobile | Good empty state | Provisional | 85% | MERGE (State) |
| `174af3ba` | نتائج - لا توجد نتائج (v2) | Mobile | Better empty state | Provisional | 90% | KEEP (State) |
| `286431eb` | نتائج - فلاتر نشطة محملة | Mobile | Good | Provisional | 80% | MERGE (State) |

### Category C: Agent Flows

| Screen ID | Title | Device | State | Brand | Complete | Action |
|-----------|-------|--------|-------|-------|----------|--------|
| `9ddb57c9` | لوحة تحكم الوكيل | Desktop | Strong foundation | Provisional | 78% | REDESIGN |
| `ac6cc171` | لوحة التحكم - جوال | Mobile | Good | Provisional | 70% | REDESIGN |
| `9774adb1` | إضافة عرض - الخطوة 1 | Desktop | Good wizard step | Provisional | 75% | MERGE |
| `6a98629b` | إضافة عرض - تفاصيل الرحلة | Desktop | Good form | Provisional | 75% | MERGE |
| `23073d73` | إضافة عرض - التسعير | Desktop | Good | Provisional | 75% | MERGE |
| `f8ee26d5` | إضافة عرض - النسخة الموحدة | Desktop | Good unified form | Provisional | 80% | REDESIGN |
| `1efc6317` | إدارة العروض | Desktop | Good list view | Provisional | 78% | REDESIGN |
| `00abc1f9` | طلبات التواصل | Desktop | Good | Provisional | 75% | REDESIGN |
| `dfe06941` | توثيق الحساب | Desktop | Good flow | Provisional | 72% | REDESIGN |

### Category D: Admin Flows

| Screen ID | Title | Device | State | Brand | Complete | Action |
|-----------|-------|--------|-------|-------|----------|--------|
| `561846d5` | لوحة التحكم المركزية (v1) | Desktop | Dashboard layout | Provisional | 70% | MERGE |
| `c163b415` | لوحة التحكم المركزية (v2) | Desktop | Updated dashboard | Provisional | 75% | REDESIGN |
| `4889b440` | مراجعة العروض | Desktop | Good table | Provisional | 75% | REDESIGN |
| `8839384f` | إدارة الوكلاء والتوثيق | Desktop | Good | Provisional | 78% | REDESIGN |
| `95b32d67` | إدارة البيانات الجغرافية | Desktop | Good admin tool | Provisional | 72% | KEEP + REBRAND |
| `6c2d26ba` | حالات الإدارة والوكيل | Desktop | Catalog/states | Provisional | 60% | REMOVE |

### Category E: Code / Data Files (Not UI Screens)

These are TypeScript/CSS source files uploaded to Stitch. They are reference materials, not screens.

| Screen ID | Title | Type | Action |
|-----------|-------|------|--------|
| `12708103...8105` | use-agent-dashboard.ts | TypeScript hook | REMOVE |
| `12708103...9541` | data.ts | Data file | REMOVE |
| `12708103...8823` | format.ts | Utility | REMOVE |
| `12708103...8063` | types.ts | Type definitions | REMOVE |
| `10134125...6692` | globals.css | CSS | REMOVE |
| `12708103...8443` | brand.ts | Brand tokens | REMOVE |
| `12708103...6965` | platform-assets.ts | Assets | REMOVE |
| `12708103...7683` | defaults.ts | Defaults | REMOVE |
| `12708103...7725` | travel-data.ts | Travel data | REMOVE |
| `12708103...9583` | supabase-admin.ts | DB admin client | REMOVE |
| `12708103...6247` | use-current-account.ts | Auth hook | REMOVE |
| `12708103...7345` | supabase.ts | DB client | REMOVE |
| `12708103...7303` | BrandLogo.tsx | Logo component | REMOVE |
| `12708103...9203` | platform-settings.ts | Settings | REMOVE |
| `12708103...6585` | demo-data.ts | Demo data | REMOVE |
| `12708103...5825` | section-registry.ts | Section registry | REMOVE |
| `12708103...5867` | types.ts | Alt types | REMOVE |
| `08683045` | Product Audit Report | Markdown report | REMOVE |
| `8397365` | logo-main.png | Logo asset | EVALUATE |

---

## 3. UX ASSESSMENT BY FLOW

### 3.1 Traveler: Home → Search

**STRONG points in existing screens:**
- Hero section with search module is correctly positioned
- Navigation structure is sound (RTL-correct)
- IBM Plex Sans Arabic choice is excellent
- Agent cards and offer cards have good information hierarchy

**WEAK points:**
- Hero section uses too many gradient effects
- The logo is just text — needs Route Mark integration
- Color palette conflicts with trust positioning
- "المجتمع" (Community) in primary navigation is premature for V1
- Missing: Authentication CTAs in navigation
- Missing: Trust signals on the home page
- Missing: Footer with Legal/Trust page links

**RATING: 6.5/10 — Good foundation, needs full brand + trust redesign**

---

### 3.2 Traveler: Search Results

**STRONG points:**
- Result count display
- Sort controls
- Filter sidebar structure
- Arabic route display (Cairo → Istanbul)

**WEAK points:**
- No loading skeleton state found
- The offer card timer creates urgency pressure that conflicts with trust positioning
- Mobile search results need stronger offer card hierarchy

**RATING: 7/10 — Structure is correct, details need refinement**

---

### 3.3 Traveler: Offer Detail

**STRONG points:**
- Excellent information depth
- Agent section within offer detail
- Action CTA ("تواصل مع الوكيل")

**WEAK points:**
- The offer detail shows contact button but no contact modal/inline state found
- Missing: Inline contact status tracking for traveler
- Breadcrumb navigation missing
- The "Confirmed Price" vs "Starting From" distinction needs clearer visual treatment

**RATING: 7.5/10 — Best screen in the current set**

---

### 3.4 Agent: Profile Page

**STRONG points:**
- Hero section with agent photo, name, badges
- Review summary
- Statistics (response rate, booking count, years)

**WEAK points:**
- Missing: Agent response time display
- The verification badge hierarchy is unclear
- Missing: "Report this agent" option (needed for trust platform)

**RATING: 7/10 — Strong concept, needs trust signal hierarchy refinement**

---

### 3.5 Agent: Dashboard

**STRONG points:**
- Overview statistics (views, contacts, offers)
- Offer management list with status indicators

**WEAK points:**
- The dashboard has two versions — needs consolidation
- Missing: Quick create offer button from dashboard
- Offer status pills need clearer color coding

**RATING: 6.5/10 — Good information architecture, needs consolidation**

---

### 3.6 Agent: Create Offer

**STRONG points:**
- Multi-step wizard approach is correct
- Preview capability

**WEAK points:**
- Three versions found — too many variants, consolidation needed
- Missing: Clear field validation states
- Missing: Submission confirmation

**RATING: 6/10 — Good intent, too many variants, consolidation critical**

---

### 3.7 Admin Flow

**STRONG points:**
- Agent verification queue with document review area
- Geographic data management screen is excellent

**WEAK points:**
- Two admin dashboard versions
- Missing: Admin login screen entirely
- Missing: Rejection reason field

**RATING: 6/10 — Solid foundation, missing critical auth and rejection flows**

---

### 3.8 Empty States Assessment

| Screen | Empty State Present | Quality | Action |
|--------|--------------------|---------|----|
| Search results | YES (2 variants) | Good | Use 174af3ba as primary |
| Dashboard | PARTIAL | Weak | Redesign needed |
| Contact requests | NOT FOUND | Missing | Must create |
| Saved offers | NOT FOUND | Missing | Must create |
| Notifications | NOT FOUND | Missing | Must create |

---

### 3.9 Loading States Assessment

**Critical gap:** No loading skeleton states found in any screen (Search, Details, Dashboard).

---

### 3.10 Error States Assessment

**Critical gap:** No Error 500, 404, or Network Error states found.

---

## 4. BRAND ALIGNMENT ASSESSMENT

| Dimension | Current | Target | Gap |
|-----------|---------|--------|-----|
| Color | Blue + Orange | Ink Blue + Warm Stone | HIGH |
| Typography | IBM Plex Sans Arabic | IBM Plex Sans Arabic | MEDIUM |
| Logo | Text wordmark | Route Mark system | HIGH |
| RTL quality | Good | Excellent | LOW |
| Mobile quality | Partial | Full coverage | MEDIUM |
| Legal/Trust | None | Integrated in Footer | HIGH |

---

## 5. CRITICAL UX ISSUES (Must Fix Before Launch)

1. **No authentication screens** — Cannot register or log in
2. **No contact request flow completion/tracking** — What happens after "تواصل مع الوكيل"?
3. **No offer submission confirmation** — Agent submits offer but nothing confirms it
4. **No admin login** — Admin portal has no entry point
5. **No legal/trust pages** — Terms, Privacy, Verification policies are missing
6. **No loading or error states** — The product will feel broken
7. **Two versions of several screens** — Causes visual inconsistency
8. **Community navigation item** — Leads nowhere (not V1), must be removed
9. **The color palette** — Must be updated to Ink & Horizon
10. **Logo** — Needs proper Route Mark treatment

---

*Document Owner: UX Team*
*Status: V1.1 — REVISED*
*Next: SCREEN_MAP.md*
