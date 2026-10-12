import "server-only";
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://tokenra.io/v1",
  apiKey: process.env.TOKENRA_API_KEY,
});

interface OxAlphaChatOptions {
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  enableReasoning?: boolean;
}

export interface OxAlphaResponse {
  content: string;
  reasoningDetails?: unknown;
}

export async function oxAlphaChat({
  messages,
  enableReasoning = true,
}: OxAlphaChatOptions): Promise<OxAlphaResponse> {
  const response = await client.chat.completions.create({
    model: "stealth/ox-alpha",
    messages,
    // @ts-expect-error -- reasoning is an OpenRouter extension not in SDK types
    reasoning: enableReasoning ? { enabled: true } : undefined,
  });

  const msg = response.choices[0]?.message as typeof response.choices[0]["message"] & {
    reasoning_details?: unknown;
  };

  return {
    content: msg?.content ?? "",
    reasoningDetails: msg?.reasoning_details,
  };
}

export { client as oxAlphaClient };
