import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mergeSilaAdvisorCaseIntoSnapshot,
  removeSilaAdvisorCaseFromSnapshot,
  silaAdvisorCaseFromSnapshot,
} from "../src/lib/sila-advisor-memory";
import { createSilaTravelCase } from "../src/lib/sila-advisor-travel-case";

test("Sila advisor memory shares the saved-trip snapshot without overwriting readiness state", () => {
  const travelCase = createSilaTravelCase(
    "أنا مصري وعايز أسافر تركيا سياحة في ديسمبر بميزانية محدودة",
    new Date("2026-10-06T12:00:00.000Z"),
  );
  const snapshot = {
    originCity: "Cairo",
    destinations: ["Istanbul"],
    __silaReadiness: {
      version: 1,
      checkedAt: "2026-10-06T11:00:00.000Z",
      sentinel: "keep-me",
    },
  };

  const merged = mergeSilaAdvisorCaseIntoSnapshot(snapshot, travelCase);
  const restored = silaAdvisorCaseFromSnapshot(merged);

  assert.equal(restored?.id, travelCase.id);
  assert.equal(restored?.messages.length, 1);
  assert.deepEqual(merged.__silaReadiness, snapshot.__silaReadiness);
  assert.equal(merged.originCity, "Cairo");
});

test("clearing advisor memory removes only the advisor case", () => {
  const travelCase = createSilaTravelCase(
    "عايز أسافر إسبانيا سياحة",
    new Date("2026-10-06T12:00:00.000Z"),
  );
  const merged = mergeSilaAdvisorCaseIntoSnapshot(
    {
      destinations: ["Madrid"],
      __silaReadiness: { sentinel: "keep-me" },
    },
    travelCase,
  );

  const cleared = removeSilaAdvisorCaseFromSnapshot(merged);

  assert.equal(silaAdvisorCaseFromSnapshot(cleared), null);
  assert.deepEqual(cleared.__silaReadiness, { sentinel: "keep-me" });
  assert.deepEqual(cleared.destinations, ["Madrid"]);
});

test("malformed advisor memory fails closed", () => {
  assert.equal(silaAdvisorCaseFromSnapshot({ __silaAdvisorCase: { id: 7 } }), null);
  assert.equal(silaAdvisorCaseFromSnapshot(null), null);
});
