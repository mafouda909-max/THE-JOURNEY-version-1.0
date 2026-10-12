import { OpenRouter } from "@openrouter/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.OPENROUTER_MODEL ?? "google/gemini-3.7-flash";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type StreamChunk = {
  choices?: Array<{ delta?: { content?: string } }>;
  usage?: {
    completionTokensDetails?: { reasoningTokens?: number };
  };
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response("Missing OPENROUTER_API_KEY environment variable", {
      status: 500,
    });
  }

  let messages: ChatMessage[];
  try {
    const body = await request.json();
    messages = body.messages;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("`messages` must be a non-empty array", {
      status: 400,
    });
  }

  const openrouter = new OpenRouter({ apiKey });

  const response = await openrouter.chat.send({
    chatRequest: {
      model: MODEL,
      messages,
      stream: true,
    },
  });

  if (!(response instanceof ReadableStream)) {
    return Response.json(response);
  }

  const encoder = new TextEncoder();

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of response as AsyncIterable<StreamChunk>) {
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) {
            controller.enqueue(encoder.encode(content));
          }
          if (chunk.usage) {
            const reasoning = chunk.usage.completionTokensDetails?.reasoningTokens;
            if (reasoning != null) {
              controller.enqueue(
                encoder.encode(`\n[reasoning tokens: ${reasoning}]`),
              );
            }
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
