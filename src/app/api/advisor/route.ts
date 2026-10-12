import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_INSTRUCTION = `
أنت «مستشار صلة الذكي» (Sila Travel Advisor) — رفيق السفر التفاعلي والمستشار السياحي المعتمد في منصة صلة (الرحلة).
مهامك الأساسية:
1. تقديم استشارات سياحية موثوقة وعملية للمسافرين (تخطيط البرامج، الميزانية، أفضل أوقات الزيارة، العائلات، وشهر العسل).
2. شرح متطلبات التأشيرات بدقة مع التشديد دائماً على استخدام البوابات الحكومية الرسمية وتجنب الوسطاء غير المعتمدين.
3. ترشيح الوجهات ومساعدة المستخدم في صياغة متطلبات رحلته لإرسال طلب عرض سعر مباشر (RFQ) للوكلاء المعتمدين في منصة صلة.
4. الإجابة باللغة العربية بأسلوب راقٍ، ودود، ومنظم باستخدام النقاط والقوائم عند الحاجة.
إذا سألك المستخدم عن حجز مؤكد أو أسعار لحظية، وجّهه بلطف لاستخدام "سوق العروض" أو "طلب عرض سعر مخصص (RFQ)" في صلة للتواصل المباشر مع الوكلاء المعتمدين.
`;

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function POST(request: Request) {
  let messages: ChatMessage[];
  try {
    const body = await request.json();
    messages = body.messages || (body.prompt ? [{ role: "user", content: body.prompt }] : []);
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("`messages` must be a non-empty array", { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // Fallback demo advisor response if GEMINI_API_KEY is not configured yet
  if (!apiKey) {
    const userQuery = messages[messages.length - 1].content;
    const demoResponse = generateFallbackAdvisorResponse(userQuery);
    return new Response(demoResponse, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    // Transform chat messages to Gemini contents format
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const responseStream = await ai.models.generateContentStream({
      model,
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of responseStream) {
            const text = chunk.text;
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (streamError) {
          controller.error(streamError);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error: any) {
    console.error("Gemini Advisor API error:", error);
    // Provide a graceful fallback error explanation to the traveler
    const fallback = `عذراً، أواجه صعوبة مؤقتة في الاتصال بنموذج Gemini الذكي: ${error.message || "حدث خطأ غير متوقع"}. يمكنك تصفح دليل التأشيرات أو تقديم طلب عرض سعر مخصص وسيتواصل معك وكلاء صلة مباشرة!`;
    return new Response(fallback, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

function generateFallbackAdvisorResponse(query: string): string {
  const q = query.toLowerCase();
  if (q.includes("تأشير") || q.includes("فيزا") || q.includes("شنغن")) {
    return `أهلاً بك! بصفتي مستشارك في «صلة»، أنصحك بالاطلاع على قسم «التأشيرات والاكتشاف» في المنصة:\n\n1. **تأشيرات الخليج وتركيا وجورجيا:** متوفرة بروابط التقديم الحكومية الرسمية المباشرة.\n2. **تأشيرة شنغن:** تتطلب كشف حساب بنكي لـ 3-6 أشهر، تأمين سفر يغطي 30 ألف يورو، وتحديد موعد قبل 4-6 أسابيع.\n3. **المصادر المعتمدة:** نحرص في صلة على توجيهك دائماً للبوابات الحكومية لتفادي الرسوم المضاعفة من المواقع غير الرسمية.\n\nهل تود استكشاف متطلبات دولة معينة أو طلب عرض سعر مخصص؟`;
  }
  if (q.includes("ميزاني") || q.includes("سعر") || q.includes("تكلف")) {
    return `مرحباً بك! لتحديد أفضل ميزانية لرحلتك:\n\n• **الرحلات الاقتصادية (5,000 - 8,000 ريال لشخصين):** تناسب وجهات مثل جورجيا، البوسنة، وأذربيجان.\n• **الرحلات المتوسطة (10,000 - 18,000 ريال):** خيارات ممتازة للشمال التركي، تايلاند، أو ماليزيا شاملة الإقامة وتأجير السيارة.\n• **البرامج المخصصة:** يمكنك استخدام زر «طلب عرض سعر (RFQ)» في صلة لإرسال ميزانيتك ومواصفاتك مباشرة لوكلاء السفر المعتمدين لتقديم عروض منافسة.\n\nما هي وجهتك المفضلة وعدد المسافرين؟`;
  }
  return `أهلاً بك في منصة «صلة»! أنا رفيقك ومستشارك الذكي للسفر والسياحة.\n\nيمكنني مساعدتك في:\n• الاستفسار عن شروط وتأشيرات الدول وروابطها الحكومية الرسمية.\n• تخطيط جداول الرحلات والميزانيات التقديرية.\n• صياغة ومتابعة طلبات عروض الأسعار (RFQ) مع الوكلاء المعتمدين.\n\nكيف يمكنني مساعدتك في التخطيط لرحلتك القادمة؟`;
}
