import assert from "node:assert/strict";
import { test } from "node:test";
import { VercelGatewayWebProvider } from "../src/lib/providers/vercel-gateway-web";

test("Vercel Gateway web research keeps only cited http sources and de-duplicates them", async () => {
  const provider = new VercelGatewayWebProvider("test-token-1234567890", async () =>
    new Response(JSON.stringify({
      output: [
        {
          type: "web_search_call",
          action: {
            sources: [
              { title: "Official source", url: "https://official.example/rule" },
              { title: "Duplicate", url: "https://official.example/rule" },
            ],
          },
        },
        {
          type: "message",
          content: [{
            type: "output_text",
            text: "معلومة مدعومة بالمصدر.",
            annotations: [
              { type: "url_citation", title: "Official source", url: "https://official.example/rule" },
              { type: "url_citation", title: "Unsafe", url: "javascript:alert(1)" },
            ],
          }],
        },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } })
  );

  const result = await provider.search("QA query", { maxResults: 5 });
  assert.equal(result.answer, "معلومة مدعومة بالمصدر.");
  assert.deepEqual(result.citations, [
    { title: "Official source", url: "https://official.example/rule" },
  ]);
});

test("Vercel Gateway web research fails closed when output has no cited source", async () => {
  const provider = new VercelGatewayWebProvider("test-token-1234567890", async () =>
    new Response(JSON.stringify({
      output: [{ type: "message", content: [{ type: "output_text", text: "Unsupported answer", annotations: [] }] }],
    }), { status: 200, headers: { "content-type": "application/json" } })
  );

  await assert.rejects(provider.search("QA query"), /UNGROUNDED/);
});

test("Vercel Gateway web research is unconfigured without OIDC or gateway token", () => {
  const provider = new VercelGatewayWebProvider(null, fetch);
  assert.equal(provider.isConfigured(), false);
});
