import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSilaTravelCase,
  mergeSilaTravelCaseMessage,
  parseSilaTravelCase,
  serializeSilaTravelCase,
  summarizeSilaTravelCase,
} from "../src/lib/sila-advisor-travel-case";

test("creates a travel case from the first natural message", () => {
  const travelCase = createSilaTravelCase(
    "أنا مصري وعايز أسافر تركيا سياحة في ديسمبر أنا ومراتي وطفلة، الميزانية محدودة.",
    new Date("2026-10-06T10:00:00.000Z"),
  );

  assert.equal(travelCase.role, "TRAVELER");
  assert.equal(travelCase.fields.nationality.value, "مصري");
  assert.equal(travelCase.fields.destination.value, "تركيا");
  assert.equal(travelCase.fields.purpose.value, "tourism");
  assert.equal(travelCase.messages.length, 1);
  assert.ok(travelCase.changes.some((change) => change.field === "destination"));
});

test("merges later answers into the same travel case without losing earlier context", () => {
  const travelCase = createSilaTravelCase(
    "أنا مصري وعايز أسافر تركيا سياحة في ديسمبر أنا ومراتي وطفلة، الميزانية محدودة.",
    new Date("2026-10-06T10:00:00.000Z"),
  );

  const updated = mergeSilaTravelCaseMessage(
    travelCase,
    "الجوازات سارية ومعايا حجز فندق ولسه مش حجزت ذهاب وعودة",
    new Date("2026-10-06T10:05:00.000Z"),
  );

  assert.equal(updated.fields.destination.value, "تركيا");
  assert.equal(updated.fields.passportStatus.value, "الجواز مذكور كساري");
  assert.equal(updated.fields.accommodation.value, "الإقامة/الحجز مذكور");
  assert.equal(updated.fields.returnTicket.value, "تذكرة عودة مذكورة");
  assert.equal(updated.messages.length, 2);
  assert.ok(updated.changes.some((change) => change.field === "passportStatus"));
});

test("summarizes the current case and keeps missing questions targeted", () => {
  const travelCase = createSilaTravelCase(
    "عميل مصري عايز إسبانيا سياحة شهر 7",
    new Date("2026-10-06T10:00:00.000Z"),
  );

  const summary = summarizeSilaTravelCase(travelCase);

  assert.match(summary.understanding, /إسبانيا/);
  assert.ok(summary.knownFields.some((field) => field.key === "destination"));
  assert.ok(summary.missingQuestions.length <= 4);
  assert.ok(summary.missingQuestions.some((question) => question.id === "passport-status"));
});

test("serializes and parses a travel case safely", () => {
  const travelCase = createSilaTravelCase(
    "عايز أسافر تركيا سياحة",
    new Date("2026-10-06T10:00:00.000Z"),
  );

  const parsed = parseSilaTravelCase(serializeSilaTravelCase(travelCase));

  assert.ok(parsed);
  assert.equal(parsed.fields.destination.value, "تركيا");
  assert.equal(parseSilaTravelCase("not json"), null);
  assert.equal(parseSilaTravelCase(null), null);
});
