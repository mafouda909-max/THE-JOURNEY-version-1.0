import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path: string) {
  return fs.readFileSync(path, "utf8");
}

test("zero-supply homepage sends travelers to a live capability instead of empty inventory", () => {
  const page = source("src/app/page.tsx");
  const search = source("src/components/market/SearchModule.tsx");

  assert.match(page, /href="\/readiness"/);
  assert.match(page, /<SearchModule marketplaceEmpty=\{marketplaceEmpty\} \/>/);
  assert.match(search, /if \(marketplaceEmpty\)/);
  assert.match(search, /اسأل صلة قبل ما تختار عرضًا أو تحجز/);
  assert.match(search, /href="\/readiness"/);
});

test("primary navigation advertises readiness rather than a gated flight supplier", () => {
  const chrome = source("src/components/chrome.tsx");
  const primaryLinks = chrome.slice(chrome.indexOf("const links = ["), chrome.indexOf("export function Nav"));

  assert.match(primaryLinks, /href: "\/readiness", label: "مستشار السفر"/);
  assert.doesNotMatch(primaryLinks, /href: "\/compare", label: "قارن"/);
  assert.doesNotMatch(chrome, /href="\/compare"/);
  assert.doesNotMatch(chrome, /href="\/review"/);
  assert.doesNotMatch(chrome, /href="\/destinations"/);
});
