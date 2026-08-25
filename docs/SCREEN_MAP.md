# SCREEN MAP — THE JOURNEY / الرحلة

> Version 1.1 — August 2026 | Revised Final Screen Architecture

---

## 1. SCREEN MAP OVERVIEW

This document defines the final screen architecture of THE JOURNEY MVP. Each screen in the existing Stitch project has been classified as:

- **KEEP** — Screen is complete and correct, minor brand update only
- **REDESIGN** — Screen has correct structure but needs brand + UX updates
- **MERGE** — Screen duplicates another, combine into one canonical version
- **NEW** — Screen does not exist and must be created
- **REMOVE** — Screen is a dev artifact, catalog screen, or code file not needed in production

**Architecture Rule:** Modals, Bottom Sheets, Drawers, and Component States (like inline contact tracking or filter sheets) are **NOT** counted as independent routes. Only real navigable pages are routes.

---

## 2. FINAL SCREEN CLASSIFICATIONS

### Existing Stitch Screens

| Stitch ID | Arabic Title | Classification | New Name | Priority |
|-----------|-------------|----------------|----------|----------|
| `ca1851637d` | الصفحة الرئيسية (v1) | MERGE → Primary | home | P0 |
| `821fbcf55` | الصفحة الرئيسية (v2) | MERGE → Primary | home | P0 |
| `e57b1c26` | نتائج البحث | REDESIGN | search-results | P0 |
| `992785e0` | تفاصيل العرض | REDESIGN | offer-detail | P0 |
| `72e429df` | ملف الوكيل | REDESIGN | agent-profile | P0 |
| `e4e45f24` | التقييمات والمراجعات | REDESIGN | reviews | P0 |
| `c96d7b0d` | حالات المسافر | REMOVE | — | — |
| `ab446878` | فلاتر البحث - الافتراضية | MERGE (State) | search-filters | P0 |
| `6120a794` | فلاتر - تم الاختيار | MERGE (State) | search-filters | P0 |
| `61ef7a12` | فلاتر - توسيع الطيران | MERGE (State) | search-filters | P0 |
| `25014b68` | فلاتر - تجربة محسنة | MERGE (State) | search-filters | P0 |
| `7a73ac10` | نتائج - فلاتر نشطة | MERGE (State) | search-results-filtered | P0 |
| `015b739c` | نتائج - لا توجد نتائج (v1) | MERGE → 174af3ba | — | — |
| `174af3ba` | نتائج - لا توجد نتائج (v2) | KEEP (State) | search-empty | P0 |
| `286431eb` | نتائج - فلاتر نشطة محملة | MERGE (State) | — | — |
| `9ddb57c9` | لوحة تحكم الوكيل | REDESIGN | agent-dashboard | P0 |
| `ac6cc171` | لوحة التحكم - جوال | REDESIGN | agent-dashboard-mobile | P1 |
| `9774adb1` | إضافة عرض - الخطوة 1 | MERGE → f8ee | — | — |
| `6a98629b` | إضافة عرض - تفاصيل الرحلة | MERGE → f8ee | — | — |
| `23073d73` | إضافة عرض - التسعير | MERGE → f8ee | — | — |
| `f8ee26d5` | إضافة عرض - النسخة الموحدة | REDESIGN | offer-create | P0 |
| `1efc6317` | إدارة العروض | REDESIGN | offer-manage | P0 |
| `00abc1f9` | طلبات التواصل | REDESIGN | contacts-inbox | P0 |
| `dfe06941` | توثيق الحساب | REDESIGN | agent-verification | P0 |
| `561846d5` | لوحة التحكم المركزية (v1) | MERGE → c163b415 | — | — |
| `c163b415` | لوحة التحكم المركزية (v2) | REDESIGN | admin-dashboard | P0 |
| `4889b440` | مراجعة العروض | REDESIGN | admin-offer-review | P0 |
| `8839384f` | إدارة الوكلاء والتوثيق | REDESIGN | admin-agent-management | P0 |
| `95b32d67` | إدارة البيانات الجغرافية | KEEP + REBRAND | admin-travel-data | P1 |
| `6c2d26ba` | حالات الإدارة والوكيل | REMOVE | — | — |
| Code files (16 files) | Various .ts/.tsx/.css | REMOVE (from canvas) | — | — |
| `08683045` | Product Audit Report | REMOVE | — | — |
| `8397365` | logo-main.png | EVALUATE → Update | — | — |

---

## 3. FINAL PRODUCT SCREEN MAP

The following is the complete, final screen architecture of THE JOURNEY V1.
Each screen marked [NEW] does not exist and must be built.
*Note: Modals and drawers are listed under their parent screens, not as separate routes.*

---

### ZONE 1: PUBLIC / TRAVELER FACING

```
/
└── HOME                                [REDESIGN from merge of ca1851637d + 821fbcf55]
    Sections: Nav (RTL, Auth), Hero search, Trust stats, Featured offers

/offers
└── SEARCH RESULTS                      [REDESIGN of e57b1c26]
    States: Loading skeleton | Results | Empty | Error | Filtered
    Components: Filter sidebar (desktop) / Bottom sheet (mobile)

/offers/[id]
└── OFFER DETAIL                        [REDESIGN of 992785e0]
    States: Loading skeleton | Loaded | Expired | Error
    Components:
    - Offer hero, Price block, Details
    - Agent card (mini profile)
    - Contact CTA
    - Contact Modal/Drawer (NEW)
    - Inline Contact Status (NEW - for tracking submitted requests)

/agents/[id]
└── AGENT PROFILE                       [REDESIGN of 72e429df]
    States: Loading skeleton | Loaded | Error

/reviews/[agent-id]
└── ALL REVIEWS                         [REDESIGN of e4e45f24]
```

### ZONE 2: AUTHENTICATION

```
/login
└── TRAVELER LOGIN                      [NEW]
    Components: Email + password form

/register
└── TRAVELER REGISTRATION               [NEW]
    Components: Form + terms acceptance

/verify-email
└── EMAIL VERIFICATION                  [NEW]

/forgot-password
└── FORGOT PASSWORD                     [NEW]

/agents/register
└── AGENT REGISTRATION                  [NEW]
    Steps: Account creation → Profile basics → Docs upload
```

### ZONE 3: AUTHENTICATED TRAVELER

```
/profile
└── TRAVELER PROFILE                    [NEW]
    Components: Personal info, contact request history (inline status tracking)

/saved
└── SAVED OFFERS                        [NEW] (Promoted to V1)
    States: Empty | Has saved offers

/notifications
└── NOTIFICATIONS                       [NEW]
    States: Empty | Has notifications
```

### ZONE 4: AGENT PORTAL (AUTHENTICATED, VERIFIED)

```
/dashboard
└── AGENT DASHBOARD                     [REDESIGN of 9ddb57c9]
    States: Loading skeleton | First-time | Active | Suspended

/dashboard/offers
└── OFFER MANAGEMENT                    [REDESIGN of 1efc6317]

/dashboard/offers/new
└── CREATE OFFER                        [REDESIGN of f8ee26d5]
    Components: Multi-step wizard
    States: Success confirmation (inline or route)

/dashboard/offers/[id]/edit
└── EDIT OFFER                          [NEW]

/dashboard/contacts
└── CONTACTS INBOX                      [REDESIGN of 00abc1f9]
    States: Empty | Has contacts

/dashboard/contacts/[id]
└── CONTACT REQUEST DETAIL              [NEW]
    Components: Traveler info, response form

/dashboard/profile
└── AGENT PROFILE EDITOR                [NEW]

/dashboard/verification
└── VERIFICATION STATUS                 [REDESIGN of dfe06941]

/dashboard/analytics
└── PERFORMANCE ANALYTICS               [NEW] (V1 Implementation)
    Components: Views, Contacts, Response Rate, Top Offers
```

### ZONE 5: ADMIN PORTAL

```
/admin/login
└── ADMIN LOGIN                         [NEW]

/admin/dashboard
└── ADMIN DASHBOARD                     [REDESIGN of c163b415]

/admin/agents
└── AGENT MANAGEMENT                    [REDESIGN of 8839384f]

/admin/agents/[id]
└── AGENT VERIFICATION DETAIL           [NEW]

/admin/offers
└── OFFER REVIEW QUEUE                  [REDESIGN of 4889b440]

/admin/offers/[id]
└── OFFER REVIEW DETAIL                 [NEW]
    Components: Full preview, Approve button, Reject button + Reason Modal (NEW)

/admin/reviews
└── REVIEW MANAGEMENT                   [NEW]

/admin/data
└── TRAVEL DATA MANAGEMENT              [KEEP + REBRAND of 95b32d67]

/admin/settings
└── PLATFORM SETTINGS                   [NEW]
```

### ZONE 6: LEGAL / TRUST (PUBLIC)

```
/legal/terms
└── TERMS OF SERVICE                    [NEW]

/legal/privacy
└── PRIVACY POLICY                      [NEW]

/legal/verification
└── AGENT VERIFICATION POLICY           [NEW]

/legal/reviews
└── REVIEW POLICY                       [NEW]

/legal/disclaimer
└── OFFER / PRICE DISCLAIMER            [NEW]
```

### ZONE 7: SYSTEM / UTILITY SCREENS

```
/404
└── NOT FOUND                           [NEW]

/500
└── SERVER ERROR                        [NEW]

/maintenance
└── MAINTENANCE MODE                    [NEW]
```

---

## 4. NAVIGABLE SCREEN COUNT SUMMARY

| Zone | Existing Screens Used | New Screens Needed | Total Navigable |
|------|--------------------|-------------------|-------|
| Public / Traveler | 6 (redesigned) | 0 | 6 |
| Authentication | 0 | 5 | 5 |
| Auth Traveler | 0 | 3 | 3 |
| Agent Portal | 7 (redesigned) | 4 | 11 |
| Admin Portal | 4 (redesigned) | 5 | 9 |
| Legal / Trust | 0 | 5 | 5 |
| System / Utility | 0 | 3 | 3 |
| **TOTAL** | **17** | **25** | **42** |

*(Note: Modals, drawers, and filter sheets are excluded from this count as they are component states, not routes).*

---

*Document Owner: Product + UX Team*
*Status: V1.1 — REVISED*
*This is the final, canonical screen map for V1.*
