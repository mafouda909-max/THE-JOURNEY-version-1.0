import { describe, expect, it } from "vitest";
import {
  mapContactError,
  validateContactMessage,
  validateTravelerCount,
} from "./errors";

describe("mapContactError", () => {
  it("maps ratified RPC errors to Arabic", () => {
    expect(mapContactError("offer_not_published")).toMatch(/عرض منشور/);
    expect(mapContactError("duplicate_active_request")).toMatch(/طلب تواصل نشط/);
    expect(mapContactError("not_authenticated")).toMatch(/تسجيل الدخول/);
    expect(mapContactError("message too short (min 10 chars)")).toMatch(/١٠ أحرف/);
    expect(mapContactError("response message required")).toMatch(/الرد مطلوب/);
    expect(mapContactError("invalid state: closed")).toMatch(/حالة الطلب الحالية/);
  });

  it("passes unknown messages through verbatim", () => {
    expect(mapContactError("db connection lost")).toBe("db connection lost");
  });
});

describe("validateContactMessage", () => {
  it("requires 10+ trimmed characters", () => {
    expect(validateContactMessage("قصير")).not.toBeNull();
    expect(validateContactMessage("   ")).not.toBeNull();
    expect(validateContactMessage(null)).not.toBeNull();
    expect(validateContactMessage("أرغب بحجز هذه الرحلة لعائلة مكونة من أربعة أفراد")).toBeNull();
  });

  it("counts trimmed length only", () => {
    expect(validateContactMessage("     أهلاً بالعالم الفسيح     ")).toBeNull();
    expect(validateContactMessage("  أهلاً  ")).not.toBeNull();
  });
});

describe("validateTravelerCount", () => {
  it("accepts integers ≥ 1", () => {
    expect(validateTravelerCount("1")).toBe(1);
    expect(validateTravelerCount("7")).toBe(7);
  });

  it("rejects zero, negatives, fractions and garbage", () => {
    expect(validateTravelerCount("0")).toBeNull();
    expect(validateTravelerCount("-2")).toBeNull();
    expect(validateTravelerCount("2.5")).toBeNull();
    expect(validateTravelerCount("abc")).toBeNull();
    expect(validateTravelerCount("")).toBeNull();
  });
});
