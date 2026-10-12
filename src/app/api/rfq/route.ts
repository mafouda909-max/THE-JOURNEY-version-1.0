import { NextResponse } from "next/server";
import { db } from "@/db";
import { rfqInquiries } from "@/db/schema";
import { trackEvent } from "@/lib/data";
import { rateLimiter, clientIpFromRequest } from "@/lib/rate-limit";
import { accountFromRequest } from "@/lib/identity";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    // 1. Rate limiting check (anti-spam throttling)
    const clientIp = clientIpFromRequest(request);
    const rateCheck = rateLimiter.checkRateLimit(`rfq:${clientIp}`, 10, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة بعد ${rateCheck.resetSeconds} ثانية.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateCheck.resetSeconds) },
        },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      travelerName?: string;
      travelerEmail?: string;
      travelerPhone?: string;
      originCity?: string;
      destinationCountry?: string;
      destinationCity?: string;
      travelDates?: string;
      travelerCount?: number;
      tripType?: string;
      budgetPreference?: string;
      notes?: string;
    } | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "بيانات الطلب غير صالحة." }, { status: 400 });
    }

    const travelerName = body.travelerName?.trim();
    const travelerEmail = body.travelerEmail?.trim().toLowerCase();
    const originCity = body.originCity?.trim();
    const destinationCountry = body.destinationCountry?.trim();
    const travelerPhone = body.travelerPhone?.trim();
    const destinationCity = body.destinationCity?.trim();
    const travelDates = body.travelDates?.trim();
    const notes = body.notes?.trim();

    // 2. Strict Input Validations
    if (!travelerName || travelerName.length < 2 || travelerName.length > 120) {
      return NextResponse.json(
        { error: "اسم المسافر مطلوب (بين حرفين و120 حرفاً)." },
        { status: 400 },
      );
    }

    if (!travelerEmail || travelerEmail.length > 200 || !EMAIL_REGEX.test(travelerEmail)) {
      return NextResponse.json(
        { error: "بريد إلكتروني صالح مطلوب للتواصل ومتابعة عروض السفر." },
        { status: 400 },
      );
    }

    if (!originCity || originCity.length < 2 || originCity.length > 100) {
      return NextResponse.json(
        { error: "مدينة الانطلاق مطلوبة (حرفين على الأقل)." },
        { status: 400 },
      );
    }

    if (!destinationCountry || destinationCountry.length < 2 || destinationCountry.length > 100) {
      return NextResponse.json(
        { error: "بلد الوجهة مطلوب (حرفين على الأقل)." },
        { status: 400 },
      );
    }

    if (travelerPhone && travelerPhone.length > 40) {
      return NextResponse.json(
        { error: "رقم الهاتف أطول من الحد المسموح (40 حرفاً)." },
        { status: 400 },
      );
    }

    if (destinationCity && destinationCity.length > 100) {
      return NextResponse.json(
        { error: "اسم المدينة أطول من الحد المسموح (100 حرف)." },
        { status: 400 },
      );
    }

    if (travelDates && travelDates.length > 100) {
      return NextResponse.json(
        { error: "تواريخ السفر أطول من الحد المسموح (100 حرف)." },
        { status: 400 },
      );
    }

    if (notes && notes.length > 2000) {
      return NextResponse.json(
        { error: "الملاحظات الإضافية أطول من الحد المسموح (2000 حرف)." },
        { status: 400 },
      );
    }

    const count = Number(body.travelerCount);
    if (isNaN(count) || count < 1 || count > 50) {
      return NextResponse.json(
        { error: "عدد المسافرين يجب أن يكون بين 1 و 50 مسافراً." },
        { status: 400 },
      );
    }
    const travelerCount = Math.floor(count);

    // 3. Optional authenticated account association
    let travelerAccountId: number | null = null;
    try {
      const account = await accountFromRequest(request);
      if (account?.id) {
        travelerAccountId = account.id;
      }
    } catch {
      // Non-blocking: guest inquiries are fully supported
    }

    // 4. Strict DB Persistence — Fail-Closed
    try {
      const [record] = await db
        .insert(rfqInquiries)
        .values({
          travelerName,
          travelerEmail,
          travelerPhone: travelerPhone || null,
          originCity,
          destinationCountry,
          destinationCity: destinationCity || null,
          travelDates: travelDates || null,
          travelerCount,
          tripType: body.tripType?.trim().slice(0, 24) || "package",
          budgetPreference: body.budgetPreference?.trim().slice(0, 32) || "moderate",
          notes: notes || null,
          status: "new",
          travelerAccountId,
        })
        .returning({ id: rfqInquiries.id, createdAt: rfqInquiries.createdAt });

      if (!record?.id) {
        throw new Error("لم يتم إرجاع معرّف الطلب من قاعدة البيانات.");
      }

      void trackEvent("contact_submitted", {
        meta: `rfq_${destinationCountry}_${travelerCount}travelers`,
      });

      return NextResponse.json(
        {
          success: true,
          inquiryId: record.id,
          createdAt: record.createdAt,
          message:
            "تم استلام طلب عرض السعر بنجاح. سيقوم الوكلاء المعتمدون بمراجعة طلبك والتواصل معك مباشرة دون أي وساطة سعرية أو دفع إجباري مقدماً.",
        },
        { status: 201 },
      );
    } catch (dbError) {
      console.error("Database persistence failed for RFQ inquiry:", dbError);
      return NextResponse.json(
        {
          error:
            "تعذر حفظ طلب عرض السعر في قاعدة البيانات حالياً. يرجى المحاولة مرة أخرى.",
          canRetry: true,
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("RFQ inquiry route unexpected error:", error);
    return NextResponse.json(
      { error: "حدث خطأ غير متوقع أثناء معالجة الطلب. يرجى المحاولة لاحقاً." },
      { status: 500 },
    );
  }
}
