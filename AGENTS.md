# Repository instructions for AI coding agents

## Read before UI work
Before creating or changing any SILA page, component, responsive layout or interaction, read `docs/SILA_INTERFACE_DESIGN_STANDARD.md`. It is the project-specific design source of truth and already incorporates selected patterns from the MIT-licensed AI Design Skills and Redesign Skill repositories.

## Preserve SILA's design system
- Keep the current SILA brand, generated token system, typography, Tailwind configuration, spacing, radii, shadows and motion tokens.
- Change the source token definitions and generator when a real design-system change is needed; never hand-edit generated CSS output.
- Do not import an external skill's palette, fonts, icon library, component system or dependencies wholesale.
- Keep Arabic-first copy and correct RTL behavior. Add responsive desktop and mobile behavior and keyboard-visible focus states.
- Design and test loading, empty, error, disabled, success and expired/stale states for data views.

## Preserve product and data boundaries
- Reuse canonical `contact_requests`, agency opportunities, intent versions, supplier options, quote versions and quote delivery. Do not create a parallel CRM, request system or quote engine.
- Preserve offer-specific inquiry behavior while supporting open multi-provider requests.
- An agency-reported contact is not independent supplier verification. Traveler approval is not a booking. Request delivery is not an offer.
- SILA's approved current operating model ends with direct confirmation between traveler and provider outside SILA. Do not add booking, checkout, payment, ticket/voucher issuance or settlement without an explicit product decision.
- Do not expose traveler contact details or private readiness data to competing agencies. Respect explicit consent and workspace ownership.
- Do not run Production migrations, change Production flags/secrets or deploy without explicit approval.

## Quality gate
Inspect the existing implementation before editing. Make focused, reviewable changes. Add/adjust contract, database, component and browser tests as appropriate. Report exact test results for the final commit; never claim a feature is live because it exists on an unmerged branch.
