import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveSilaProviderRuntime,
  resolveVercelGatewayCredential,
} from "../src/lib/sila-provider-runtime";

test("dedicated Vercel AI Gateway key is executable without the legacy enable flag", () => {
  const env = { VERCEL_AI_GATEWAY_API_KEY: "gateway-key-12345" };
  const state = resolveSilaProviderRuntime(env);

  assert.equal(state.vercelGateway.ready, true);
  assert.equal(state.vercelGateway.enabled, true);
  assert.equal(state.vercelGateway.credentialSource, "VERCEL_AI_GATEWAY_API_KEY");
  assert.equal(resolveVercelGatewayCredential(env), "gateway-key-12345");
});

test("generic AI_GATEWAY_API_KEY remains gated until SILA_VERCEL_GATEWAY_ENABLED is explicit", () => {
  const disabled = resolveSilaProviderRuntime({
    AI_GATEWAY_API_KEY: "generic-gateway-12345",
  });
  assert.equal(disabled.vercelGateway.credentialPresent, true);
  assert.equal(disabled.vercelGateway.ready, false);
  assert.equal(disabled.vercelGateway.enabled, false);

  const enabled = resolveSilaProviderRuntime({
    AI_GATEWAY_API_KEY: "generic-gateway-12345",
    SILA_VERCEL_GATEWAY_ENABLED: "true",
  });
  assert.equal(enabled.vercelGateway.ready, true);
  assert.equal(enabled.vercelGateway.credentialSource, "AI_GATEWAY_API_KEY");
});

test("Vercel OIDC token can power the Gateway only when the Gateway flag is enabled", () => {
  const state = resolveSilaProviderRuntime({
    VERCEL_OIDC_TOKEN: "oidc-token-123456789",
    SILA_VERCEL_GATEWAY_ENABLED: "true",
  });

  assert.equal(state.vercelGateway.ready, true);
  assert.equal(state.vercelGateway.credentialSource, "VERCEL_OIDC_TOKEN");
});

test("Anthropic credential is visible but not executable until a direct adapter exists", () => {
  const state = resolveSilaProviderRuntime({
    ANTHROPIC_API_KEY: "anthropic-key-12345",
  });

  assert.equal(state.anthropic.credentialPresent, true);
  assert.equal(state.anthropic.adapterAvailable, false);
  assert.equal(state.anthropic.ready, false);
});
