import { aiConfig } from "@/lib/config";

/**
 * AI PROVIDER ABSTRACTION — OpenRouter & OpenAI Integration
 *
 * Supports both OpenRouter and direct OpenAI API keys with dynamic model routing.
 *
 * Safety: Fallbacks to deterministic rule-based analysis if AI services are unconfigured or unreachable.
 */

export interface OfferReviewRequest {
  title: string;
  description: string;
  tripType: string;
  priceAmount: number;
  currency: string;
  priceType: string;
  includes: string[];
  excludes: string[];
  originCity: string;
  destinationCity: string;
  destinationCountry: string;
}

export interface OfferReviewResponse {
  policyVerdict: "APPROVED" | "HOLD" | "REJECTED";
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  transparencyScore: number; // 0 - 100
  reasoning: string[];
  suggestedChanges?: string[];
  reviewedBy: "ai_openrouter" | "ai_openai" | "deterministic_rules";
}

function getOpenRouterKey(): string | null {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || typeof key !== "string") return null;
  const trimmed = key.trim();
  return trimmed.length >= 10 ? trimmed : null;
}

function getOpenAIKey(): string | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key || typeof key !== "string") return null;
  const trimmed = key.trim();
  return trimmed.length >= 10 ? trimmed : null;
}

export class AIProvider {
  private openRouterKey: string | null;
  private openAIKey: string | null;

  constructor() {
    this.openRouterKey = getOpenRouterKey();
    this.openAIKey = getOpenAIKey();
  }

  public isConfigured(): boolean {
    return Boolean(this.openRouterKey || this.openAIKey);
  }

  public async probe(): Promise<{
    status: "CONNECTED" | "NOT_CONFIGURED" | "DEGRADED";
    providerName?: "OpenRouter" | "OpenAI";
    latencyMs: number | null;
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return { status: "NOT_CONFIGURED", latencyMs: null };
    }

    const t0 = Date.now();

    // Probe OpenRouter if configured
    if (this.openRouterKey) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/auth/key", {
          method: "GET",
          headers: { Authorization: `Bearer ${this.openRouterKey}` },
        });

        if (response.ok) {
          return { status: "CONNECTED", providerName: "OpenRouter", latencyMs: Date.now() - t0 };
        }
      } catch {
        /* fallback to OpenAI probe */
      }
    }

    // Probe OpenAI if configured
    if (this.openAIKey) {
      try {
        const response = await fetch("https://api.openai.com/v1/models", {
          method: "GET",
          headers: { Authorization: `Bearer ${this.openAIKey}` },
        });

        if (response.ok) {
          return { status: "CONNECTED", providerName: "OpenAI", latencyMs: Date.now() - t0 };
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "OpenAI connection failed";
        return { status: "DEGRADED", latencyMs: Date.now() - t0, error: msg };
      }
    }

    return { status: "DEGRADED", latencyMs: Date.now() - t0, error: "AI API Key authentication failed" };
  }

  private async callLLM(params: {
    model: string;
    systemPrompt: string;
    userPrompt: string;
  }): Promise<{ content: string; provider: "ai_openrouter" | "ai_openai" }> {
    if (this.openRouterKey) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.openRouterKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://thejourney.travel",
            "X-Title": "THE JOURNEY Platform",
          },
          body: JSON.stringify({
            model: params.model,
            messages: [
              { role: "system", content: params.systemPrompt },
              { role: "user", content: params.userPrompt },
            ],
            temperature: aiConfig.defaultTemperature,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return {
            content: data.choices?.[0]?.message?.content || "",
            provider: "ai_openrouter",
          };
        }
      } catch {
        /* fallback to OpenAI */
      }
    }

    if (this.openAIKey) {
      const openAIModel = params.model.includes("/") ? "gpt-4o-mini" : params.model;
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.openAIKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: openAIModel,
          messages: [
            { role: "system", content: params.systemPrompt },
            { role: "user", content: params.userPrompt },
          ],
          temperature: aiConfig.defaultTemperature,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API failed with HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        content: data.choices?.[0]?.message?.content || "",
        provider: "ai_openai",
      };
    }

    throw new Error("No AI API key configured");
  }

  /**
   * AI Offer Review Pipeline
   */
  public async reviewOffer(offer: OfferReviewRequest): Promise<OfferReviewResponse> {
    if (!this.isConfigured()) {
      return this.deterministicOfferReview(offer);
    }

    try {
      const systemPrompt = `You are the AI Trust Auditor for 'THE JOURNEY — الرحلة' travel marketplace.
Audit offer submissions for price transparency, hidden fees, misleading claims, and policy compliance.
Output JSON ONLY with schema:
{
  "policyVerdict": "APPROVED" | "HOLD" | "REJECTED",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "transparencyScore": number (0-100),
  "reasoning": string[],
  "suggestedChanges": string[]
}`;

      const userPrompt = `Audit Offer:
Title: ${offer.title}
Trip Type: ${offer.tripType}
Origin: ${offer.originCity} -> Destination: ${offer.destinationCity}, ${offer.destinationCountry}
Price: ${offer.priceAmount} ${offer.currency} (${offer.priceType})
Includes: ${offer.includes.join(", ")}
Excludes: ${offer.excludes.join(", ")}
Description: ${offer.description}`;

      const llmRes = await this.callLLM({
        model: aiConfig.strongModel,
        systemPrompt,
        userPrompt,
      });

      const parsed = JSON.parse(llmRes.content.replace(/```json|```/g, "").trim());
      return {
        policyVerdict: parsed.policyVerdict || "HOLD",
        riskLevel: parsed.riskLevel || "MEDIUM",
        transparencyScore: parsed.transparencyScore ?? 75,
        reasoning: parsed.reasoning || ["AI audit completed."],
        suggestedChanges: parsed.suggestedChanges,
        reviewedBy: llmRes.provider,
      };
    } catch {
      return this.deterministicOfferReview(offer);
    }
  }

  /**
   * Classify risk level
   */
  public async classifyRisk(content: string): Promise<"LOW" | "MEDIUM" | "HIGH"> {
    if (!this.isConfigured()) {
      if (content.includes("http") || content.includes("whatsapp") || content.includes("pay")) return "MEDIUM";
      return "LOW";
    }

    try {
      const systemPrompt = `Classify safety risk of this travel text into LOW, MEDIUM, or HIGH. Output ONE WORD ONLY.`;
      const llmRes = await this.callLLM({
        model: aiConfig.fastModel,
        systemPrompt,
        userPrompt: content,
      });

      const clean = llmRes.content.trim().toUpperCase();
      if (clean.includes("HIGH")) return "HIGH";
      if (clean.includes("MEDIUM")) return "MEDIUM";
      return "LOW";
    } catch {
      return "LOW";
    }
  }

  /**
   * Synthesize Travel Intelligence
   */
  public async synthesizeTravelIntel(params: {
    question: string;
    untrustedWebContext: string;
  }): Promise<{ answer: string; sourcesUsed: string[]; confidence: "HIGH" | "MEDIUM" | "LOW" }> {
    if (!this.isConfigured()) {
      return {
        answer: "الرجاء مراجعة المصادر الرسمية للتحقق من شروط السفر والتأشيرة.",
        sourcesUsed: [],
        confidence: "LOW",
      };
    }

    try {
      const systemPrompt = `You are the Travel Intelligence Assistant for THE JOURNEY.
Answer travel questions in clear Arabic based ONLY on verified information provided in the untrusted web context.
Cite source URLs for every claim.`;

      const userPrompt = `User Question: ${params.question}\n\n${params.untrustedWebContext}`;

      const llmRes = await this.callLLM({
        model: aiConfig.strongModel,
        systemPrompt,
        userPrompt,
      });

      return {
        answer: llmRes.content,
        sourcesUsed: [],
        confidence: "HIGH",
      };
    } catch {
      return {
        answer: "تعذر استرجاع الإجابة عبر المزود حالياً. يُنصح بمراجعة القنصلية الرسمية.",
        sourcesUsed: [],
        confidence: "LOW",
      };
    }
  }

  private deterministicOfferReview(offer: OfferReviewRequest): OfferReviewResponse {
    const reasoning: string[] = [];
    let riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";
    let verdict: "APPROVED" | "HOLD" | "REJECTED" = "APPROVED";
    let score = 90;

    if (offer.priceType === "starting_from" && !offer.description.includes("جدول") && !offer.description.includes("فروقات")) {
      reasoning.push("العرض يعتمد خيار 'يبدأ من' بدون توضيح تفصيلي للفروقات بين الفئات.");
      riskLevel = "MEDIUM";
      verdict = "HOLD";
      score -= 25;
    }

    if (offer.includes.length === 0) {
      reasoning.push("لم يتم تحديد المشمولات في البرنامج بشكل واضح.");
      riskLevel = "MEDIUM";
      verdict = "HOLD";
      score -= 20;
    }

    if (reasoning.length === 0) {
      reasoning.push("تم فحص العرض بنجاح وفق القواعد المحددة. السعر الشامل والمشتملات موضحة.");
    }

    return {
      policyVerdict: verdict,
      riskLevel,
      transparencyScore: score,
      reasoning,
      reviewedBy: "deterministic_rules",
    };
  }
}

export const aiProvider = new AIProvider();
