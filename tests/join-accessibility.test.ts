import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync("src/app/join/page.tsx", "utf8").replace(/\r\n?/g, "\n");

test("join form exposes accessible names for auth fields", () => {
  assert.match(
    source,
    /aria-label=\{mode === "signup-agent" \? "اسم الوكالة أو الوكيل" : "اسم المسافر"\}/,
  );
  for (const label of ["المدينة", "البريد الإلكتروني", "كلمة المرور"]) {
    assert.ok(source.includes(`aria-label="${label}"`), `missing accessible name: ${label}`);
  }
  assert.match(source, /autoComplete="email"/);
  assert.match(source, /autoComplete=\{mode === "login" \? "current-password" : "new-password"\}/);
});

test("join mode selector exposes pressed state", () => {
  assert.match(source, /aria-pressed=\{mode === m\.key\}/);
});

test("join submit icons are decorative to assistive technology", () => {
  assert.match(source, /Loader2[^>]*aria-hidden="true"/);
  assert.match(source, /KeyRound[^>]*aria-hidden="true"/);
  assert.match(source, /UserPlus[^>]*aria-hidden="true"/);
});
