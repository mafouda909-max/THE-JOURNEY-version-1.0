import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractSilaAdvisorIntent,
  firstSilaAdvisorStep,
  selectSilaAdvisorMissingQuestions,
  summarizeSilaAdvisorUnderstanding,
} from "../src/lib/sila-advisor-intake";

test("extracts a rich Arabic traveler message without forcing a fixed form", () => {
  const intent = extractSilaAdvisorIntent(
    "أنا مصري وعايز أسافر تركيا سياحة في ديسمبر أنا ومراتي وطفلة، الميزانية محدودة ومش عارف أبدأ منين.",
  );

  assert.equal(intent.role, "TRAVELER");
  assert.equal(intent.fields.nationality.value, "مصري");
  assert.equal(intent.fields.destination.value, "تركيا");
  assert.equal(intent.fields.purpose.value, "tourism");
  assert.equal(intent.fields.dateWindow.value, "ديسمبر");
  assert.equal(intent.fields.budget.value, "ميزانية محدودة/اقتصادية");
  assert.equal(intent.fields.travelers.provenance, "USER_STATED");

  const summary = summarizeSilaAdvisorUnderstanding(intent);
  assert.match(summary, /فهمت منك/);
  assert.match(summary, /تركيا/);
  assert.match(summary, /سياحة/);

  const questions = selectSilaAdvisorMissingQuestions(intent);
  const questionIds = questions.map((question) => question.id);
  assert.ok(!questionIds.includes("nationality"));
  assert.ok(!questionIds.includes("destination"));
  assert.ok(!questionIds.includes("purpose"));
  assert.ok(questionIds.includes("passport-status"));
  assert.ok(questionIds.includes("child-age"));
  assert.ok(questions.length <= 4);
});

test("supports agent-side messages for a customer case", () => {
  const intent = extractSilaAdvisorIntent(
    "عميل مصري عايز إسبانيا سياحة في شهر 7 وبيسأل أطلب منه إيه؟",
  );

  assert.equal(intent.role, "AGENT");
  assert.equal(intent.fields.nationality.value, "مصري");
  assert.equal(intent.fields.destination.value, "إسبانيا");
  assert.equal(intent.fields.purpose.value, "tourism");
  assert.equal(intent.fields.dateWindow.value, "يوليو");

  const firstStep = firstSilaAdvisorStep(intent);
  assert.match(firstStep, /الجوازات|جنسيتك|السفر/);
});

test("asks the smallest useful questions when the message is vague", () => {
  const intent = extractSilaAdvisorIntent("عايز أسافر ومش عارف أبدأ");
  const questions = selectSilaAdvisorMissingQuestions(intent);

  assert.equal(intent.fields.destination.value, null);
  assert.equal(intent.fields.purpose.value, null);
  assert.equal(intent.fields.nationality.value, null);
  assert.deepEqual(
    questions.slice(0, 3).map((question) => question.id),
    ["nationality", "destination", "purpose"],
  );
  assert.ok(questions.length <= 4);
});
