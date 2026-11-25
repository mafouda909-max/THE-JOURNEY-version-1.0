import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path: string) => fs.readFileSync(path, "utf8");

test("listing links return travelers to the existing offer and provider paths", () => {
  const adapter = read("src/lib/marketplace-listing.ts");
  const offerPage = read("src/app/offers/[id]/page.tsx");
  const contactForm = read("src/components/market/ContactForm.tsx");

  assert.match(adapter, /details: "\/offers\/" \+ offer\.id/);
  assert.match(adapter, /providerProfile: "\/agents\/" \+ offer\.agent\.id/);
  assert.match(adapter, /inquiry: "\/offers\/" \+ offer\.id/);
  assert.match(offerPage, /<ContactForm/);
  assert.match(contactForm, /fetch\("\/api\/contact-requests"/);
});

test("marketplace inquiry preserves offer snapshot, traveler intent and agency opportunity lineage", () => {
  const contactRoute = read("src/app/api/contact-requests/route.ts");
  const agencyRoute = read("src/app/api/agency/workspaces/[id]/inquiries/route.ts");

  assert.match(contactRoute, /offerSnapshot/);
  assert.match(contactRoute, /travelerIntentInquiries/);
  assert.match(contactRoute, /savedIntentId/);
  assert.match(contactRoute, /travelerAccountId/);
  assert.match(agencyRoute, /sourceContactRequestId/);
  assert.match(agencyRoute, /source: "marketplace"/);
  assert.match(agencyRoute, /executeCommercialCommand/);
  assert.match(agencyRoute, /create_opportunity/);
});
