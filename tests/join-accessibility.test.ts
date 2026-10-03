import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync("src/app/join/page.tsx", "utf8").replace(/\r\n?/g, "\n");

test("join exposes explicit traveler and agent signup modes", () => {
  assert.match(source, /"signup-agent"/);
  assert.match(source, /"signup-traveler"/);
  assert.match(source, /"وكيل جديد"/);
  assert.match(source, /"مسافر جديد"/);
  assert.match(source, /requestedMode === "new-traveler"/);
});

test("Google and magic link are the primary authentication methods", () => {
  assert.match(source, /NEXT_PUBLIC_GOOGLE_AUTH_ENABLED/);
  assert.match(source, /NEXT_PUBLIC_MAGIC_LINK_ENABLED/);
  assert.match(source, /المتابعة باستخدام Google/);
  assert.match(source, /إرسال رابط دخول آمن/);
  assert.match(source, /\/api\/auth\/google\/start/);
  assert.match(source, /\/api\/auth\/magic\/request/);
});

test("new account forms never ask for a password", () => {
  const legacyBlock = source.indexOf("legacyPasswordEnabled && mode === \"login\"");
  const signupMode = source.indexOf("mode !== \"login\"");
  assert.ok(legacyBlock > signupMode);
  assert.doesNotMatch(source.slice(0, legacyBlock), /name="legacyPassword"/);
  assert.match(source, /NEXT_PUBLIC_LEGACY_PASSWORD_LOGIN_ENABLED/);
  assert.match(source, /لدي حساب قديم بكلمة مرور/);
});

test("join controls keep accessible names and state", () => {
  assert.match(source, /aria-pressed=\{mode === item\.key\}/);
  assert.match(source, /aria-label=\{mode === "signup-agent" \? "اسم الوكالة أو الوكيل" : "اسم المسافر"\}/);
  assert.match(source, /aria-label="المدينة"/);
  assert.match(source, /aria-label="البريد الإلكتروني"/);
  assert.match(source, /aria-label="بريد الحساب القديم"/);
  assert.match(source, /aria-label="كلمة المرور القديمة"/);
  assert.match(source, /autoComplete="email"/);
  assert.match(source, /autoComplete="current-password"/);
});

test("admin self-signup is explicitly absent from the public join surface", () => {
  assert.doesNotMatch(source, /signup-admin|role=["']admin["']/);
  assert.match(source, /لا يوجد تسجيل Admin ذاتي/);
});
