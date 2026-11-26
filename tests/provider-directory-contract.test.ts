import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file: string) => fs.readFileSync(file, "utf8");

test("provider directory routes use the current public-safe trust projection", () => {
  const page = read("src/app/providers/page.tsx");
  const route = read("src/app/api/providers/route.ts");
  const data = read("src/lib/data.ts");
  const nav = read("src/components/chrome.tsx");

  assert.ok(page.includes("getPublicProviders"));
  assert.ok(page.includes("filterPublicProviders"));
  assert.ok(page.includes("اجتازوا مراجعة أدلة الهوية والنشاط"));
  assert.ok(page.includes('/agents/'));
  assert.ok(route.includes("getPublicProviders"));
  assert.ok(route.includes("filterPublicProviders"));
  assert.ok(route.includes("Cache-Control"));
  assert.ok(data.includes("getAgentsWithRatings"));
  assert.ok(data.includes("getPublishedOffers"));
  assert.ok(nav.includes('href: "/providers", label: "مقدمو الخدمات"'));
});

test("provider directory does not claim unsupported supplier or live-booking capabilities", () => {
  const directory = read("src/lib/provider-directory.ts");
  const page = read("src/app/providers/page.tsx");

  assert.ok(directory.includes('profile.licenseType !== "individual"'));
  assert.ok(page.includes("لا تعني ظهور الفئة وجود مخزون حي أو حجز مؤكد"));
  assert.ok(!directory.includes("licenseNumber"));
  assert.ok(!directory.includes("storageKey"));
  assert.ok(!directory.includes("documentType"));
});
