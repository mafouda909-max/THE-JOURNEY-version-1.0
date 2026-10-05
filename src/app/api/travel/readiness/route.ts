import { NextResponse, after } from "next/server";
import { travelReadinessEngine } from "@/lib/travel-readiness";
import { buildReadinessAdvisor } from "@/lib/readiness-advisor";
import { advisorFollowUpQuestions } from "@/lib/readiness-advisor-policy";
import { trackEvent } from "@/lib/data";
import { parseReadinessInput } from "@/lib/readiness-contract";
import { TravelIntelUnavailable } from "@/lib/travel-intel";
import { clientIpFromRequest, rateLimiter } from "@/lib/rate-limit";
import { travelWebProvider } from "@/lib/providers/web";
import { validTravelDate } from "@/lib/evidence";
import { buildReadinessDecisionDossier } from "@/lib/readiness-decision-dossier";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const callerIp = clientIpFromRequest(request);
  const ingressLimit = rateLimiter.checkRateLimit(
    `travel-readiness-ingress:${callerIp}`,
    120,
    600,
  );
  if (!ingressLimit.allowed) {
    return NextResponse.json(
      { error: "تم تجاوز عدد الطلبات مؤقتًا. حاول لاحقًا." },
      {
        status: 429,
        headers: { "Retry-After": String(ingressLimit.resetSeconds) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = parseReadinessInput(body);
  if (!input) {
    return NextResponse.json(
      { error: "أدخل الجنسية والوجهة وصلاحية الجواز، وتأكد أن الغرض والتاريخ والميزانية بصيغة صحيحة." },
      { status: 422 },
    );
  }

  const isContinuation = Boolean(
    input.advisorAnswers && Object.keys(input.advisorAnswers).length > 0,
  );
  const flowLimit = rateLimiter.checkRateLimit(
    `travel-readiness-${isContinuation ? "continuation" : "start"}:${callerIp}`,
    isContinuation ? 60 : 30,
    600,
  );
  if (!flowLimit.allowed) {
    return NextResponse.json(
      {
        error: isContinuation
          ? "تم استهلاك حد متابعة الفحص مؤقتًا. احتفظ بإجاباتك وحاول لاحقًا."
          : "تم تجاوز عدد مرات بدء الفحص مؤقتًا. حاول لاحقًا.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(flowLimit.resetSeconds) },
      },
    );
  }

  if (!input.travelPurpose) {
    return NextResponse.json(
      { error: "حدد الغرض الأساسي من السفر أولًا حتى لا نبحث بقواعد رحلة مختلفة." },
      { status: 422 },
    );
  }

  const followUpQuestions = advisorFollowUpQuestions(input);
  if (followUpQuestions.length > 0) {
    after(() =>
      trackEvent(
        "readiness_questions_requested",
        {
          meta: JSON.stringify({
            purpose: input.travelPurpose,
            questionCount: followUpQuestions.length,
          }),
        },
        2000,
      ),
    );
    return NextResponse.json(
      { phase: "NEEDS_INPUT", questions: followUpQuestions },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const decisionTravelDate = input.advisorAnswers?.decision_travel_date;
  const effectiveInput =
    !input.travelDate && validTravelDate(decisionTravelDate)
      ? { ...input, travelDate: decisionTravelDate }
      : input;

  after(() =>
    trackEvent(
      "readiness_started",
      {
        meta: JSON.stringify({
          hasTransit: Boolean(effectiveInput.transitCountry),
          hasPurpose: Boolean(effectiveInput.travelPurpose),
          hasBudget: effectiveInput.budgetAmount !== undefined,
        }),
      },
      2000,
    ),
  );

  const runtimeOidcToken = request.headers.get("x-vercel-oidc-token");

  if (travelWebProvider.isConfigured(runtimeOidcToken)) {
    const researchLimit = rateLimiter.checkRateLimit(
      `travel-readiness-research:${callerIp}`,
      6,
      600,
    );
    if (!researchLimit.allowed) {
      return NextResponse.json(
        { error: "تم استهلاك حد البحث المباشر مؤقتًا. احتفظ بسياق الرحلة وحاول بعد قليل." },
        {
          status: 429,
          headers: { "Retry-After": String(researchLimit.resetSeconds) },
        },
      );
    }
  }

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const signal = AbortSignal.any([request.signal, controller.signal]);

  try {
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new TravelIntelUnavailable("TIMEOUT"));
      }, 18_000);
    });

    const [result, advisor] = await Promise.race([
      Promise.all([
        travelReadinessEngine.evaluateReadiness(effectiveInput, signal),
        buildReadinessAdvisor(effectiveInput, signal, runtimeOidcToken),
      ]),
      deadline,
    ]);

    const decisionDossier = buildReadinessDecisionDossier(
      effectiveInput,
      result,
      advisor.liveResearch,
    );

    if (decisionDossier.followUpQuestions.length > 0) {
      after(() =>
        trackEvent(
          "readiness_questions_requested",
          {
            meta: JSON.stringify({
              purpose: effectiveInput.travelPurpose,
              questionCount: decisionDossier.followUpQuestions.length,
              stage: "decision",
            }),
          },
          2000,
        ),
      );
      return NextResponse.json(
        {
          phase: "NEEDS_INPUT",
          questions: decisionDossier.followUpQuestions.map(({ id, label, why }) => ({
            id,
            label,
            why,
          })),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    after(() =>
      trackEvent(
        "readiness_completed",
        {
          meta: JSON.stringify({
            status: result.status,
            checklistCount: result.checklist.length,
            warningCount: result.warnings.length,
            researchStatus: advisor.liveResearch.status,
            offerSuggestionCount: advisor.offers.length,
          }),
        },
        2000,
      ),
    );

    return NextResponse.json(
      {
        ...result,
        advisor,
        decisionDossier,
        disclosure:
          "صلة تجمع بين الأدلة المنظمة والبحث المباشر والعروض الموجودة داخل المنصة. هذا إرشاد معلوماتي ضمن المصادر والنطاقات المعروضة، وليس تصريح سفر أو ضمان دخول أو توفر. أكد القواعد من مصدرها والسعر والتوفر قبل الالتزام.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const requestWasAborted = request.signal.aborted;
    const deadlineWasAborted = controller.signal.aborted;
    controller.abort();
    const code =
      requestWasAborted || deadlineWasAborted
        ? "TIMEOUT"
        : error instanceof TravelIntelUnavailable
          ? error.code
          : "DATA_UNAVAILABLE";

    return NextResponse.json(
      {
        error:
          code === "TIMEOUT"
            ? "استغرق فحص المصادر وقتًا طويلًا. لم تصدر نتيجة؛ حاول مجددًا."
            : "تعذر فحص المصادر حاليًا. لم تصدر نتيجة؛ حاول مجددًا.",
        code,
      },
      {
        status: code === "TIMEOUT" ? 504 : 503,
        headers: { "Retry-After": "15", "Cache-Control": "no-store" },
      },
    );
  } finally {
    controller.abort();
    clearTimeout(timer);
  }
}
