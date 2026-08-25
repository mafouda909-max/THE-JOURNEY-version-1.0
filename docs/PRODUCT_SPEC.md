# PRODUCT SPECIFICATION — THE JOURNEY / الرحلة

> Version 1.1 — August 2026 | Revised after Final Approval Checkpoint

---

## 1. PRODUCT OVERVIEW

### Product Name
**THE JOURNEY / الرحلة**

### Product Type
**Two-sided Travel Marketplace with Trust Infrastructure**

### Core Loop

```
TRAVELER:
Search → Discover Offers → Compare Agents → Evaluate Trust → Contact Agent

AGENT:
Register → Verify → Create Profile → Publish Offers → Receive Contacts → Build Reputation

ADMIN:
Monitor → Verify Agents → Review Offers → Approve/Reject → Manage Platform
```

### What Makes THE JOURNEY Different
Unlike booking engines (where a platform intermediates the transaction), THE JOURNEY is a **lead generation and trust marketplace**. The traveler contacts the agent directly. THE JOURNEY enables the connection, verifies the participants, and tracks the outcomes.

---

## 2. USER ROLES & PERMISSIONS

### 2.1 TRAVELER (مسافر)

**Authentication:** Optional for browsing, required for contact requests
**Permissions:**
- Browse all published offers (unauthenticated)
- Search by destination, date, trip type, price range, agent rating
- View offer details
- View agent profiles
- Submit contact requests (authenticated)
- View contact request status (inline/modal)
- Leave reviews after confirmed interaction
- Save favorite offers
- Receive notifications

**Trust indicators presented TO traveler:**
- Agent verification badge (government ID verified)
- Agent license badge (travel agency license verified)
- Review score and count
- Response rate percentage
- Years on platform
- Total completed trips

### 2.2 AGENT (وكيل)

**Authentication:** Required for all actions
**Registration sub-states:**
- Pending Registration
- Verification Submitted
- Verification In Review
- Verified (can publish offers)
- Suspended (can view only)
- Rejected

**Permissions (Verified agents only):**
- Create and publish offers
- Edit published offers (limited fields, with re-approval for major changes)
- Delete own offers
- View contact requests from travelers
- Respond to contact requests
- View own performance analytics
- Edit own profile
- Upload documents for verification

**Restrictions:**
- Cannot modify price after offer goes live without triggering re-review
- Cannot see other agents' contact request counts
- Cannot contact travelers proactively (traveler initiates)

### 2.3 ADMIN (مدير النظام)

**Authentication:** Separate admin login, two-factor required
**Permissions:**
- Review and approve/reject agent verification requests
- Suspend or terminate agent accounts
- Review and approve/reject offer submissions
- Edit platform travel data (destinations, airlines, trip types)
- View all platform analytics
- Manage reviews (flag, remove if policy violation)
- Send system notifications
- Access audit logs

---

## 3. CORE DATA MODELS

### 3.1 User

```
user_id         UUID (primary key)
email           STRING (unique)
phone           STRING
role            ENUM: traveler, agent, admin
created_at      TIMESTAMP
last_login      TIMESTAMP
is_active       BOOLEAN
language_pref   ENUM: ar, en
```

### 3.2 Agent Profile

```
agent_id            UUID → user_id
display_name        STRING (Arabic preferred)
bio                 TEXT (Arabic + English)
photo_url           STRING
city                STRING
license_number      STRING (optional, shown if verified)
license_type        ENUM: individual, agency
verification_status ENUM: pending, in_review, verified, rejected, suspended
verified_at         TIMESTAMP
specialty_tags      ARRAY (e.g., Umrah, Europe, Cruises)
languages_spoken    ARRAY
response_rate       FLOAT (calculated)
avg_response_hours  FLOAT (calculated)
total_offers        INT (calculated)
total_reviews       INT (calculated)
avg_rating          FLOAT (calculated, 1–5)
joined_at           TIMESTAMP
```

### 3.3 Offer

```
offer_id            UUID
agent_id            UUID → agent_profile
title               STRING (Arabic required, English optional)
description         TEXT
trip_type           ENUM: flight, package, visa, umrah, hotel, cruise, custom
origin_city         STRING
destination_city    STRING
origin_country      STRING
destination_country STRING
departure_date      DATE (nullable for open/flexible offers)
return_date         DATE (nullable)
duration_days       INT (nullable)
price               DECIMAL
currency            ENUM: SAR, EGP, AED, USD, EUR
price_type          ENUM: per_person, per_group, starting_from
includes            ARRAY (e.g., visa, hotel, transport)
excludes            ARRAY
min_travelers       INT
max_travelers       INT
offer_status        ENUM: draft, pending_review, published, expired, rejected, archived
expires_at          TIMESTAMP
published_at        TIMESTAMP
view_count          INT (calculated)
contact_count       INT (calculated)
rejection_reason    TEXT (admin-set on rejection)
```

### 3.4 Contact Request (Lifecycle Updated for V1)

```
request_id      UUID
offer_id        UUID → offer
traveler_id     UUID → user
agent_id        UUID → agent_profile
message         TEXT
traveler_count  INT
travel_dates    TEXT (flexible input)
traveler_status ENUM: new_request, pending, agent_viewed, agent_responded, closed, cancelled
agent_status    ENUM: new, viewed, responded, closed
created_at      TIMESTAMP
read_at         TIMESTAMP
responded_at    TIMESTAMP
```

### 3.5 Review

```
review_id       UUID
reviewer_id     UUID → user (traveler)
agent_id        UUID → agent_profile
rating          INT (1–5)
content         TEXT
is_verified     BOOLEAN (admin-confirmed interaction)
created_at      TIMESTAMP
is_visible      BOOLEAN (admin can set false)
```

---

## 4. CORE FEATURE SPECIFICATIONS

### 4.1 Search System

**Inputs:**
- Origin (autocomplete from platform city database)
- Destination (autocomplete)
- Trip type (multi-select: flight, package, visa, umrah, hotel, cruise)
- Date range (optional, flexible or fixed)
- Number of travelers

**Results:**
- Sorted by: Relevance (default), Price (low to high), Rating (high to low), Newest
- Filtered by: Price range, Agent rating, Trip type, Airline, Duration, Includes

**Search behavior:**
- Real-time filtering without page reload
- Results count visible always
- Empty state shows actionable alternatives (broaden search, change filters)
- Mobile: filters in bottom sheet, not sidebar

### 4.2 Offer Lifecycle

```
DRAFT → [Agent saves, not submitted]
   ↓
PENDING REVIEW → [Agent submits for publication]
   ↓
[Admin Review]
   ↓ (approved)              ↓ (rejected)
PUBLISHED              REJECTED (with reason sent to agent)
   ↓
[Automatic expiry at expires_at]
   ↓
EXPIRED
   ↓
[Agent can renew → back to PENDING REVIEW]
```

**Auto-expiry:** All offers have a hard expiry date (max 90 days from publication). Agents receive reminder 7 days and 1 day before expiry.

**Price change policy:** Changing price on a published offer triggers re-review. Minor edits (description, photos) do not require re-review.

### 4.3 Agent Verification Flow

```
Step 1: Complete Profile (name, photo, bio, city, specialty)
Step 2: Submit Verification Documents
        - National ID (required)
        - Tourism license (optional, unlocks "Licensed Agent" badge)
        - Commercial registration (optional, for agencies)
Step 3: Admin reviews documents (SLA: 48 hours)
Step 4: Approved → Verified badge + can publish offers
        Rejected → Rejection reason sent, can resubmit in 30 days
```

### 4.4 Review System

**Who can review:** Any traveler who has submitted a contact request to an agent
**Review window:** Opens 24 hours after contact request submitted, closes 90 days after
**Verification:** Admin can mark reviews as "Verified Transaction" if trip completion is confirmed
**Anti-gaming:** Agent cannot respond to reviews (Phase 2 feature). Rating is immutable once submitted.

### 4.5 Notifications

**Traveler notifications (V1):**
- Contact request status updates (agent viewed, agent responded)
- Offer saved is expiring soon
- New offers matching saved search

**Agent notifications:**
- New contact request received
- Offer approved/rejected
- Offer expiring in 7 days / 1 day
- New review submitted
- Account verification status change

**Admin notifications:**
- New agent verification request
- New offer pending review
- Flagged review

### 4.6 Contact Lifecycle

Travelers are able to track the status of their contact requests inline (e.g. from a drawer or their profile) rather than navigating to a brand new page context. 
Agent dashboards will reflect their respective statuses.

### 4.7 Agent Analytics (V1)
Initial implementation is lightweight but functional:
- Total Views
- Total Contacts
- Response Rate (%)
- Top performing offers (by views/contacts)
- Basic trend visualization (e.g. 30-day sparkline)

---

## 5. PLATFORM RULES

### 5.1 Content Policy

- All offer titles and descriptions must be in Arabic (English additions allowed)
- No false price claims — "starting from" must be clearly labeled
- No offers for services not covered by agent's stated specialty
- No direct contact information in offer descriptions (phone, WhatsApp, etc.)

### 5.2 Agent Conduct

- Agents must respond to contact requests within 48 hours or response rate is impacted
- Agents cannot publish duplicate offers (same route, same dates, same price)
- Agents suspended for 3 or more policy violations within 90 days

### 5.3 Quality Standards for Offers

Admin review checklist:
- [ ] Price is realistic and clearly stated
- [ ] Trip type matches content
- [ ] Origin and destination are valid cities
- [ ] "Includes" and "excludes" are clearly listed
- [ ] No misleading imagery
- [ ] Description is complete and in Arabic

---

## 6. LEGAL & TRUST FOUNDATION

These functional pages must exist as accessible resources linked from the footer:
- **Terms of Service:** User rights and responsibilities.
- **Privacy Policy:** Data handling and storage.
- **Agent Verification Policy:** Criteria for verification and limits of guarantee.
- **Review Policy:** Moderation and submission guidelines.
- **Offer / Price Disclaimer:** Accuracy limits and "starting from" definitions.

---

## 7. NAVIGATION STRUCTURE

### Traveler-facing (Public)

```
/ (Home)
/offers (Search Results)
/offers/:id (Offer Detail)
/agents (Agent Directory)
/agents/:id (Agent Profile)
/login
/register
/profile (Traveler Profile — authenticated)
/notifications (authenticated)
/saved (Saved Offers — authenticated)
/legal/terms
/legal/privacy
/legal/verification
/legal/reviews
/legal/disclaimer
```

### Agent-facing (Authenticated, Verified)

```
/dashboard (Agent Dashboard)
/dashboard/offers (Manage Offers)
/dashboard/offers/new (Create Offer)
/dashboard/offers/:id/edit (Edit Offer)
/dashboard/contacts (Contact Requests)
/dashboard/contacts/:id (Single Contact Request)
/dashboard/profile (Edit Agent Profile)
/dashboard/verification (Verification Status & Documents)
/dashboard/analytics (Performance Overview)
```

### Admin (Separate portal)

```
/admin/login
/admin/dashboard
/admin/agents (Agent Management)
/admin/agents/:id (Agent Detail & Verification)
/admin/offers (Offer Review Queue)
/admin/offers/:id (Review Single Offer)
/admin/reviews (Reviews Management)
/admin/data (Travel Data Management — cities, airlines)
/admin/settings (Platform Settings)
```

---

## 8. LOCALIZATION REQUIREMENTS

- Primary language: Arabic (RTL)
- Secondary language: English (LTR)
- All core UI elements must have both Arabic and English versions
- Numbers: Western Arabic numerals (0–9) used throughout
- Currency display: Local currency first, with USD equivalent optional
- Date format: DD/MM/YYYY for Arabic, consistent with regional standards
- Timezone: Platform uses UTC, displays in user's local timezone

---

## 9. ACCESSIBILITY REQUIREMENTS

- WCAG 2.1 Level AA compliance
- All interactive elements keyboard-navigable
- Screen reader compatible (ARIA labels in Arabic)
- Minimum contrast ratio: 4.5:1 for body text, 3:1 for large text
- Touch targets: minimum 44x44px on mobile
- Focus indicators: visible on all interactive elements

---

*Document Owner: Product Team*
*Status: V1.1 — REVISED*
*Next: MVP_SCOPE.md*
