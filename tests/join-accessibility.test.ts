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

test("join exposes only authentication methods returned by runtime configuration", () => {
  assert.match(source, /\/api\/auth\/config/);
  assert.match(source, /googleEnabled/);
  assert.match(source, /magicEnabled/);
  assert.match(source, /المتابعة باستخدام Google/);
  assert.match(source, /إرسال رابط دخول آمن/);
  assert.match(source, /\/api\/auth\/google\/start/);
  assert.match(source, /\/api\/auth\/magic\/request/);
});

test("password pilot uses a separate signup form and keeps legacy login optional", () => {
  const legacyBlock = source.indexOf("legacyPasswordEnabled && mode === \"login\"");
  const signupMode = source.indexOf("mode !== \"login\"");
  assert.ok(legacyBlock > signupMode);
  assert.doesNotMatch(source.slice(0, legacyBlock), /name="legacyPassword"/);
  assert.match(source, /legacyPasswordEnabled/);
  assert.match(source, /لدي حساب قديم بكلمة مرور/);
  assert.match(source, /passwordEnabled \? \(/);
  assert.match(source, /name="passwordConfirmation"/);
  assert.match(source, /"new-password"/);
  assert.match(source, /دخول فقط/);
  assert.match(source, /افتح حسابك الآن، ووثّق لاحقًا/);
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
  assert.match(source, /التسجيل العام مخصص للمسافرين والوكلاء/);
});
