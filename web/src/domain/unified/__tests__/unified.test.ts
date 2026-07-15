import { describe, it, expect } from "vitest";
import type { CategoryResult } from "../../checkup/engine";
import type { SurveyAnswers } from "../../../types";
import { checkupResultsToScores } from "../adapter";
import { runUnifiedRecommendation } from "../recommend";

/** 테스트용 CategoryResult 헬퍼 */
function cr(
  biomarker_key: string,
  level: string,
  functional_needs: string[],
  force_medical_referral = false,
): CategoryResult {
  return {
    biomarker_key,
    value: 0,
    level,
    label_ko: null,
    functional_needs,
    tone: null,
    force_medical_referral,
    matched_range_id: null,
  };
}

const RICH_SURVEY: SurveyAnswers = {
  성별: "male",
  나이: 42,
  신장: 175,
  체중: 78,
  체중변화: "변화없음",
  증상: ["chronic_fatigue", "afternoon_slump", "brain_fog"],
  목표: ["피로회복"],
  수면: "보통",
  음주: "주3-4회",
  현재복용영양제: [],
  기저질환: [],
  가족력: [],
};

describe("checkupResultsToScores (어댑터)", () => {
  it("1. HbA1c watch → 혈당대사 점수, referral 없음", () => {
    const r = checkupResultsToScores([cr("HbA1c", "watch", ["혈당조절"])]);
    expect(r.scores["혈당대사"]).toBe(8);
    expect(r.referralKeys).toHaveLength(0);
  });

  it("2. HbA1c high(referral) → 점수 억제 + referral 표시", () => {
    const r = checkupResultsToScores([cr("HbA1c", "high", ["혈당조절"], true)]);
    expect(r.scores["혈당대사"]).toBeUndefined();
    expect(r.referralCategories).toContain("혈당대사");
    expect(r.referralKeys).toContain("HbA1c");
  });

  it("3. AST+ALT watch → 간건강 점수 상한(10)", () => {
    const r = checkupResultsToScores([
      cr("AST", "watch", ["간건강"]),
      cr("ALT", "watch", ["간건강"]),
    ]);
    expect(r.scores["간건강"]).toBe(10); // 8+8=16 → cap 10
  });

  it("4. 비타민D low → 면역력 점수", () => {
    const r = checkupResultsToScores([cr("vitamin_D", "low", ["비타민D보충"])]);
    expect(r.scores["면역력"]).toBe(8);
  });

  it("9. LDL watch → 심혈관 점수", () => {
    const r = checkupResultsToScores([
      cr("LDL", "watch", ["콜레스테롤개선", "혈중중성지방개선"]),
    ]);
    expect(r.scores["심혈관"]).toBe(10); // 두 need 모두 심혈관 → 16 → cap 10
  });

  it("정상치만 있으면 점수 없음", () => {
    const r = checkupResultsToScores([cr("HbA1c", "normal", [])]);
    expect(Object.keys(r.scores)).toHaveLength(0);
  });
});

describe("runUnifiedRecommendation (병합 추천)", () => {
  it("5. 검진 정상만 → 신호 없음, 추천 없음", () => {
    const res = runUnifiedRecommendation({ checkupResults: [cr("HbA1c", "normal", [])] });
    expect(res.hasSignal).toBe(false);
    expect(res.recommendations).toHaveLength(0);
  });

  it("6. 설문만 → 추천 도출(회귀 없음)", () => {
    const res = runUnifiedRecommendation({ surveyAnswers: RICH_SURVEY });
    expect(res.hasSignal).toBe(true);
    expect(res.recommendations.length).toBeGreaterThan(0);
    expect(res.sources).toEqual({ survey: true, checkup: false, diet: false });
  });

  it("3. 검진만(간 watch) → 간 영양제 추천(밀크씨슬)", () => {
    const res = runUnifiedRecommendation({
      checkupResults: [cr("AST", "watch", ["간건강"]), cr("ALT", "watch", ["간건강"])],
    });
    expect(res.hasSignal).toBe(true);
    expect(res.recommendations.length).toBeGreaterThan(0);
    expect(res.recommendations.some((s) => s.id === "milk_thistle")).toBe(true);
  });

  it("4. 검진만(비타민D 부족) → 비타민D3 추천", () => {
    const res = runUnifiedRecommendation({
      checkupResults: [cr("vitamin_D", "low", ["비타민D보충"])],
    });
    expect(res.recommendations.some((s) => s.id === "vitamin_d")).toBe(true);
  });

  it("9. 검진만(LDL 경계) → 심혈관 영양제 추천(오메가3)", () => {
    const res = runUnifiedRecommendation({
      checkupResults: [cr("LDL", "watch", ["콜레스테롤개선", "혈중중성지방개선"])],
    });
    expect(res.recommendations.length).toBeGreaterThan(0);
    expect(res.recommendations.some((s) => s.id === "omega3")).toBe(true);
  });

  it("2/10. 검진 중증(referral) → referral 배너 + 해당 카테고리 푸시 억제", () => {
    const res = runUnifiedRecommendation({
      checkupResults: [cr("HbA1c", "high", ["혈당조절"], true)],
    });
    expect(res.referralKeys).toContain("HbA1c");
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(res.scores["혈당대사"]).toBeUndefined();
  });

  it("7. 검진(간 watch) + 설문(음주) → 간건강 신호 병합 강화", () => {
    const surveyOnly = runUnifiedRecommendation({ surveyAnswers: RICH_SURVEY });
    const merged = runUnifiedRecommendation({
      surveyAnswers: RICH_SURVEY,
      checkupResults: [cr("AST", "watch", ["간건강"]), cr("GGT", "watch", ["간건강"])],
    });
    expect((merged.scores["간건강"] || 0)).toBeGreaterThan(surveyOnly.scores["간건강"] || 0);
    expect(merged.sources).toEqual({ survey: true, checkup: true, diet: false });
  });

  it("8. 둘 다 없음 → 신호 없음, 추천 없음", () => {
    const res = runUnifiedRecommendation({});
    expect(res.hasSignal).toBe(false);
    expect(res.recommendations).toHaveLength(0);
  });
});
