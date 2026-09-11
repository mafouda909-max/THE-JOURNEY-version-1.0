/**
 * Web ⇄ mobile contract.
 *
 * The mobile companion app (mobile/) talks to these Next routes over JSON. The
 * two packages are typechecked independently, so this suite is what prevents
 * the client from silently diverging: declared routes must exist and serve the
 * verb, and every shared literal (trip types, currencies, price labels, health
 * statuses, contact-form limits, payload columns) must match the server.
 */

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const ROOT = process.cwd();
const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

const SERVER = {
  offersRoute: "src/app/api/offers/route.ts",
  offerByIdRoute: "src/app/api/offers/[id]/route.ts",
  agentsRoute: "src/app/api/agents/route.ts",
  contactRoute: "src/app/api/contact-requests/route.ts",
  healthRoute: "src/app/api/health/route.ts",
  format: "src/lib/format.ts",
  schema: "src/db/schema.ts",
};

const MOBILE = {
  endpoints: "mobile/src/api/endpoints.ts",
  types: "mobile/src/api/types.ts",
  format: "mobile/src/lib/format.ts",
  validation: "mobile/src/lib/validation.ts",
};

function sliceBetween(source: string, startRe: RegExp, endRe: RegExp, label: string): string {
  const start = source.match(startRe);
  assert.ok(start && start.index !== undefined, `${label}: opening marker not found`);
  const from = start.index + start[0].length;
  const rest = source.slice(from);
  const end = rest.search(endRe);
  assert.notEqual(end, -1, `${label}: closing marker not found`);
  return rest.slice(0, end);
}

function stripComments(value: string): string {
  return value.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** `key: "label"` pairs inside a block, in source order. */
function labelledKeys(block: string): Array<{ key: string; label: string }> {
  const out: Array<{ key: string; label: string }> = [];
  const re = /([A-Za-z_][\w]*)\s*:\s*"([^"]*)"/g;
  for (const match of block.matchAll(re)) {
    if (match[1] && match[2] !== undefined) out.push({ key: match[1], label: match[2] });
  }
  return out;
}

function quotedList(block: string): string[] {
  return [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? "");
}

function regexLiteral(source: string, name: string): string {
  const match = source.match(new RegExp(`${name}\\s*=\\s*/(.+)/[a-z]*;`));
  assert.ok(match?.[1], `${name} literal not found`);
  return match[1];
}

/**
 * The schema documents allowed varchar values in a trailing comment, e.g.
 * `verificationStatus: varchar("verification_status", { length: 16 }) ... // pending | in_review | verified`.
 * Those comments are the contract the mobile unions must match, so the union is
 * read from them rather than being duplicated here.
 */
function documentedUnion(schema: string, marker: RegExp): string[] {
  const match = schema.match(marker);
  return (match?.[1] ?? "")
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean);
}

function numericGuard(source: string, pattern: RegExp, label: string): number {
  const match = source.match(pattern);
  assert.ok(match?.[1], `${label} not found in server source`);
  return Number(match[1]);
}

function routeFileFor(path: string): string {
  const segments = path
    .replace(/^\/api\//, "")
    .split("/")
    .map((segment) => (segment === ":id" ? "[id]" : segment));
  return join("src", "app", "api", ...segments, "route.ts");
}

describe("mobile ⇄ api routes", () => {
  const declarations = [...read(MOBILE.endpoints).matchAll(/\{\s*path:\s*"([^"]+)",\s*method:\s*"(GET|POST)"\s*\}/g)].map(
    (m) => ({ path: m[1] ?? "", method: m[2] ?? "" }),
  );

  it("declares at least the endpoints the traveler flow needs", () => {
    assert.ok(declarations.length >= 5, "expected the mobile client to declare its routes");
    assert.deepEqual(
      declarations.map((d) => `${d.method} ${d.path}`).sort(),
      [
        "GET /api/agents",
        "GET /api/health",
        "GET /api/offers",
        "GET /api/offers/:id",
        "POST /api/contact-requests",
      ].sort(),
    );
  });

  for (const declaration of declarations) {
    it(`serves ${declaration.method} ${declaration.path}`, () => {
      const file = routeFileFor(declaration.path);
      assert.ok(existsSync(join(ROOT, file)), `${declaration.path} should resolve to ${file}`);
      const source = read(file);
      assert.match(
        source,
        new RegExp(`export async function ${declaration.method}\\(`),
        `${file} must export ${declaration.method} for the mobile client`,
      );
    });
  }

  it("keeps the offers list public and published-only", () => {
    const list = read(SERVER.offersRoute);
    assert.match(list, /searchParams\.get\("status"\)\s*\?\?\s*"published"/);
    assert.doesNotMatch(sliceBetween(list, /export async function GET\(/, /\n}\n/, "GET /api/offers"), /requireAdmin\(/);
    const byId = read(SERVER.offerByIdRoute);
    assert.match(byId, /status\s*!==\s*"published"/, "GET by id must keep hiding non-published offers");
  });
});

describe("mobile ⇄ shared literals", () => {
  const webFormat = read(SERVER.format);
  const mobileFormat = read(MOBILE.format);

  it("uses the same trip types, in the same order, with the same Arabic labels", () => {
    const webBlock = sliceBetween(webFormat, /export const TRIP_TYPES = \[/, /\] as const;/, "web TRIP_TYPES");
    const mobileBlock = sliceBetween(mobileFormat, /export const TRIP_TYPES = \[/, /\] as const;/, "mobile TRIP_TYPES");
    const pairs = (block: string) =>
      [...block.matchAll(/\{\s*key:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*labelEn:\s*"([^"]+)"\s*\}/g)].map(
        (m) => `${m[1]}|${m[2]}|${m[3]}`,
      );
    const web = pairs(webBlock);
    const mobile = pairs(mobileBlock);
    assert.ok(web.length >= 6, "expected the six published trip types");
    assert.deepEqual(mobile, web);
  });

  it("accepts exactly the currencies the offers API whitelists", () => {
    const webCurrencies = quotedList(
      sliceBetween(read(SERVER.offersRoute), /const CURRENCIES = new Set\(\[/, /\]\);/, "server CURRENCIES"),
    );
    const mobileCurrencies = quotedList(
      sliceBetween(mobileFormat, /export const CURRENCIES = \[/, /\] as const;/, "mobile CURRENCIES"),
    );
    assert.ok(webCurrencies.length > 0);
    assert.deepEqual(mobileCurrencies, webCurrencies);
  });

  it("reuses the server's price-type labels verbatim", () => {
    const web = labelledKeys(sliceBetween(webFormat, /export const PRICE_TYPE_LABELS[^=]*= \{/, /\};/, "web PRICE_TYPE_LABELS"));
    const mobile = labelledKeys(
      sliceBetween(mobileFormat, /export const PRICE_TYPE_LABELS[^=]*= \{/, /\};/, "mobile PRICE_TYPE_LABELS"),
    );
    assert.ok(web.length >= 3);
    assert.deepEqual(mobile, web);
  });

  it("models every health status the API can report", () => {
    const union = (source: string, label: string) =>
      quotedList(sliceBetween(source, /export type HealthStatus = /, /;/, label));
    const web = union(read(SERVER.healthRoute), "server HealthStatus");
    const mobile = union(read(MOBILE.types), "mobile HealthStatus");
    assert.deepEqual(mobile, web);
  });

  it("keeps the verification statuses the agents table can hold", () => {
    const schema = read(SERVER.schema);
    const documented = documentedUnion(
      schema,
      /"verification_status"[\s\S]{0,240}?\/\/\s*([^\n]+)/,
    );
    assert.ok(documented.length > 0, "expected the agents schema comment to enumerate verification statuses");
    const mobile = quotedList(sliceBetween(read(MOBILE.types), /export type VerificationStatus = /, /;/, "mobile VerificationStatus"));
    assert.deepEqual(mobile.sort(), documented.sort());
  });

  it("keeps offer status values consistent with the state machine", () => {
    const offerStatuses = documentedUnion(
      read(SERVER.schema),
      /\bstatus: varchar\("status"[\s\S]{0,240}?\/\/\s*([^\n]+)/,
    );
    assert.ok(offerStatuses.includes("published"), "offers must document the published state");
    assert.match(
      read(SERVER.offersRoute),
      /eq\(offers\.status, status\)/,
      "the offers list route is expected to keep filtering by status",
    );
  });
});

describe("mobile ⇄ contact form validation", () => {
  const serverSource = stripComments(read(SERVER.contactRoute));
  const mobileSource = read(MOBILE.validation);

  it("mirrors the server's bounded lengths", () => {
    const nameMin = numericGuard(serverSource, /travelerName\.trim\(\)\.length < (\d+)/, "name minimum");
    const nameMax = numericGuard(serverSource, /travelerName\.trim\(\)\.length > (\d+)/, "name maximum");
    const messageMin = numericGuard(serverSource, /message\.trim\(\)\.length < (\d+)/, "message minimum");
    const messageMax = numericGuard(serverSource, /message\.trim\(\)\.length > (\d+)/, "message maximum");
    const emailMax = numericGuard(serverSource, /travelerEmail\.trim\(\)\.length > (\d+)/, "email maximum");
    const travelDatesMax = numericGuard(serverSource, /travelDates\.length > (\d+)/, "travel dates maximum");
    assert.equal(numericGuard(mobileSource, /export const NAME_MIN = (\d+)/, "mobile NAME_MIN"), nameMin);
    assert.equal(numericGuard(mobileSource, /export const NAME_MAX = (\d+)/, "mobile NAME_MAX"), nameMax);
    assert.equal(numericGuard(mobileSource, /export const MESSAGE_MIN = (\d+)/, "mobile MESSAGE_MIN"), messageMin);
    assert.equal(numericGuard(mobileSource, /export const MESSAGE_MAX = ([\d_]+)/, "mobile MESSAGE_MAX"), messageMax);
    assert.equal(numericGuard(mobileSource, /export const EMAIL_MAX = (\d+)/, "mobile EMAIL_MAX"), emailMax);
    assert.equal(numericGuard(mobileSource, /export const TRAVEL_DATES_MAX = (\d+)/, "mobile TRAVEL_DATES_MAX"), travelDatesMax);
  });

  it("uses the identical email pattern", () => {
    assert.equal(regexLiteral(mobileSource, "EMAIL_PATTERN"), regexLiteral(serverSource, "EMAIL_RE"));
  });

  it("reuses the server's refusal copy so a rejected draft says the same thing", () => {
    for (const phrase of [
      "اكتب اسمًا صحيحًا بحد أقصى ١٢٠ حرفًا.",
      "صيغة البريد الإلكتروني غير صحيحة.",
      "اكتب رسالة بين ١٠ و٢٠٠٠ حرف.",
      "هذا العرض لم يعد متاحاً.",
      "عرض غير معروف.",
    ]) {
      assert.ok(serverSource.includes(phrase), `server no longer returns "${phrase}" — update the mobile copy`);
      assert.ok(mobileSource.includes(phrase), `mobile copy is missing "${phrase}"`);
    }
  });
});

describe("mobile ⇄ payload shape", () => {
  const INTENTIONALLY_OMITTED = new Set(["rejectionReason"]);

  function columnsOf(table: string): string[] {
    const source = read(SERVER.schema);
    const declared = source.indexOf(`export const ${table} = pgTable(`);
    assert.notEqual(declared, -1, `${table} table not found in schema`);
    const open = source.indexOf("{", declared);
    let depth = 0;
    let end = -1;
    for (let index = open; index < source.length; index += 1) {
      const char = source[index];
      if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          end = index;
          break;
        }
      }
    }
    assert.notEqual(end, -1, `${table} column block is unbalanced`);
    const body = source.slice(open + 1, end);
    return [...body.matchAll(/^\s{2}([A-Za-z_][\w]*):/gm)].map((m) => m[1] ?? "").filter(Boolean);
  }

  function interfaceBody(name: string): string {
    return sliceBetween(read(MOBILE.types), new RegExp(`export interface ${name} \\{`), /\n\}/, `mobile ${name}`);
  }

  for (const [table, iface] of [
    ["offers", "Offer"],
    ["agents", "Agent"],
  ] as const) {
    it(`declares every ${table} column the API returns in ${iface}`, () => {
      const columns = columnsOf(table);
      assert.ok(columns.length >= 8, `expected ${table} to have its full column list`);
      const body = interfaceBody(iface);
      for (const column of columns) {
        if (INTENTIONALLY_OMITTED.has(column)) {
          assert.doesNotMatch(
            body,
            new RegExp(`(^|\\s)${column}\\??:`),
            `${column} is an internal field and must stay out of the mobile payload`,
          );
          continue;
        }
        assert.match(body, new RegExp(`(^|\\s)${column}\\??:`), `mobile ${iface} is missing "${column}"`);
      }
    });
  }

  it("does not ship an unauthenticated write beyond the contact request", () => {
    const client = stripComments(read("mobile/src/api/client.ts"));
    const posts = [...client.matchAll(/method:\s*"POST"/g)];
    assert.equal(posts.length, 1, "exactly one POST route is allowed without auth");
  });
});

describe("mobile package hygiene", () => {
  it("keeps the production origin out of source and config", () => {
    const endpoints = read(MOBILE.endpoints);
    const appConfig = read("mobile/app.json");
    const extra = JSON.parse(appConfig).expo?.extra ?? {};
    assert.equal(extra.apiBaseUrl, "", "app.json must not commit a deployment host");
    assert.doesNotMatch(
      endpoints,
      /https?:\/\/(?!.*example)[\w.-]+/,
      "the client must resolve its origin from config, not a hard-coded host",
    );
  });

  it("keeps the mobile cache versioned so payload changes invalidate it", () => {
    const screens = [read("mobile/src/screens/OffersScreen.tsx"), read("mobile/src/screens/AgentsScreen.tsx")].join("\n");
    assert.match(screens, /offers:v\d:/, "offers cache namespace must carry a version");
    assert.match(screens, /agents:v\d/, "agents cache namespace must carry a version");
  });
});
