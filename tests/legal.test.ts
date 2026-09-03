import { test } from "node:test";
import assert from "node:assert/strict";
import { legalComplianceService } from "../src/lib/legal";

test("legal checklist reports REVIEW_REQUIRED overall", () => {
  const report = legalComplianceService.getLegalReviewChecklist();
  assert.equal(report.overallStatus, "REVIEW_REQUIRED");
});

test("legal checklist is non-empty and well-formed", () => {
  const { items } = legalComplianceService.getLegalReviewChecklist();
  assert.ok(items.length >= 5, "expected at least 5 legal review items");
  for (const item of items) {
    assert.ok(item.id.length > 0);
    assert.ok(item.topic.length > 0);
    assert.ok(["DRAFTED", "REVIEW_REQUIRED", "APPROVED"].includes(item.status));
  }
});
