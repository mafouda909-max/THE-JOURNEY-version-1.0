import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";
import { buildPoolConfig } from "../src/db";
import type { ReadinessAdvisorResult } from "../src/lib/readiness-advisor";
import type { AdvisorDecisionDossier } from "../src/lib/readiness-decision-dossier";
import type { TravelReadinessInput, TravelReadinessResult } from "../src/lib/travel-readiness";
const serverOnlyStubUrl = pathToFileURL(resolve("tests/server-only-stub.mjs")).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: serverOnlyStubUrl, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const databaseUrl = process.env.COMMERCIAL_WORKFLOW_TEST_DATABASE_URL;

const readinessInput: TravelReadinessInput = {
  nationality: "مصري",
  passportValidityMonths: 12,
  destination: "Istanbul",
  travelPurpose: "tourism",
  travelDate: "2026-12-15",
  originCity: "Cairo",
  travelerCount: 2,
  advisorAnswers: {
    tourism_accommodation: "مرنة",
    tourism_onward: "نعم",
  },
};

function result(
  checkedAt: string,
  status: TravelReadinessResult["status"] = "NEEDS_CONFIRMATION",
): TravelReadinessResult {
  return {
    status,
    overallScore: 0,
    evaluatedAt: checkedAt,
    warnings: [],
    missingInformation: [],
    decisionScope: { included: ["visa"], excluded: [] },
    checklist: [{
      id: "visa_requirement",
      title: "شرط التأشيرة",
      category: "VISA",
      isMandatory: true,
      status: "VERIFIED",
      description: "مثبت ضمن النطاق",
      nextAction: "أكد قبل السفر",
      evidence: {
        kind: "travel_requirement",
        linkedEntity: null,
        source: {
          type: "SOURCE_REPORTED",
          label: "Official",
          reference: "https://official.example/visa",
        },
        issuedAt: null,
        observedAt: checkedAt,
        checkedAt,
        verifiedAt: checkedAt,
        validUntil: "2026-12-01T00:00:00.000Z",
        scope: ["مصري", "تركيا", "سياحة"],
        status: "VERIFIED",
        reviewer: "system",
        limitations: [],
      },
    }],
  };
}

function travelDossier(): ReadinessAdvisorResult["travelDossier"] {
  return {
    purpose: "tourism",
    items: [
      {
        id: "passport",
        category: "IDENTITY",
        title: "جواز السفر",
        requirementState: "TO_VERIFY",
        readinessState: "REPORTED_READY",
        why: "اختبار",
        nextAction: "أكد الصلاحية",
        travelerReport: null,
        evidence: null,
        limitations: ["اختبار فقط"],
      },
      {
        id: "entry_visa",
        category: "ENTRY",
        title: "التأشيرة",
        requirementState: "CONFIRMED_NOT_REQUIRED",
        readinessState: "NOT_APPLICABLE",
        why: "اختبار",
        nextAction: "راجع الشروط",
        travelerReport: null,
        evidence: null,
        limitations: ["اختبار فقط"],
      },
    ],
    confirmedRequired: [],
    travelerAction: [],
    needsOfficialConfirmation: ["passport"],
    planning: [],
    generatedAt: "2026-10-06T00:00:00.000Z",
    limitations: ["اختبار فقط"],
  };
}

function advisor(
  routeComplexity: ReadinessAdvisorResult["routeIntelligence"]["complexity"] = "UNKNOWN",
): ReadinessAdvisorResult {
  return {
    purpose: "tourism",
    purposeLabel: "سياحة",
    questionsToComplete: [],
    preparationTopics: [],
    liveResearch: {
      status: "NOT_CONFIGURED",
      answer: null,
      confidence: null,
      sources: [],
      checkedAt: "2026-10-06T00:00:00.000Z",
      limitations: [],
    },
    routeIntelligence: {
      status: routeComplexity === "UNKNOWN" ? "NOT_APPLICABLE" : "AVAILABLE",
      complexity: routeComplexity,
      complexityLabel: routeComplexity === "HIGH" ? "تعقيد مرتفع" : "لا يوجد ترانزيت",
      summary: "اختبار ذاكرة الرحلة",
      routeDescription: routeComplexity === "HIGH" ? "CAI → FCO → MAD" : null,
      layoverMinutes: routeComplexity === "HIGH" ? 180 : null,
      factors: [],
      limitations: [],
    },
    travelDossier: travelDossier(),
    offers: [],
    offerSearchStatus: "NO_MATCH",
    limitations: [],
  };
}

function dossier(
  resolution: "SUPPORTED" | "CONFLICTED" = "SUPPORTED",
): AdvisorDecisionDossier {
  return {
    claims: [],
    groups: [{
      key: "entry_visa::tourism",
      topic: "entry_visa",
      topicLabel: "التأشيرة المسبقة",
      resolution,
      claimIds: ["checklist:visa_requirement"],
      sourceCount: resolution === "CONFLICTED" ? 2 : 1,
      reason: resolution === "CONFLICTED" ? "تعارض" : "مثبت",
    }],
    supported: resolution === "SUPPORTED" ? ["التأشيرة المسبقة"] : [],
    unresolved: [],
    conflicts: resolution === "CONFLICTED" ? ["التأشيرة المسبقة"] : [],
    followUpQuestions: [],
    generatedAt: "2026-10-06T00:00:00.000Z",
  };
}

test("saved readiness memory is owner-scoped, transactional and delta-aware", { skip: !databaseUrl }, async () => {
  const {
    loadOwnedSavedIntentReadiness,
    persistOwnedSavedIntentReadiness,
  } = await import("../src/lib/traveler-readiness-store");
  const database = new Pool(buildPoolConfig(databaseUrl!));
  const client = await database.connect();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let travelerA = 0;
  let travelerB = 0;
  let intentId = 0;

  try {
    await client.query(readFileSync("db/production_schema.sql", "utf8"));
    await client.query(readFileSync("db/phase6_traveler_workspace.sql", "utf8"));

    const a = await client.query<{ id: number }>(
      `INSERT INTO accounts (email,password_hash,role,display_name)
       VALUES ($1,'test:test','traveler','Memory Traveler A') RETURNING id`,
      [`memory-a-${suffix}@example.invalid`],
    );
    travelerA = a.rows[0]!.id;

    const b = await client.query<{ id: number }>(
      `INSERT INTO accounts (email,password_hash,role,display_name)
       VALUES ($1,'test:test','traveler','Memory Traveler B') RETURNING id`,
      [`memory-b-${suffix}@example.invalid`],
    );
    travelerB = b.rows[0]!.id;

    const intent = await client.query<{ id: number }>(
      `INSERT INTO traveler_saved_intents (account_id,label,intent_snapshot)
       VALUES ($1,'Istanbul recheck',$2::jsonb) RETURNING id`,
      [
        travelerA,
        JSON.stringify({
          originCity: "Cairo",
          destinations: ["Istanbul"],
          departureDate: "2026-12-15",
          travelers: { adults: 2, children: 0, infants: 0 },
        }),
      ],
    );
    intentId = intent.rows[0]!.id;

    const owned = await loadOwnedSavedIntentReadiness(intentId, travelerA, database);
    assert.equal(owned?.id, intentId);
    assert.equal(owned?.readiness, null);
    assert.equal(await loadOwnedSavedIntentReadiness(intentId, travelerB, database), null);

    const first = await persistOwnedSavedIntentReadiness({
      intentId,
      accountId: travelerA,
      readinessInput,
      result: result("2026-10-06T00:00:00.000Z"),
      advisor: advisor(),
      dossier: dossier(),
    }, database);
    assert.equal(first?.change.state, "FIRST_CHECK");
    assert.equal(first?.freshness.status, "CURRENT");

    const second = await persistOwnedSavedIntentReadiness({
      intentId,
      accountId: travelerA,
      readinessInput,
      result: result("2026-10-07T00:00:00.000Z"),
      advisor: advisor(),
      dossier: dossier(),
    }, database);
    assert.equal(second?.change.state, "UNCHANGED");
    assert.equal(second?.fingerprint, first?.fingerprint);

    const forbidden = await persistOwnedSavedIntentReadiness({
      intentId,
      accountId: travelerB,
      readinessInput,
      result: result("2026-10-08T00:00:00.000Z", "NEEDS_ATTENTION"),
      advisor: advisor("HIGH"),
      dossier: dossier("CONFLICTED"),
    }, database);
    assert.equal(forbidden, null);

    const unchangedAfterForeignAttempt = await loadOwnedSavedIntentReadiness(
      intentId,
      travelerA,
      database,
    );
    assert.equal(unchangedAfterForeignAttempt?.readiness?.fingerprint, second?.fingerprint);

    const changed = await persistOwnedSavedIntentReadiness({
      intentId,
      accountId: travelerA,
      readinessInput,
      result: result("2026-10-09T00:00:00.000Z", "NEEDS_ATTENTION"),
      advisor: advisor("HIGH"),
      dossier: dossier("CONFLICTED"),
    }, database);
    assert.equal(changed?.change.state, "CHANGED");
    assert.ok(changed?.change.changedKeys.includes("status"));
    assert.ok(changed?.change.changedKeys.includes("route"));
    assert.ok(changed?.change.changedKeys.includes("decision:entry_visa"));

    const row = await client.query<{ intent_snapshot: Record<string, unknown> }>(
      `SELECT intent_snapshot FROM traveler_saved_intents WHERE id=$1`,
      [intentId],
    );
    const memory = row.rows[0]!.intent_snapshot.__silaReadiness as Record<string, unknown>;
    assert.equal(memory.version, 1);
    assert.equal(memory.fingerprint, changed?.fingerprint);
  } finally {
    if (travelerA) await client.query("DELETE FROM accounts WHERE id=$1", [travelerA]).catch(() => undefined);
    if (travelerB) await client.query("DELETE FROM accounts WHERE id=$1", [travelerB]).catch(() => undefined);
    client.release();
    await database.end();
  }
});
