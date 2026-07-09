/**
 * Phase F Eval — 식이 신호 → 추천 (평가셋 v1)
 * 참조: D:\헬스픽\IP\integration\phase_f_diet_eval_v1.md
 * dietToScores 단위 + runUnifiedRecommendation 병합 회귀.
 */
import { describe, it, expect } from "vitest";
import { dietToScores, type DietDailyAvg, type DietContext } from "../diet_adapter";
import { runUnifiedRecommendation } from "../recommend";
import type { CategoryResult } from "../../checkup/engine";

// 미량영양소 매핑 로직 검증용 — 나트륨·당류 + 식이섬유 신호 모두 ON
const CTX: DietContext = { sex: "male", weightKg: 70, kcalTarget: 2000, enableMicroSignals: true, enableFiberSignal: true };
// 전부 OFF (Step1 게이트 상태)
const GATED: DietContext = { sex: "male", weightKg: 70, kcalTarget: 2000 };

/** 모든 항목 정상(신호 0) 기준 일평균 */
function normal(over: Partial<DietDailyAvg> = {}): DietDailyAvg {
  return { days: 7, kcal: 1950, protein_g: 70, sugar_g: 40, sodium_mg: 1800, fiber_g: 32, ...over };
}

describe("dietToScores (KDRIs 2020 확정 임계)", () => {
  it("E1 고나트륨 → 심혈관 +8", () => {
    const r = dietToScores(normal({ sodium_mg: 3200 }), CTX);
    expect(r.scores).toEqual({ 심혈관: 8 });
    expect(r.lowConfidence).toBe(false);
  });

  it("E2 저단백(70kg, 35g<0.7×70) → 근육관절 +8", () => {
    expect(dietToScores(normal({ protein_g: 35 }), CTX).scores).toEqual({ 근육관절: 8 });
  });

  it("E3 고당류(110g=22%>20%) → 혈당대사 +8", () => {
    expect(dietToScores(normal({ kcal: 2000, sugar_g: 110 }), CTX).scores).toEqual({ 혈당대사: 8 });
  });

  it("E3b 당류 18%(적정 내) → 혈당대사 없음", () => {
    expect(dietToScores(normal({ kcal: 2000, sugar_g: 90 }), CTX).scores).toEqual({});
  });

  it("E4 열량과잉(2600>2000×1.15) → 체중관리 +8", () => {
    expect(dietToScores(normal({ kcal: 2600 }), CTX).scores).toEqual({ 체중관리: 8 });
  });

  it("E5 저식이섬유(12<30 男) → 장건강 +8", () => {
    expect(dietToScores(normal({ fiber_g: 12 }), CTX).scores).toEqual({ 장건강: 8 });
  });

  it("E6 열량부족(1200<2000×0.7) → 피로 +6", () => {
    expect(dietToScores(normal({ kcal: 1200 }), CTX).scores).toEqual({ 피로: 6 });
  });

  it("E7 복합(고나트륨+고당류) → 심혈관+혈당대사", () => {
    const r = dietToScores(normal({ kcal: 2000, sodium_mg: 3000, sugar_g: 105 }), CTX);
    expect(r.scores).toEqual({ 심혈관: 8, 혈당대사: 8 });
  });

  it("E8 모두 정상 → scores 비어있음", () => {
    expect(dietToScores(normal(), CTX).scores).toEqual({});
  });

  it("E9 나트륨 2299(임계 미만) → 신호 없음", () => {
    expect(dietToScores(normal({ sodium_mg: 2299 }), CTX).scores).toEqual({});
  });

  it("E10 나트륨 2300(임계 포함) → 심혈관 +8", () => {
    expect(dietToScores(normal({ sodium_mg: 2300 }), CTX).scores).toEqual({ 심혈관: 8 });
  });

  it("E11 기록 1일 → lowConfidence, scores 0", () => {
    const r = dietToScores(normal({ days: 1, sodium_mg: 9999 }), CTX);
    expect(r.scores).toEqual({});
    expect(r.lowConfidence).toBe(true);
  });

  it("E12 기록 0일 → lowConfidence, scores 0", () => {
    const r = dietToScores(normal({ days: 0 }), CTX);
    expect(r.scores).toEqual({});
    expect(r.lowConfidence).toBe(true);
  });

  it("E13 어떤 카테고리도 상한(10) 초과 안 함", () => {
    const r = dietToScores(normal({ sodium_mg: 9999, sugar_g: 999, fiber_g: 0, kcal: 9999, protein_g: 0 }), CTX);
    for (const v of Object.values(r.scores)) expect(v).toBeLessThanOrEqual(10);
  });

  it("성별 분기: 女 섬유 25g는 정상(AI 20)", () => {
    expect(dietToScores(normal({ fiber_g: 25 }), { sex: "female", weightKg: 55, kcalTarget: 1800 }).scores).toEqual({});
  });

  it("체중/열량목표 없으면 단백·열량 신호 생략", () => {
    const r = dietToScores(normal({ protein_g: 5 }), { sex: "male" });
    expect(r.scores).toEqual({}); // 근육관절(체중無)·체중관리/피로(목표無) 생략. 당류 정상.
  });

  it("게이트 OFF(기본): 나트륨·당류·섬유 신호 전부 억제", () => {
    // DB 신뢰도 미확보 → 미량영양소 신호 OFF. 칼로리·단백질만.
    const r = dietToScores(normal({ sodium_mg: 3200, sugar_g: 200, fiber_g: 0 }), GATED);
    expect(r.scores).toEqual({});
  });

  it("게이트 OFF라도 단백질 신호는 가동", () => {
    expect(dietToScores(normal({ protein_g: 35, sodium_mg: 3200 }), GATED).scores).toEqual({ 근육관절: 8 });
  });

  it("Step4 가드: sodium_known=false → 심혈관 보류", () => {
    expect(dietToScores(normal({ sodium_mg: 3200, sodium_known: false }), CTX).scores).toEqual({});
  });

  it("Step4 가드: sugar_known=false → 혈당대사 보류", () => {
    expect(dietToScores(normal({ kcal: 2000, sugar_g: 110, sugar_known: false }), CTX).scores).toEqual({});
  });

  it("식이섬유 스위치 기본 OFF: 나트륨·당류만 재가동(섬유 미발화)", () => {
    const microOnly: DietContext = { sex: "male", weightKg: 70, kcalTarget: 2000, enableMicroSignals: true };
    expect(dietToScores(normal({ fiber_g: 5, sodium_mg: 3200 }), microOnly).scores).toEqual({ 심혈관: 8 });
  });
});

describe("runUnifiedRecommendation 병합 회귀", () => {
  const referralGlucose: CategoryResult = {
    biomarker_key: "공복혈당",
    level: "high",
    functional_needs: ["혈당조절"],
    force_medical_referral: true,
  } as unknown as CategoryResult;

  const watchChol: CategoryResult = {
    biomarker_key: "총콜레스테롤",
    level: "watch",
    functional_needs: ["콜레스테롤개선"],
    force_medical_referral: false,
  } as unknown as CategoryResult;

  it("E14 식이 혈당대사 + 검진 혈당 referral → 혈당대사 억제", () => {
    const res = runUnifiedRecommendation({
      checkupResults: [referralGlucose],
      dietSummary: { days: 7, kcal: 2000, protein_g: 70, sugar_g: 120, sodium_mg: 1800, fiber_g: 32 },
    });
    expect(res.scores["혈당대사"]).toBeUndefined(); // referral 억제
    expect(res.referralKeys).toContain("공복혈당");
  });

  it("E15 식이(나트륨)+검진(심혈관) 병합 합산 + 추천 (Step4 재가동)", () => {
    const res = runUnifiedRecommendation({
      checkupResults: [watchChol], // 심혈관 +8 (검진)
      dietSummary: { days: 7, kcal: 2000, protein_g: 70, sugar_g: 40, sodium_mg: 3200, fiber_g: 32 }, // 나트륨 → 심혈관 +8
    });
    expect(res.scores["심혈관"]).toBe(16); // 검진 8 + 식이 나트륨 8 (재가동)
    expect(res.hasSignal).toBe(true);
    expect(res.sources).toEqual({ survey: false, checkup: true, diet: true });
    expect(res.recommendations.length).toBeGreaterThan(0);
  });

  it("E15b 데이터 가드: 식이 sodium_known=false → 심혈관은 검진만(8)", () => {
    const res = runUnifiedRecommendation({
      checkupResults: [watchChol],
      dietSummary: { days: 7, kcal: 2000, protein_g: 70, sugar_g: 40, sodium_mg: 3200, fiber_g: 32, sodium_known: false },
    });
    expect(res.scores["심혈관"]).toBe(8); // 식이 나트륨 보류, 검진만
  });

  it("식이만 입력해도 추천 가능 (나트륨 임계 미만, 섬유 OFF)", () => {
    const res = runUnifiedRecommendation({
      dietSummary: { days: 7, kcal: 2000, protein_g: 30, sugar_g: 40, sodium_mg: 1800, fiber_g: 10 },
    });
    expect(res.hasSignal).toBe(true); // 근육관절(단백질). 나트륨 1800<2300, 장건강(섬유)은 OFF
    expect(res.scores["장건강"]).toBeUndefined();
    expect(res.sources.diet).toBe(true);
  });

  it("식이 기록 부족 → dietLowConfidence=true, 식이 신호 0", () => {
    const res = runUnifiedRecommendation({
      dietSummary: { days: 1, kcal: 2000, protein_g: 30, sugar_g: 40, sodium_mg: 9999, fiber_g: 5 },
    });
    expect(res.dietLowConfidence).toBe(true);
    expect(res.scores["심혈관"]).toBeUndefined();
  });
});
