import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

const checkerPath = resolve(process.cwd(), "scripts/check-mobile-audit.mjs");

function runGate(
  audit: Record<string, unknown>,
  policy: Record<string, unknown>,
) {
  const directory = mkdtempSync(resolve(tmpdir(), "sila-mobile-audit-"));
  const auditPath = resolve(directory, "audit.json");
  const policyPath = resolve(directory, "policy.json");

  try {
    writeFileSync(auditPath, JSON.stringify(audit));
    writeFileSync(policyPath, JSON.stringify(policy));
    return spawnSync(process.execPath, [checkerPath, auditPath, policyPath], {
      encoding: "utf8",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const expiredPolicy = {
  expiresOn: "2026-11-03",
  allowedHighCriticalAdvisories: [],
};

const cleanAudit = {
  metadata: { vulnerabilities: { high: 0, critical: 0 } },
  vulnerabilities: {},
};

const highAudit = {
  metadata: { vulnerabilities: { high: 1, critical: 0 } },
  vulnerabilities: {
    "node-forge": {
      severity: "high",
      via: [
        {
          severity: "high",
          url: "https://github.com/advisories/GHSA-example-0000-0000",
          title: "Example high-severity advisory",
        },
      ],
    },
  },
};

test("clean mobile audit passes without an advisory exception", () => {
  const result = runGate(cleanAudit, expiredPolicy);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /0 high \/ 0 critical/);
  assert.match(result.stdout, /No advisory exception is required/);
});

test("high or critical findings fail when the exception policy has expired", () => {
  const result = runGate(highAudit, expiredPolicy);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /exception expired/);
});

test("unapproved high or critical findings fail even with a valid policy window", () => {
  const result = runGate(highAudit, {
    expiresOn: "2999-12-31",
    allowedHighCriticalAdvisories: [],
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unapproved high\/critical mobile advisories detected/);
});

test("only an explicitly listed advisory can use a current time-bounded exception", () => {
  const result = runGate(highAudit, {
    expiresOn: "2999-12-31",
    allowedHighCriticalAdvisories: [
      {
        package: "node-forge",
        url: "https://github.com/advisories/GHSA-example-0000-0000",
      },
    ],
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /accepted only approved upstream advisories/);
});

test("high or critical aggregate findings without advisory details fail closed", () => {
  const result = runGate(
    {
      metadata: { vulnerabilities: { high: 1, critical: 0 } },
      vulnerabilities: {},
    },
    { expiresOn: "2999-12-31", allowedHighCriticalAdvisories: [] },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /no direct advisory records were available/);
});
