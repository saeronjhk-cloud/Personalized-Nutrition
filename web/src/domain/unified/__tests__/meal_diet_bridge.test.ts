import { describe, it, expect } from "vitest";
import { mealLogRowToDietRecord, mealLogRowsToDietSummary, type MealLogRow, type MealSummaryLike } from "../meal_diet_bridge";
import { dietToScores, type DietContext } from "../diet_adapter";
import { runUnifiedRecommendation } from "../recommend";

const BASE = "2026-07-10T12:00:00.000Z";
function at(daysAgo: number): string {
  const d = new Date(BASE);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
}
function row(daysAgo: number, s: Partial<MealSummaryLike>, adj?: Partial<MealSummaryLike>): MealLogRow {
  return { eaten_at: at(daysAgo), summary: s as MealSummaryLike, adjusted_summary: adj ? (adj as MealSummaryLike) : null };
}
// 보수적 v1 컨텍스트: 체중 70kg, TDEE 2000, 미세신호 스위치 ON(단 데이터 가드로 실제 보류됨)
const CTX: DietContext = { sex: "male", weightKg: 70, kcalTarget: 2000, enableMicroSignals: true };

describe("bridge mapping — mealLogRowToDietRecord", () => {
  it("1. adjusted_summary(잔반 보정 실섭취) 우선 사용", () => {
    const r = mealLogRowToDietRecord(row(0, { total_calories_kcal: 3000, total_protein_g: 80 }, { total_calories_kcal: 1000, total_protein_g: 40 }));
    expect(r.kcal).toBe(1000);
    expect(r.protein_g).toBe(40);
  });
  it("2. adjusted 없으면 summary 사용", () => {
    const r = mealLogRowToDietRecord(row(0, { total_calories_kcal: 2000, total_protein_g: 70 }));
    expect(r.kcal).toBe(2000);
    expect(r.protein_g).toBe(70);
  });
  it("3. 누락 필드 → 0, 미세영양 known 항상 false(보수적)", () => {
    const r = mealLogRowToDietRecord({ eaten_at: at(0) });
    expect(r.kcal).toBe(0);
    expect(r.sodium_known).toBe(false);
    expect(r.sugar_known).toBe(false);
    expect(r.fiber_known).toBe(false);
  });
});

describe("aggregate — mealLogRowsToDietSummary", () => {
  it("4. 빈 배열 → days 0", () => {
    expect(mealLogRowsToDietSummary([]).days).toBe(0);
  });
  it("5. 같은 날 2끼 → days 1, 일평균=합", () => {
    const a = mealLogRowsToDietSummary([
      row(0, { total_calories_kcal: 700, total_protein_g: 20 }),
      row(0, { total_calories_kcal: 800, total_protein_g: 25 }),
    ]);
    expect(a.days).toBe(1);
    expect(a.kcal).toBe(1500);
    expect(a.protein_g).toBe(45);
  });
  it("6. 이틀 각 1끼 → days 2, 일평균=합/2", () => {
    const a = mealLogRowsToDietSummary([
      row(0, { total_calories_kcal: 2000, total_protein_g: 60 }),
      row(1, { total_calories_kcal: 1000, total_protein_g: 40 }),
    ]);
    expect(a.days).toBe(2);
    expect(a.kcal).toBe(1500);
    expect(a.protein_g).toBe(50);
  });
  it("7. 7일 창 밖(8일 전) 기록 제외", () => {
    const a = mealLogRowsToDietSummary([
      row(0, { total_calories_kcal: 2000, total_protein_g: 60 }),
      row(1, { total_calories_kcal: 2000, total_protein_g: 60 }),
      row(8, { total_calories_kcal: 9000, total_protein_g: 300 }),
    ]);
    expect(a.days).toBe(2);
    expect(a.kcal).toBe(2000);
  });
  it("8. 브리지는 미세영양 known=false 전파(집계 결과도 false)", () => {
    const a = mealLogRowsToDietSummary([
      row(0, { total_sodium_mg: 5000 }),
      row(1, { total_sodium_mg: 5000 }),
    ]);
    expect(a.sodium_known).toBe(false);
    expect(a.sugar_known).toBe(false);
  });
});

describe("signal — dietToScores (보수적 v1)", () => {
  it("9. 저단백 → 근육관절 발화", () => {
    const a = mealLogRowsToDietSummary([
      row(0, { total_calories_kcal: 2000, total_protein_g: 30 }),
      row(1, { total_calories_kcal: 2000, total_protein_g: 30 }),
    ]);
    const r = dietToScores(a, CTX);
    expect(r.scores["근육관절"]).toBe(8);
    expect(r.lowConfidence).toBe(false);
  });
  it("10. 충분 단백질 → 근육관절 없음", () => {
    const a = mealLogRowsToDietSummary([
      row(0, { total_calories_kcal: 2000, total_protein_g: 80 }),
      row(1, { total_calories_kcal: 2000, total_protein_g: 80 }),
    ]);
    expect(dietToScores(a, CTX).scores["근육관절"]).toBeUndefined();
  });
  it("11. 열량 과잉 → 체중관리 발화", () => {
    const a = mealLogRowsToDietSummary([
      row(0, { total_calories_kcal: 3000, total_protein_g: 80 }),
      row(1, { total_calories_kcal: 3000, total_protein_g: 80 }),
    ]);
    expect(dietToScores(a, CTX).scores["체중관리"]).toBe(8);
  });
  it("12. 열량 부족 → 피로 발화(약한 신호 6)", () => {
    const a = mealLogRowsToDietSummary([
      row(0, { total_calories_kcal: 1000, total_protein_g: 80 }),
      row(1, { total_calories_kcal: 1000, total_protein_g: 80 }),
    ]);
    expect(dietToScores(a, CTX).scores["피로"]).toBe(6);
  });
  it("13. [핵심 안전] 고나트륨이라도 known=false → 심혈관 신호 없음", () => {
    const a = mealLogRowsToDietSummary([
      row(0, { total_calories_kcal: 2000, total_protein_g: 80, total_sodium_mg: 5000 }),
      row(1, { total_calories_kcal: 2000, total_protein_g: 80, total_sodium_mg: 5000 }),
    ]);
    expect(dietToScores(a, CTX).scores["심혈관"]).toBeUndefined();
  });
  it("14. [핵심 안전] 고당류라도 known=false → 혈당대사 신호 없음", () => {
    const a = mealLogRowsToDietSummary([
      row(0, { total_calories_kcal: 2000, total_protein_g: 80, total_sugar_g: 200 }),
      row(1, { total_calories_kcal: 2000, total_protein_g: 80, total_sugar_g: 200 }),
    ]);
    expect(dietToScores(a, CTX).scores["혈당대사"]).toBeUndefined();
  });
  it("15. adjusted 우선이 신호까지 반영: 원본 과잉+실섭취 부족 → 피로(체중관리 아님)", () => {
    const a = mealLogRowsToDietSummary([
      row(0, { total_calories_kcal: 3000, total_protein_g: 80 }, { total_calories_kcal: 1000, total_protein_g: 80 }),
      row(1, { total_calories_kcal: 3000, total_protein_g: 80 }, { total_calories_kcal: 1000, total_protein_g: 80 }),
    ]);
    const r = dietToScores(a, CTX);
    expect(r.scores["피로"]).toBe(6);
    expect(r.scores["체중관리"]).toBeUndefined();
  });
  it("16. 기록 1일(<2일) → lowConfidence, 신호 없음(과추천 방지)", () => {
    const a = mealLogRowsToDietSummary([
      row(0, { total_calories_kcal: 3000, total_protein_g: 10 }),
      row(0, { total_calories_kcal: 3000, total_protein_g: 10 }),
    ]);
    const r = dietToScores(a, CTX);
    expect(r.lowConfidence).toBe(true);
    expect(Object.keys(r.scores)).toHaveLength(0);
  });
});

describe("integration — runUnifiedRecommendation(dietSummary)", () => {
  it("17. 식이만으로도 추천: 저단백 2일 → sources.diet true, 근육관절 반영", () => {
    const diet = mealLogRowsToDietSummary([
      row(0, { total_calories_kcal: 1800, total_protein_g: 20 }),
      row(1, { total_calories_kcal: 1800, total_protein_g: 20 }),
    ]);
    const u = runUnifiedRecommendation({ dietSummary: diet, profile: { sex: "M", age: 30 } });
    expect(u.sources.diet).toBe(true);
    expect(u.dietLowConfidence).toBe(false);
    expect(u.hasSignal).toBe(true);
    expect(u.scores["근육관절"]).toBeGreaterThan(0);
  });
  it("18. 기록 부족(1일) → dietLowConfidence true, 식이 신호 기여 없음", () => {
    const diet = mealLogRowsToDietSummary([
      row(0, { total_calories_kcal: 3000, total_protein_g: 10 }),
      row(0, { total_calories_kcal: 3000, total_protein_g: 10 }),
    ]);
    const u = runUnifiedRecommendation({ dietSummary: diet, profile: { sex: "M", age: 30 } });
    expect(u.dietLowConfidence).toBe(true);
    expect(u.sources.diet).toBe(true);
    expect(u.hasSignal).toBe(false);
  });
});
