import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  extractSilaAdvisorIntent,
  firstSilaAdvisorStep,
  selectSilaAdvisorMissingQuestions,
  summarizeSilaAdvisorUnderstanding,
} from "@/lib/sila-advisor-intake";
import { getVisaGuide } from "@/lib/visas";

export const dynamic = "force-dynamic";

const SYSTEM_INSTRUCTION = `أنت المستشار الذكي لمنصة «صلة» (Sila) المتخصصة في السفر الموثوق وربط المسافرين بالوكلاء المعتمدين.
قواعد عملك الصارمة:
1. الشخصية: مستشار سفر خبير، واقعي، مهني، ومباشر.
2. الثقة وعدم التأليف: لا تخترع أرقاماً وهمية للأسعار ولا تؤلف شروط تأشيرات. إذا كان المسار يتطلب تأشيرة، أشر إلى ضرورة الرجوع للبوابة الحكومية الرسمية وتأكيد حجز الطيران والتأمين.
3. التوجيه الذكي: لخص ما فهمته من طلب المسافر، واذكر الخطوات الأساسية الأولى (الفيزا، الميزانية التقريبية، التوقيت الأنسب).
4. الإيجاز والوضوح: اجعل إجابتك مرتبة في نقاط واضحة ومباشرة.`;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message?: string;
      destination?: string;
      nationality?: string;
      history?: Array<{ role: "user" | "model"; text: string }>;
    };

    const message = body.message?.trim();
    if (!message || message.length < 2) {
      return NextResponse.json(
        { error: "الرسالة مطلوبة ويجب أن تكون واضحة." },
        { status: 400 },
      );
    }

    const nationality = body.nationality?.trim() || "مصر";
    const destination = body.destination?.trim() || "";

    // Check if relevant official visa guide exists for context grounding
    const visaContext = destination ? getVisaGuide(destination, nationality) : null;
    let extraContext = "";
    if (visaContext) {
      extraContext = `\nمعلومات رسمية موثقة متوفرة عن الوجهة ${visaContext.destinationCountry}: نوع التأشيرة: ${visaContext.visaTypeLabel}، المصدر: ${visaContext.officialSourceName} (${visaContext.officialPortalUrl})، أهم الشروط: ${visaContext.entryRequirements.slice(0, 3).join("، ")}.`;
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    // If Gemini API Key is configured, use official Google GenAI SDK
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const contents = [
          ...(body.history ?? []).map((h) => ({
            role: h.role,
            parts: [{ text: h.text }],
          })),
          {
            role: "user",
            parts: [{ text: `${message}${extraContext}` }],
          },
        ];

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.3,
            maxOutputTokens: 800,
          },
        });

        const replyText = response.text?.trim();
        if (replyText) {
          return NextResponse.json({
            reply: replyText,
            source: "gemini",
            visaContext: visaContext
              ? {
                  country: visaContext.destinationCountry,
                  type: visaContext.visaTypeLabel,
                  portal: visaContext.officialPortalUrl,
                }
              : null,
          });
        }
      } catch (geminiError) {
        console.warn("Gemini API call failed, falling back to deterministic Sila Engine:", geminiError);
      }
    }

    // Fallback: Sila's deterministic intelligent intent engine
    const intent = extractSilaAdvisorIntent(message);
    const summary = summarizeSilaAdvisorUnderstanding(intent);
    const questions = selectSilaAdvisorMissingQuestions(intent, 3);
    const firstStep = firstSilaAdvisorStep(intent);

    let reply = `أهلاً بك في صلة! فهمت من طلبك التالي: ${summary}\n\n`;
    if (visaContext) {
      reply += `📌 بالنسبة إلى ${visaContext.destinationCountry}: المتطلب الرسمي هو (${visaContext.visaTypeLabel}) عبر ${visaContext.officialSourceName}.\n\n`;
    }
    reply += `الخطوة الأولى المقترحة: ${firstStep}\n\n`;
    if (questions.length > 0) {
      reply += `لتقديم أدق مشورة، أحتاج معرفة:\n${questions.map((q, idx) => `${idx + 1}. ${q.question}`).join("\n")}`;
    }

    return NextResponse.json({
      reply,
      source: "sila_engine",
      visaContext: visaContext
        ? {
            country: visaContext.destinationCountry,
            type: visaContext.visaTypeLabel,
            portal: visaContext.officialPortalUrl,
          }
        : null,
    });
  } catch (error) {
    console.error("Advisor route error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء معالجة استشارتك. حاول مجدداً." },
      { status: 500 },
    );
  }
}
