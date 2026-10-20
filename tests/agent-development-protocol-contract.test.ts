import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const protocolPath = "docs/agent-development-protocol.md";

test("SILA development agents are governed by an explicit operating protocol", () => {
  assert.equal(fs.existsSync(protocolPath), true, "agent development protocol must exist");
  const protocol = fs.readFileSync(protocolPath, "utf8");

  assert.match(protocol, /isolated workspace/i);
  assert.match(protocol, /least privilege/i);
  assert.match(protocol, /root cause before fix/i);
  assert.match(protocol, /test-first/i);
  assert.match(protocol, /fresh verification/i);
  assert.match(protocol, /session ledger/i);
  assert.match(protocol, /no blind retries/i);
  assert.match(protocol, /production/i);
  assert.match(protocol, /security-sensitive/i);
});
