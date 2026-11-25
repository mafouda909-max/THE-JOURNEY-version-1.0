# SILA — Direct Request, Offer & Confirmation Demo Playbook

**Status:** Draft for internal demonstration and partner review  
**Operating model:** Traveler request → provider/agency offer → traveler decision → direct confirmation between traveler and provider outside SILA.  
**Not in scope:** SILA booking, checkout, payment collection, ticket issuance, voucher issuance, or settlement.

## 1. Approved product promise

SILA helps a traveler discover a service or provider, submit a request, receive and compare an offer, make a recorded decision, and follow up on a direct confirmation with the provider.

The platform records the request, the exact quote version shared, the traveler's response, and the agency's report of direct supplier contact. It can separately capture whether the traveler acknowledges that contact.

A direct-confirmation record is **not** independent supplier verification, a reservation, a booking, a ticket, a voucher, or proof of payment. The agency's report remains attributed to the agency; the traveler's response remains attributed to the traveler.

## 2. The working demo path available in the repository

The current end-to-end demonstration is based on a published offer selected by the traveler and the existing agency commercial workspace. It is not yet a general multi-provider RFQ sent to every agency.

1. **Traveler discovery**
   - Open /offers and select a published offer from an approved agent.
   - Review the service details, provider profile, published price basis, terms and disclosure.
   - Submit the contact request from the offer page.
   - When signed in and the traveler workspace is enabled, link the request to an owned Saved Intent. Readiness data is shared only through its separate, explicit, unchecked consent.

2. **Agency intake**
   - The owning agency opens its inquiries.
   - Adopt the inquiry into an existing agency opportunity. The source contact request remains the lineage record; do not create a second CRM lead.
   - Review the traveler intent and record relevant supplier options, each with the source type/reference, observation time and validity. Manual evidence must remain identified as manually reported.

3. **Prepare the agency's offer**
   - Create a supplier-backed quote version from the selected supplier option.
   - Add client-facing terms and a future validity time.
   - Prepare the secure quote-delivery link and activate it only when ready to share.
   - Share the link directly by the agreed channel (for example, WhatsApp or email). The link exposes only traveler-facing lines and terms, not supplier costs or agency margins.

4. **Traveler decision**
   - Open the private quote link at /q/[token].
   - Review the exact quote version and its validity.
   - Approve, decline or request changes.
   - An approval records the traveler's decision; it does not confirm a service or create a booking.

5. **Direct provider confirmation**
   - After an approved traveler response, the agency opens the same opportunity.
   - In **التأكيد المباشر مع مقدم الخدمة**, record the provider name, contact channel and a short non-sensitive summary of the direct conversation.
   - SILA links this report to the exact quote delivery/version and notifies the traveler.
   - The traveler opens the same quote link and responds to the agency report: confirmed direct contact, or not confirmed.
   - The traveler dashboard shows the agency report and the traveler's acknowledgement where enabled.

6. **Agency and admin follow-up**
   - Review the opportunity's quote versions, commercial activity, audit history and direct-confirmation response.
   - Resolve any disagreement directly with the parties. Do not automatically convert a traveler acknowledgement into a supplier-certified status.

## 3. Roles to demonstrate

| Role | What to show |
|---|---|
| Traveler | Public discovery, request submission, Saved Intent link, quote link, approve/change/decline, direct-confirmation acknowledgement |
| Agency owner/member | Inquiry intake, opportunity, supplier source evidence, quote version, secure delivery, direct-confirmation report |
| Admin | Existing provider/agent review, offer moderation, community moderation, operational audit and release gates |

For a partner presentation, use synthetic sample records and test accounts. Do not use real traveler identity documents, passport numbers, account passwords, payment data, ticket/PNR references, or supplier credentials in demo fixtures.

## 4. Status semantics

- **Request submitted:** the selected provider/agent has received a request.
- **Quote shared:** a specific immutable quote version has been made available through its private link.
- **Traveler approved:** the traveler approved that quote version; no booking has occurred.
- **Agency reported direct contact:** the agency submitted a report identifying the provider and contact channel.
- **Traveler confirmed / not confirmed:** the traveler acknowledged or disputed the direct-contact report.
- **Service confirmed directly:** may be used in conversation only when the provider and traveler confirm directly. The SILA record itself remains an attributed report and acknowledgement, not an external booking proof.

Never use “Booked by SILA”, “Ticket issued”, “Paid”, “Guaranteed availability”, or an equivalent status unless those capabilities are separately implemented and contractually supported. They are not part of this operating model.

## 5. Feature and database rollout

The new direct-confirmation table is introduced by db/phase9_direct_confirmation.sql and registered in db/release_manifest.json.

- DIRECT_CONFIRMATION_ENABLED defaults to false.
- The feature must remain off until the full additive migration chain has been applied and validated on an isolated Preview/demo database.
- Do not run the migration against Production as part of this demo preparation.
- Do not merge or deploy this draft PR as an implicit approval to activate the feature.
- After preview migration, set the flag only in the Preview/demo environment and verify agency ownership, traveler token access, notifications, duplicate submissions, expired quote links and immutable quote-version linkage.

## 6. Known product boundary before a broad network launch

This demo proves the existing offer-specific path: one published offer → its owning agency → one request lineage → quote versions → traveler decision → direct confirmation report/acknowledgement.

It does **not yet** prove a general traveler service request that fans out to multiple eligible providers and collects competing offers in one shared request. It also does not yet provide a neutral, fully category-specific public catalog for every travel-service type. These are distinct marketplace capabilities and should be built before calling the whole platform a universal multi-provider travel marketplace.

Community and provider-directory changes are in separate draft PRs and must go through their own migration, moderation, privacy and release checks.

## 7. Demo acceptance checklist

- [ ] Traveler can find a published offer and submit a request.
- [ ] Request appears only in the owning agency's workspace.
- [ ] Inquiry adoption is idempotent and retains the original request reference.
- [ ] Agency can record source-aware supplier options and create an immutable quote version.
- [ ] Prepared quote link is not publicly active until the agency activates it.
- [ ] Traveler can open the link and approve, decline or request changes.
- [ ] Agency cannot record direct confirmation before approval of that exact delivery.
- [ ] Direct confirmation cannot be duplicated for the same delivery.
- [ ] Traveler can acknowledge or dispute the agency report once.
- [ ] Both sides can see that the record is an attributed report, not an SILA booking or independent supplier verification.
- [ ] Production remains unchanged; Preview migration and feature flag are separately approved.


## 8. Reference patterns worth borrowing

These are product-pattern references, not code dependencies or a reason to copy a competitor's full commercial model.

- **EgTravelMarket (Egypt):** its custom travel-request flow is a close local reference for a traveler describing a trip/service need and receiving tailored proposals from relevant travel professionals. Study the request form, provider eligibility, service categories and how competing proposals are presented. SILA should preserve its own request history, provider evidence and direct-confirmation model rather than copy on-platform checkout. References: https://www.egtravelmarket.com/ and https://www.egtravelmarket.com/travel-request.html
- **TourRadar — operator general requests:** its operator documentation describes general enquiries that are not tied to an existing tour, an operator responding through an enquiry conversation, converting the enquiry into a quote, and editing itinerary/pricing against that enquiry. This is a useful reference for request-to-quote operations and versioned changes. Reference: https://help.tourradar.com/en/operators/how-do-i-respond-to-a-general-question-or-convert-the-question-into-a-quote
- **TourRadar — Booking Conversation Page:** its traveler support documentation describes a shared conversation context for asking questions directly to an operator before booking and managing follow-up after a confirmed booking. SILA should borrow the contextual thread, clear quote history and notification entry points, but keep the commercial boundary outside platform booking/payment. Reference: https://support.tourradar.com/faq/what-is-the-booking-conversation-page-and-how-do-i-find-it

The next strategic product step after this offer-specific demo is a general traveler request that can be routed to multiple eligible agencies/providers and collect their separate quote versions under one request. That should reuse the current agency opportunity, quote and delivery aggregates rather than create a second agency CRM or proposal engine.

## 9. Partner-demo handling rules

- Treat the quote link as private bearer access: share it only with the intended traveler through the channel the traveler supplied. Do not paste it into public groups or promotional posts.
- A traveler response of not confirmed is a follow-up signal, not proof that the agency or provider acted dishonestly. Pause any “confirmed” wording and let the agency and traveler reconcile the facts directly.
- Do not ask the traveler to send passport images, card details, passwords, ticket numbers or other sensitive identifiers through the quote page or the confirmation note.
- Do not describe the agency's direct-contact report as “verified by SILA.” The interface must keep the source attribution visible.
- Before an external demonstration, prepare one synthetic traveler, one demo agency, one published offer, one supplier-option record and one quote with a short, future expiry. Walk through the path once with both accounts before inviting partner observers.
