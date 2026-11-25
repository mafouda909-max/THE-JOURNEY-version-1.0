import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path: string) => fs.readFileSync(path, "utf8");

test("provider directory routes use the current public-safe trust projection", () => {
  const page = read("src/app/providers/page.tsx");
  const route = read("src/app/api/providers/route.ts");
  const data = read("src/lib/data.ts");
  const nav = read("src/components/chrome.tsx");

  assert.match(page, /getPublicProviders/);
  assert.match(page, /filterPublicProviders/);
  assert.match(page, /اجتازوا مراجعة أدلة الهوية والنشاط/);
  assert.match(page, //agents//);
  assert.match(route, /getPublicProviders/);
  assert.match(route, /filterPublicProviders/);
  assert.match(route, /Cache-Control/);
  assert.match(data, /getAgentsWithRatings/);
  assert.match(data, /getPublishedOffers/);
  assert.match(nav, /href: "\/providers", label: "مقدمو الخدمات"/);
});

test("provider directory does not claim unsupported supplier or live-booking capabilities", () => {
  const directory = read("src/lib/provider-directory.ts");
  const page = read("src/app/providers/page.tsx");

  assert.match(directory, /licenseType !== "agency" && profile\.licenseType !== "individual"/);
  assert.match(page, /لا يعني ظهور الفئة وجود مخزون حي أو حجز مؤكد/);
  assert.doesNotMatch(directory, /licenseNumber|storageKey|documentType/);
});
