# MVP SCOPE — THE JOURNEY / الرحلة

> Version 1.1 — August 2026 | Revised Definitive MVP Definition

---

## 1. MVP PHILOSOPHY

The MVP of THE JOURNEY must feel like a complete, working product — not a demo or prototype. A user arriving at the platform for the first time should be able to:

1. Search for a trip and find real offers from real agents
2. Evaluate an agent's credibility through real signals
3. Contact an agent with a structured request and track its status
4. As an agent: publish a real offer and manage contacts
5. Review legal and trust guidelines underpinning the platform

Anything that breaks this core loop is a critical gap. Anything that enhances the loop beyond functional is a Phase 2 item.

**MVP Definition:** The smallest complete version of the product that can operate commercially.

---

## 2. MVP FEATURE MATRIX

### ✅ IN SCOPE — V1 (MVP)

| Feature | User Role | Priority | Notes |
|---------|-----------|----------|-------|
| Home page with search | Traveler | P0 | Core entry point |
| Search results with offers | Traveler | P0 | Core discovery |
| Search filters (sidebar + mobile) | Traveler | P0 | Price, type, rating, airline |
| Offer detail page | Traveler | P0 | Full offer info + agent info |
| Agent profile page | Traveler | P0 | Agent bio, reviews, offers |
| Contact request form | Traveler | P0 | Traveler → Agent (Inline/Modal) |
| Contact status tracking | Traveler | P0 | Inline view of request lifecycle |
| Saved offers | Traveler | P1 | Promoted to V1 core experience |
| Traveler registration | Traveler | P0 | Email + phone |
| Traveler login | Traveler | P0 | Email + password |
| Notifications (traveler) | Traveler | P1 | Contact request status |
| Agent registration | Agent | P0 | With email verification |
| Agent verification flow | Agent | P0 | Document submission |
| Agent dashboard | Agent | P0 | Overview + quick actions |
| Create offer (multi-step) | Agent | P0 | With preview |
| Offer management list | Agent | P0 | Published, draft, expired |
| Edit offer | Agent | P0 | Limited editing on published |
| Contact requests inbox | Agent | P0 | View and respond, status sync |
| Agent profile editor | Agent | P0 | Bio, photo, specialty |
| Performance analytics | Agent | P1 | Views, contacts, response rate, top offers, basic trend |
| Mobile dashboard | Agent | P1 | Basic version |
| Admin login | Admin | P0 | Secure, 2FA |
| Admin dashboard | Admin | P0 | Key metrics |
| Agent verification queue | Admin | P0 | Review + approve/reject |
| Offer review queue | Admin | P0 | Review + approve/reject |
| Agent account management | Admin | P0 | Suspend, terminate |
| Legal / Trust Pages | All | P0 | Terms, Privacy, Verification, Reviews, Disclaimers |
| Travel data management | Admin | P1 | Cities, airlines, trip types |
| Review management | Admin | P1 | Flag, remove |
| Empty states (all screens) | All | P0 | No blank states |
| Loading states (all screens) | All | P0 | No layout shift |
| Error states (all screens) | All | P0 | Clear error recovery |
| RTL layout | All | P0 | Non-negotiable |
| Mobile responsive | All | P0 | Non-negotiable |
| Arabic content | All | P0 | Primary language |

### ❌ OUT OF SCOPE — PHASE 2

| Feature | Rationale |
|---------|-----------|
| In-platform payment | Complex licensing requirements, deferred deliberately |
| Direct messaging / chat | Requires real-time infrastructure, social features |
| Community feed / posts | Not core to marketplace loop, explicitly excluded from V1 |
| Agent response to reviews | Social dynamics, Phase 2 |
| Verified transaction confirmation | Requires trip completion tracking |
| AI search recommendations | Enhancement, not core |
| Email marketing / newsletters | Post-launch CRM |
| Referral system | Post-launch growth |
| Agent subscription tiers | Business model complexity |
| API for third-party booking | Enterprise feature |
| iOS / Android native app | Post-web-launch |
| Saved searches / alerts | Post-launch |
| Dark mode | Post-launch |
| Multi-currency display | Phase 2 |

---

## 3. CRITICAL PATH — WHAT MUST SHIP

The following 10 features are the hard core of the MVP. Nothing ships without all 10:

1. **Search + Results** — Traveler can find offers by destination and trip type
2. **Offer Detail** — Traveler can see full offer information
3. **Agent Profile** — Traveler can evaluate an agent's credibility
4. **Contact Request** — Traveler can initiate contact with an agent and track status
5. **Agent Registration + Verification** — Agents can join and be verified
6. **Create & Publish Offer** — Verified agents can create and submit offers
7. **Contact Inbox** — Agents can see and respond to traveler requests
8. **Admin Offer Review** — Admin can approve/reject submitted offers
9. **Admin Agent Verification** — Admin can approve/reject verification requests
10. **RTL + Mobile** — The entire product works correctly on mobile in Arabic

---

## 4. MISSING CRITICAL PIECES (UX Gaps Identified in Stitch Audit)

Based on the existing Stitch prototype audit, the following pieces are MISSING from the current screens and must be built for MVP:

### Authentication
- [ ] Login screen (Email + password) — NOT FOUND in screens
- [ ] Registration screen (Traveler) — NOT FOUND in screens
- [ ] Forgot password flow — NOT FOUND in screens
- [ ] Email verification screen — NOT FOUND in screens
- [ ] Agent registration (separate from traveler) — NOT FOUND

### Offer Flow
- [ ] Offer submission success/confirmation screen — NOT FOUND
- [ ] Offer rejection notification to agent — NOT FOUND
- [ ] Offer edit screen for published offers — NOT FOUND (separate from create)
- [ ] Offer expiry renewal flow — NOT FOUND

### Contact System
- [ ] Contact request success / inline status tracking — NOT FOUND
- [ ] Agent response screen (how agent responds to request) — NOT FOUND
- [ ] Contact history list for traveler — NOT FOUND

### Admin & Legal
- [ ] Admin login screen — NOT FOUND
- [ ] Single offer review screen (detailed review UI) — NOT FOUND
- [ ] Rejection modal with reason field — NOT FOUND
- [ ] Legal / Policy documents (Terms, Privacy, Verification, Review, Disclaimer) — NOT FOUND

### States
- [ ] Search loading state (skeleton) — NOT FOUND
- [ ] Offer card loading skeleton — NOT FOUND
- [ ] Agent profile loading skeleton — NOT FOUND
- [ ] Dashboard loading skeleton — NOT FOUND
- [ ] Error screen (generic 500) — NOT FOUND
- [ ] 404 screen — NOT FOUND

### Onboarding
- [ ] Agent onboarding wizard (post-registration steps) — NOT FOUND
- [ ] First-time traveler orientation — NOT FOUND

---

## 5. DEFERRED FEATURES (Confirmed Phase 2)

The following were found as concepts in the Stitch project and are explicitly deferred:

| Feature | Found In Stitch | Deferral Reason |
|---------|----------------|-----------------|
| Community feed | Implied in navigation | Not core to marketplace, explicitly deferred |
| Verified transaction badges | Referenced in design system | Requires trip tracking infra |
| "Request a Quote" flow | Navigation item seen | Complex bidding flow, Phase 2 |
| Agent response to reviews | Design system mention | Social features, Phase 2 |
| Multi-agent comparison table | Not found | Complex UX, Phase 2 |
| Price alerts | Not found | Post-launch |

---

## 6. MVP SUCCESS CRITERIA

The MVP is successful when:

1. An agent can register, get verified, create an offer, and receive a contact request — in one session
2. A traveler can search, find an offer, view the agent profile, and send a contact request — in one session
3. An admin can approve an agent and approve an offer — in one session
4. All core flows work on mobile in Arabic
5. No critical flow has a broken empty state or loading state
6. Legal foundation is clearly accessible
7. The product does not feel like a prototype

---

## 7. MVP TIMELINE RECOMMENDATION

| Phase | Scope | Estimated Effort |
|-------|-------|-----------------|
| Foundation | Design system, auth, navigation, core data models, legal pages | Week 1–2 |
| Traveler Core | Home, search, results, offer detail, agent profile | Week 3–4 |
| Agent Core | Registration, verification, dashboard, create offer | Week 5–6 |
| Contact System | Contact form, inbox, notifications | Week 7 |
| Admin Core | Login, dashboard, verification queue, offer queue | Week 8 |
| States + Polish | All empty, loading, error states. RTL audit. Mobile audit. | Week 9 |
| QA + Launch Prep | Testing, content, final UX pass | Week 10 |

---

*Document Owner: Product Team*
*Status: V1.1 — REVISED*
*Next: UX_AUDIT.md*
