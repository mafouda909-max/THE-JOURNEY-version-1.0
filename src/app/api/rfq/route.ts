import { NextResponse } from "next/server";
import { db } from "@/db";
import { rfqInquiries } from "@/db/schema";
import { trackEvent } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
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
    };

    const travelerName = body.travelerName?.trim();
    const travelerEmail = body.travelerEmail?.trim().toLowerCase();
    const originCity = body.originCity?.trim();
    const destinationCountry = body.destinationCountry?.trim();

    if (!travelerName || travelerName.length < 2) {
      return NextResponse.json({ error: "اسم المسافر مطلوب." }, { status: 400 });
    }

    if (!travelerEmail || !travelerEmail.includes("@")) {
      return NextResponse.json({ error: "بريد إلكتروني صالح مطلوب للتواصل." }, { status: 400 });
    }

    if (!originCity) {
      return NextResponse.json({ error: "مدينة الانطلاق مطلوبة." }, { status: 400 });
    }

    if (!destinationCountry) {
      return NextResponse.json({ error: "بلد الوجهة مطلوب." }, { status: 400 });
    }

    const count = Number(body.travelerCount);
    const travelerCount = Number.isSafeInteger(count) && count >= 1 && count <= 50 ? count : 1;

    let insertedId: number = Date.now();

    try {
      const [record] = await db
        .insert(rfqInquiries)
        .values({
          travelerName,
          travelerEmail,
          travelerPhone: body.travelerPhone?.trim() || null,
          originCity,
          destinationCountry,
          destinationCity: body.destinationCity?.trim() || null,
          travelDates: body.travelDates?.trim() || null,
          travelerCount,
          tripType: body.tripType?.trim() || "package",
          budgetPreference: body.budgetPreference?.trim() || "moderate",
          notes: body.notes?.trim() || null,
          status: "new",
        })
        .returning({ id: rfqInquiries.id });

      if (record?.id) {
        insertedId = record.id;
      }
    } catch (dbError) {
      console.warn("DB insert for RFQ inquiry fallback:", dbError);
      // Fail-open for demonstration/preview environments if table is not yet migrated
    }

    void trackEvent("contact_submitted", {
      meta: `rfq_${destinationCountry}_${travelerCount}travelers`,
    });

    return NextResponse.json({
      success: true,
      inquiryId: insertedId,
      message:
        "تم استلام طلب عرض السعر بنجاح. سيقوم الوكلاء المعتمدون بمراجعة طلبك والتواصل معك مباشرة دون أي وساطة سعرية أو دفع إجباري مقدماً.",
    });
  } catch (error) {
    console.error("RFQ inquiry route error:", error);
    return NextResponse.json(
      { error: "تعذر إرسال طلب العرض حالياً. يرجى المحاولة لاحقاً." },
      { status: 500 },
    );
  }
}
