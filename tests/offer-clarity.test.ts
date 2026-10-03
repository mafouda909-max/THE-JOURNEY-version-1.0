import assert from "node:assert/strict";
import test from "node:test";
import { scoreOfferClarity } from "../src/lib/offer-clarity";

test("offer clarity rewards completeness rather than marketing intensity", () => {
  const weak = scoreOfferClarity({
    title: "عرض تركيا",
    description: "رحلة جميلة",
    originCity: "القاهرة",
    destinationCity: "إسطنبول",
    destinationCountry: "تركيا",
    priceAmount: 12000,
    priceType: "per_person",
    includes: "فندق",
  });

  const strong = scoreOfferClarity({
    title: "برنامج إسطنبول 7 أيام من القاهرة شامل الإقامة والإفطار",
    description:
      "برنامج واضح لمدة سبعة أيام يتضمن تفاصيل الإقامة والتنقلات والجولات الأساسية. السعر للفرد، ولا يشمل الطيران الدولي أو التأمين، ويحتاج المسافر إلى تأكيد المواعيد النهائية مع الوكيل قبل الدفع.",
    originCity: "القاهرة",
    destinationCity: "إسطنبول",
    destinationCountry: "تركيا",
    priceAmount: 12000,
    priceType: "per_person",
    durationDays: 7,
    includes: "إقامة 4 نجوم\nإفطار يومي\nانتقالات داخلية",
    excludes: "الطيران الدولي\nالتأمين",
  });

  assert.ok(strong.score > weak.score);
  assert.equal(strong.score, 100);
  assert.equal(strong.label, "واضح جدًا");
});

test("clarity score never claims conversion or verification", () => {
  const result = scoreOfferClarity({});
  assert.equal(result.score, 0);
  assert.equal(result.label, "يحتاج تفاصيل");
});
