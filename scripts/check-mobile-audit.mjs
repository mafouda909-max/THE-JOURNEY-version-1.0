import { readFileSync } from "node:fs";

const [auditPath = "mobile-audit.json", exceptionsPath = "mobile-audit-exceptions.json"] = process.argv.slice(2);
const audit = JSON.parse(readFileSync(auditPath, "utf8"));
const policy = JSON.parse(readFileSync(exceptionsPath, "utf8"));

const today = new Date().toISOString().slice(0, 10);
if (!policy.expiresOn || today > policy.expiresOn) {
  console.error(`Mobile audit exception expired on ${policy.expiresOn ?? "unknown"}.`);
  process.exit(1);
}

const allowed = new Set(
  (policy.allowedHighCriticalAdvisories ?? []).map((item) => `${item.package}|${item.url}`),
);
const found = [];
const unknown = [];

for (const [packageName, vulnerability] of Object.entries(audit.vulnerabilities ?? {})) {
  const severity = vulnerability?.severity;
  if (severity !== "high" && severity !== "critical") continue;

  const advisoryObjects = Array.isArray(vulnerability.via)
    ? vulnerability.via.filter((item) => item && typeof item === "object")
    : [];

  for (const advisory of advisoryObjects) {
    if (advisory.severity !== "high" && advisory.severity !== "critical") continue;
    const url = String(advisory.url ?? "");
    const key = `${packageName}|${url}`;
    const item = { packageName, severity: advisory.severity, url, title: advisory.title };
    found.push(item);
    if (!allowed.has(key)) unknown.push(item);
  }
}

if (unknown.length > 0) {
  console.error("Unapproved high/critical mobile advisories detected:");
  for (const item of unknown) {
    console.error(`- ${item.packageName}: ${item.severity} ${item.url} — ${item.title ?? ""}`);
  }
  process.exit(1);
}

const highCount = Number(audit.metadata?.vulnerabilities?.high ?? 0);
const criticalCount = Number(audit.metadata?.vulnerabilities?.critical ?? 0);
if ((highCount > 0 || criticalCount > 0) && found.length === 0) {
  console.error("High/critical vulnerabilities were reported but no direct advisory records were available to validate.");
  process.exit(1);
}

console.log(
  `Mobile audit gate accepted only approved upstream advisories through ${policy.expiresOn}. Aggregate: ${highCount} high / ${criticalCount} critical.`,
);
