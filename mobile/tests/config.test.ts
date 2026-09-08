import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  apiBaseUrlFromPackagerHost,
  extractHost,
  MISSING_BASE_URL_ERROR,
  normalizeBaseUrl,
  resolveApiConfig,
  DEFAULT_DEV_API_PORT,
  DEFAULT_TIMEOUT_MS,
} from "../src/lib/config";

describe("normalizeBaseUrl", () => {
  it("accepts an absolute origin and trims the trailing slash", () => {
    assert.equal(normalizeBaseUrl("https://api.al-rehla.com"), "https://api.al-rehla.com");
    assert.equal(normalizeBaseUrl("  https://api.al-rehla.com/  "), "https://api.al-rehla.com");
    assert.equal(normalizeBaseUrl("http://10.0.2.2:3000"), "http://10.0.2.2:3000");
  });

  it("rejects anything that is not a bare http(s) origin", () => {
    assert.equal(normalizeBaseUrl("https://api.al-rehla.com/v1"), null);
    assert.equal(normalizeBaseUrl("https://api.al-rehla.com?debug=1"), null);
    assert.equal(normalizeBaseUrl("https://api.al-rehla.com#x"), null);
    assert.equal(normalizeBaseUrl("ftp://api.al-rehla.com"), null);
    assert.equal(normalizeBaseUrl("api.al-rehla.com"), null);
    assert.equal(normalizeBaseUrl("https://user:pass@al-rehla.com"), null);
    assert.equal(normalizeBaseUrl(""), null);
    assert.equal(normalizeBaseUrl(undefined), null);
    assert.equal(normalizeBaseUrl(42), null);
  });
});

describe("extractHost", () => {
  it("strips ports and understands IPv6 literals", () => {
    assert.equal(extractHost("192.168.1.42:8081"), "192.168.1.42");
    assert.equal(extractHost("[::1]:8081"), "::1");
    assert.equal(extractHost("localhost"), "localhost");
    assert.equal(extractHost("fe80::1"), "fe80::1");
  });
});

describe("apiBaseUrlFromPackagerHost", () => {
  it("maps the Metro host to the Next dev port", () => {
    assert.equal(
      apiBaseUrlFromPackagerHost(
        "192.168.1.42:8081/node_modules/expo/AppEntry.bundle?platform=ios",
      ),
      "http://192.168.1.42:3000",
    );
  });

  it("honours a custom dev port and IPv6 hosts", () => {
    assert.equal(apiBaseUrlFromPackagerHost("10.0.0.5:8081/index.bundle", 4000), "http://10.0.0.5:4000");
    assert.equal(apiBaseUrlFromPackagerHost("[::1]:8081/index.bundle"), "http://[::1]:3000");
    assert.equal(apiBaseUrlFromPackagerHost("10.0.0.5:8081/x", 70_000), "http://10.0.0.5:3000");
  });

  it("returns null for unusable input", () => {
    assert.equal(apiBaseUrlFromPackagerHost(null), null);
    assert.equal(apiBaseUrlFromPackagerHost(undefined), null);
    assert.equal(apiBaseUrlFromPackagerHost(""), null);
    assert.equal(apiBaseUrlFromPackagerHost("///leading-slash"), null);
  });

  it("uses the documented defaults", () => {
    assert.equal(DEFAULT_DEV_API_PORT, 3_000);
    assert.equal(DEFAULT_TIMEOUT_MS, 8_000);
  });
});

describe("resolveApiConfig", () => {
  it("prefers app config over env and packager", () => {
    const resolved = resolveApiConfig({
      appConfigBaseUrl: "https://api.al-rehla.com",
      envBaseUrl: "https://staging.al-rehla.com",
      packagerHostUri: "192.168.1.42:8081/index.bundle",
      isDev: true,
    });
    assert.equal(resolved.baseUrl, "https://api.al-rehla.com");
    assert.equal(resolved.source, "app-config");
    assert.equal(resolved.timeoutMs, DEFAULT_TIMEOUT_MS);
    assert.equal(resolved.error, undefined);
  });

  it("falls back to env, then to the packager host in dev only", () => {
    const fromEnv = resolveApiConfig({ envBaseUrl: "https://staging.al-rehla.com" });
    assert.equal(fromEnv.source, "env");
    assert.equal(fromEnv.baseUrl, "https://staging.al-rehla.com");

    const fromPackager = resolveApiConfig({
      packagerHostUri: "192.168.1.42:8081/index.bundle",
      isDev: true,
    });
    assert.equal(fromPackager.source, "packager");
    assert.equal(fromPackager.baseUrl, "http://192.168.1.42:3000");

    const production = resolveApiConfig({ packagerHostUri: "192.168.1.42:8081/index.bundle" });
    assert.equal(production.source, "unset");
    assert.equal(production.baseUrl, null);
  });

  it("reports a malformed app-config value instead of silently falling back", () => {
    const resolved = resolveApiConfig({ appConfigBaseUrl: "api.al-rehla.com/v1" });
    assert.equal(resolved.baseUrl, null);
    assert.equal(resolved.source, "app-config");
    assert.match(resolved.error ?? "", /غير صالحة/);
  });

  it("explains how to configure the origin when nothing resolves", () => {
    const resolved = resolveApiConfig({});
    assert.equal(resolved.error, MISSING_BASE_URL_ERROR);
    assert.match(MISSING_BASE_URL_ERROR, /apiBaseUrl/);
  });

  it("keeps a positive timeout override and ignores nonsense", () => {
    assert.equal(resolveApiConfig({ timeoutMs: 1_500 }).timeoutMs, 1_500);
    assert.equal(resolveApiConfig({ timeoutMs: -5 }).timeoutMs, DEFAULT_TIMEOUT_MS);
    assert.equal(resolveApiConfig({ timeoutMs: 1_500.6 }).timeoutMs, 1_501);
  });
});
