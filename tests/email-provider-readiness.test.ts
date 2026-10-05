import assert from "node:assert/strict";
import { mock, test, type TestContext } from "node:test";
import { Resend, type GetDomainResponseSuccess, type CreateEmailOptions, type CreateEmailRequestOptions } from "resend";
import { EmailProvider } from "../src/lib/providers/email";

function setup(t: TestContext) {
  const keys = ["RESEND_FROM_EMAIL", "RESEND_SENDING_DOMAIN_ID"];
  const before = keys.map((key) => process.env[key]);
  process.env.RESEND_FROM_EMAIL = "login@mail.example.test";
  process.env.RESEND_SENDING_DOMAIN_ID = "domain-under-test";
  t.after(() => {
    keys.forEach((key, i) => {
      if (before[i] === undefined) delete process.env[key];
      else process.env[key] = before[i];
    });
    mock.restoreAll();
  });
  const client = new Resend("re_synthetic_test_key");
  return { client, provider: new EmailProvider("re_synthetic_test_key", client) };
}

function domain(overrides: Partial<GetDomainResponseSuccess> = {}) {
  return {
    data: {
      object: "domain",
      id: "domain-under-test",
      name: "mail.example.test",
      status: "verified",
      capabilities: { sending: "enabled", receiving: "disabled" },
      region: "eu-west-1",
      created_at: "2026-10-05T00:00:00Z",
      records: [],
      ...overrides,
    } as GetDomainResponseSuccess,
    error: null,
    headers: null,
  };
}

const email = { to: "recipient@example.invalid", subject: "Test", html: "<p>Test</p>" };

test("missing credentials or sender fails closed without an external call", async (t) => {
  const { client, provider } = setup(t);
  const calls = mock.method(client.domains, "get", async () => domain());
  assert.equal((await new EmailProvider(null, client).probe()).status, "NOT_CONFIGURED");
  delete process.env.RESEND_FROM_EMAIL;
  assert.equal((await provider.probe()).status, "CONFIGURATION_REQUIRED");
  assert.equal((await provider.sendEmail(email)).sent, false);
  process.env.RESEND_FROM_EMAIL = "bad\naddress@mail.example.test";
  assert.equal((await provider.probe()).status, "CONFIGURATION_REQUIRED");
  assert.equal(calls.mock.callCount(), 0);
});

test("only the selected, verified, sending-enabled domain can send", async (t) => {
  const { client } = setup(t);
  const send = mock.method(client.emails, "send", async () => ({ data: { id: "synthetic-message" }, error: null, headers: null }));
  for (const overrides of [
    { status: "failed" as const },
    { status: "pending" as const },
    { status: "partially_verified" as const },
    { name: "unrelated-verified.example.test" },
    { capabilities: { sending: "disabled" as const, receiving: "enabled" as const } },
  ]) {
    const get = mock.method(client.domains, "get", async (id: string) => {
      assert.equal(id, "domain-under-test");
      return domain(overrides);
    });
    const provider = new EmailProvider("re_synthetic_test_key", client);
    assert.equal((await provider.probe()).status, "CONFIGURATION_REQUIRED");
    assert.equal((await provider.sendEmail(email)).sent, false);
    get.mock.restore();
  }
  assert.equal(send.mock.callCount(), 0);
});

test("accepted mail is queued, uses the chosen sender and real provider idempotency", async (t) => {
  const { client, provider } = setup(t);
  const get = mock.method(client.domains, "get", async () => domain());
  let payload: CreateEmailOptions | undefined;
  let options: CreateEmailRequestOptions | undefined;
  mock.method(client.emails, "send", async (data: CreateEmailOptions, requestOptions?: CreateEmailRequestOptions) => {
    payload = data;
    options = requestOptions;
    return { data: { id: "synthetic-message" }, error: null, headers: null };
  });
  const result = await provider.sendEmail({ ...email, idempotencyKey: "challenge-safe-hash" });
  assert.deepEqual(result, { sent: true, status: "QUEUED", id: "synthetic-message" });
  assert.match(payload!.from!, /<login@mail\.example\.test>$/);
  assert.equal(options?.idempotencyKey, "challenge-safe-hash");
  assert.equal((await provider.probe()).status, "CONNECTED");
  assert.equal(get.mock.callCount(), 1);
});

test("concurrent readiness checks coalesce and sender changes force a new probe", async (t) => {
  const { client, provider } = setup(t);
  const get = mock.method(client.domains, "get", async () => domain());
  const results = await Promise.all(Array.from({ length: 20 }, () => provider.probe()));
  assert.ok(results.every((result) => result.status === "CONNECTED"));
  assert.equal(get.mock.callCount(), 1);
  process.env.RESEND_FROM_EMAIL = "login@other.example.test";
  assert.equal((await provider.probe()).status, "CONFIGURATION_REQUIRED");
  assert.equal(get.mock.callCount(), 2);
});

test("provider failures never report a successful send or retain a stale probe", async (t) => {
  const { client, provider } = setup(t);
  const get = mock.method(client.domains, "get", async () => domain());
  mock.method(client.emails, "send", async () => ({ data: null, error: { name: "validation_error" as const, message: "Sending refused", statusCode: 403 }, headers: null }));
  assert.equal((await provider.sendEmail(email)).status, "FAILED");
  await provider.probe();
  assert.equal(get.mock.callCount(), 2);
  get.mock.restore();
  mock.method(client.domains, "get", async () => { throw new Error("Provider unavailable"); });
  const unavailable = new EmailProvider("re_synthetic_test_key", client);
  assert.equal((await unavailable.probe()).status, "DEGRADED");
  assert.deepEqual(await unavailable.sendEmail(email), {
    sent: false,
    status: "FAILED",
    error: "Resend requires a verified configured sender before sending mail.",
  });
});
test("an expired operation cannot start an email send after a slow probe completes", async (t) => {
  const { client, provider } = setup(t);
  const controller = new AbortController();
  mock.method(client.domains, "get", async () => { controller.abort(); return domain(); });
  const send = mock.method(client.emails, "send", async () => ({ data: { id: "must-not-send" }, error: null, headers: null }));
  const result = await provider.sendEmail(email, controller.signal);
  assert.equal(result.status, "FAILED"); assert.equal(result.sent, false);
  assert.equal(send.mock.callCount(), 0);
});
test("the actual SDK receives the operation's abort signal without a real external request", async (t) => {
  setup(t);
  const controller = new AbortController();
  let observedSignal: AbortSignal | undefined;
  mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
    observedSignal = options.signal as AbortSignal;
    controller.abort();
    return Response.json(domain().data);
  });
  const provider = new EmailProvider("re_synthetic_test_key");
  await provider.probe(controller.signal);
  assert.ok(observedSignal); assert.equal(observedSignal.aborted, true);
});
