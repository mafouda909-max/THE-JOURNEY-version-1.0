import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";
import { buildPoolConfig } from "../src/db";
import { createSilaTravelCase } from "../src/lib/sila-advisor-travel-case";

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

test("Sila advisor memory is owner-scoped and preserves the shared trip snapshot", { skip: !databaseUrl }, async () => {
  const {
    clearOwnedSilaAdvisorMemory,
    loadOwnedSilaAdvisorMemory,
    persistOwnedSilaAdvisorMemory,
  } = await import("../src/lib/sila-advisor-memory-store");

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
       VALUES ($1,'test:test','traveler','Sila Memory Traveler A') RETURNING id`,
      [`sila-memory-a-${suffix}@example.invalid`],
    );
    travelerA = a.rows[0]!.id;

    const b = await client.query<{ id: number }>(
      `INSERT INTO accounts (email,password_hash,role,display_name)
       VALUES ($1,'test:test','traveler','Sila Memory Traveler B') RETURNING id`,
      [`sila-memory-b-${suffix}@example.invalid`],
    );
    travelerB = b.rows[0]!.id;

    const intent = await client.query<{ id: number }>(
      `INSERT INTO traveler_saved_intents (account_id,label,intent_snapshot)
       VALUES ($1,'Owned Istanbul trip',$2::jsonb) RETURNING id`,
      [
        travelerA,
        JSON.stringify({
          originCity: "Cairo",
          destinations: ["Istanbul"],
          __silaReadiness: { sentinel: "keep-me" },
        }),
      ],
    );
    intentId = intent.rows[0]!.id;

    const emptyOwned = await loadOwnedSilaAdvisorMemory(intentId, travelerA, database);
    assert.equal(emptyOwned?.travelCase, null);
    assert.equal(await loadOwnedSilaAdvisorMemory(intentId, travelerB, database), null);

    const travelCase = createSilaTravelCase(
      "أنا مصري وعايز تركيا سياحة في ديسمبر وميزانيتي محدودة",
      new Date("2026-10-06T12:00:00.000Z"),
    );

    const saved = await persistOwnedSilaAdvisorMemory({
      intentId,
      accountId: travelerA,
      travelCase,
    }, database);
    assert.equal(saved?.travelCase?.id, travelCase.id);

    const loaded = await loadOwnedSilaAdvisorMemory(intentId, travelerA, database);
    assert.equal(loaded?.travelCase?.id, travelCase.id);
    assert.equal(loaded?.travelCase?.messages.length, 1);

    const deniedWrite = await persistOwnedSilaAdvisorMemory({
      intentId,
      accountId: travelerB,
      travelCase,
    }, database);
    assert.equal(deniedWrite, null);

    const snapshotAfterSave = await client.query<{ intent_snapshot: Record<string, unknown> }>(
      "SELECT intent_snapshot FROM traveler_saved_intents WHERE id=$1",
      [intentId],
    );
    assert.equal(snapshotAfterSave.rows[0]?.intent_snapshot.originCity, "Cairo");
    assert.deepEqual(snapshotAfterSave.rows[0]?.intent_snapshot.__silaReadiness, { sentinel: "keep-me" });

    assert.equal(await clearOwnedSilaAdvisorMemory(intentId, travelerB, database), false);
    assert.equal(await clearOwnedSilaAdvisorMemory(intentId, travelerA, database), true);

    const snapshotAfterClear = await client.query<{ intent_snapshot: Record<string, unknown> }>(
      "SELECT intent_snapshot FROM traveler_saved_intents WHERE id=$1",
      [intentId],
    );
    assert.equal(snapshotAfterClear.rows[0]?.intent_snapshot.__silaAdvisorCase, undefined);
    assert.deepEqual(snapshotAfterClear.rows[0]?.intent_snapshot.__silaReadiness, { sentinel: "keep-me" });
    assert.equal(snapshotAfterClear.rows[0]?.intent_snapshot.originCity, "Cairo");
  } finally {
    if (travelerA || travelerB) {
      await client.query(
        "DELETE FROM accounts WHERE id = ANY($1::int[])",
        [[travelerA, travelerB].filter(Boolean)],
      ).catch(() => undefined);
    }
    client.release();
    await database.end();
  }
});
