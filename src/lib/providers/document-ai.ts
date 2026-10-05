import { providerSignal } from "@/lib/provider-deadline";

// Authentication probe only. An analysis validates its evidence contract;
// listing models does not prove model-specific access or document authenticity.
export async function probeDocumentAI(signal: AbortSignal): Promise<boolean> {
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    cache: "no-store",
    signal: providerSignal(signal, 4000),
  });
  return response.ok;
}
