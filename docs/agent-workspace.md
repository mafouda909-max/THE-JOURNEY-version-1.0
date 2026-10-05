# Agent workspace: immediate access, useful work, later verification

## Problem and build target

The owner supplied a live `/account` screenshot: oversized welcome and verification
cards, a registration CTA for an already signed-in agent, and little useful work.
The existing lead lifecycle control was implemented but unreachable from this account.
Password registration passing QA did not establish that the agent workspace was complete.

Direct build against `SILA_PRODUCT_DESIGN_SYSTEM.md`, preserving IBM Plex Sans Arabic,
navy ink, blue actions, white 24 px information windows and green for actual approval.
The screenshot is evidence of the problem, not a layout to reproduce.

Refero MCP returned `NO_SUBSCRIPTION` on 2026-10-05. No subscription was purchased.
The public Vercel and Ramp style references already documented in
`password-pilot-registration.md` were reopened, alongside the bundled Craft Details
and Visual Workflow guides. They contribute bounded hierarchy/form rules, not new
fonts, colors or claims about unavailable screen/flow research.

| Decision                              | Source and role                                | Application                                                                                                             |
| ------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Persistent workspace navigation       | Owner screenshot and existing workspace routes | Overview, professional profile, offers, inquiries, notifications, verification and security have clear destinations.    |
| Compact overview with one next action | SILA windows + public Vercel action hierarchy  | Greeting is brief; the pending agent can prepare a profile immediately.                                                 |
| Quiet borders, readable density       | Public Ramp border restraint + SILA tokens     | Short section gaps; no marketing hero or decorative charts in the workspace.                                            |
| Independent identity states           | Owner phase decision + existing domain rules   | Email ownership is in security; agent approval describes public discovery and offer submission.                         |
| Useful private profile preparation    | Existing owned profile PATCH contract          | Editing does not require document upload or start pending verification. Verified identity edits retain re-review rules. |
| Honest counts and empty states        | Existing marketplace records                   | Totals use scoped database counts; no invented revenue, response rates or marketplace activity.                         |
| Mobile and failure behavior           | Refero Craft Details                           | Wrapped RTL navigation, 44 px controls, persistent labels, bounded requests, retryable failures and visible focus.      |

## Scope and boundaries

- Authenticated agents get a workspace, rather than acquisition navigation.
- Professional profile preparation is separate from optional document verification.
- Only approved agents can submit offers; human offer review and public discovery
  boundaries remain enforced on the server.
- Inquiries expose actual messages and the existing audited lifecycle controls.
- Notifications are account-scoped. Failed mark-read/logout operations are visible;
  failures never masquerade as completed actions.
- No migration, dependency, sender activation, domain purchase or real/synthetic
  public inventory is part of this change. QA marketplace fixtures remain in the
  explicitly isolated local CI database.

## Verification

Desktop/mobile browser QA covers pending profile preparation without documents,
role-aware navigation, gated offer submission, approved-agent offer review and
request follow-up, scoped records, actual totals beyond list limits, notification
failure/retry, and workspace screenshots. All seven CI gates and exact canonical
deployment verification remain prerequisites to release.
