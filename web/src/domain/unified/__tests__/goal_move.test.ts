/**
 * Phase G 평가셋 — 목표를 식사 기록으로 이전 + /survey·/recommend 단일 엔진화
 * 근거: IP/integration/phase_g_goal_move_eval_v1.md (G01~G15)
 * 통과 기준: 15/15. 엔진(scorer·recommender·unified) 수치 불변.
 */
import { describe, it, expect } from "vitest";
import type { SurveyAnswers } from "../../../types";
import type { CategoryResult } from "../../checkup/engine";
import { runUnifiedRecommendation } from "../recommend";
import { composeUnifiedInput, planInputLoads, type LoadedInputs } from "../compose";
import { runRecommendation, calculateProteinTarget } from "../../../engine";
import {
  GOAL_OPTIONS,
  resolveEffectiveGoals,
  validateGoalsForSave,
  isGoalBlockedByBmi,
  bmiFromAnswers,
  shouldSkipGoalStep,
  surveySteps,
  withGoals,
} from "../../goals/goals";
import { personalizeProduct } from "../../meokseon/personalize";

const SURVEY: SurveyAnswers = {
  성별: "male",
  나이: 40,
  신장: 175,
  체중: 70,
  체중변화: "변화없음",
  증상: ["chronic_fatigue", "cant_fall_asleep"],
  목표: [],
  수면: "보통",
  현재복용영양제: [],
  기저질환: [],
  가족력: [],
};

function loaded(over: Partial<LoadedInputs> = {}): LoadedInputs {
  return { latestSurvey: null, checkupResults: null, dietSummary: null, profile: { sex: "M", age: 40 }, goals: null, ...over };
}
const run = (fresh: SurveyAnswers | null, l: LoadedInputs) =>
  runUnifiedRecommendation(composeUnifiedInput({ freshSurvey: fresh, loaded: l }));
const recIds = (r: { recommendations: { id: string }[] }) => r.recommendations.map((x) => x.id);

describe("Phase G · 목표 이전 평가셋", () => {
  it("G01 로그인·설문(목표 단계 없음)·user_goals=[수면개선] → 수면 +2 (현행 goalBoost 동일값)", () => {
    const base = run(SURVEY, loaded({ goals: [] }));
    const withG = run(SURVEY, loaded({ goals: ["수면개선"] }));
    expect((withG.scores["수면"] ?? 0) - (base.scores["수면"] ?? 0)).toBe(2);
  });

  it("G02 user_goals 행 없음 · 설문 goals=[간건강] → 폴백 + 시드 1회 · 간건강 +3", () => {
    const r = resolveEffectiveGoals(null, ["간건강"]);
    expect(r).toEqual({ goals: ["간건강"], source: "survey_fallback", needsSeed: true });
    const base = run(SURVEY, loaded({ goals: [] }));
    const withG = run(SURVEY, loaded({ goals: r.goals }));
    expect((withG.scores["간건강"] ?? 0) - (base.scores["간건강"] ?? 0)).toBe(3);
    // 시드 후(행 생김) 다시 읽으면 시드 불필요
    expect(resolveEffectiveGoals(r.goals, ["간건강"]).needsSeed).toBe(false);
  });

  it("G03 목표 전무 → 부스트 0, 추천 정상", () => {
    const r = resolveEffectiveGoals(null, []);
    expect(r).toEqual({ goals: [], source: "none", needsSeed: false });
    const res = run(SURVEY, loaded({ goals: r.goals }));
    expect(res.hasSignal).toBe(true);
    expect(res.recommendations.length).toBeGreaterThan(0);
    expect(res.scores).toEqual(runRecommendation(SURVEY).scores);
  });

  it("G04 근육증가 · 70kg → 단백질 구간 = calculateProteinTarget(70,[근육증가]) 완전 동일", () => {
    const res = run(SURVEY, loaded({ goals: ["근육증가"] }));
    const [mn, mx] = calculateProteinTarget(70, ["근육증가"]);
    expect(res.nutrition_info.protein_min).toBe(mn);
    expect(res.nutrition_info.protein_max).toBe(mx);
  });

  it("G05 설문 + 식사 7일(단백질 부족) → 식이 신호 병합 · sources.diet", () => {
    const diet = { days: 7, kcal: 2000, protein_g: 30, sugar_g: 40, sodium_mg: 1800, fiber_g: 10 };
    const noDiet = run(SURVEY, loaded({ goals: [] }));
    const res = run(SURVEY, loaded({ goals: [], dietSummary: diet }));
    expect(res.sources.diet).toBe(true);
    expect(res.dietLowConfidence).toBe(false);
    expect(res.scores).not.toEqual(noDiet.scores);
  });

  it("G06 식사 1일(기록 부족) → 식이 신호 0 · dietLowConfidence", () => {
    const diet = { days: 1, kcal: 2000, protein_g: 30, sugar_g: 40, sodium_mg: 9999, fiber_g: 5 };
    const noDiet = run(SURVEY, loaded({ goals: [] }));
    const res = run(SURVEY, loaded({ goals: [], dietSummary: diet }));
    expect(res.dietLowConfidence).toBe(true);
    expect(res.scores).toEqual(noDiet.scores);
  });

  it("G07 검진 중증(force_medical_referral) → 해당 카테고리 억제 · referral 경고", () => {
    const checkup: CategoryResult[] = [
      { biomarker_key: "HbA1c", value: 0, level: "high", label_ko: null, functional_needs: ["혈당조절"], tone: null, force_medical_referral: true, matched_range_id: null },
    ];
    const res = run(SURVEY, loaded({ goals: ["혈당관리"], checkupResults: checkup }));
    expect(res.scores["혈당대사"]).toBeUndefined();
    expect(res.referralKeys).toContain("HbA1c");
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  it("G08 비로그인 설문(목표 단계 유지) → 설문 단독 엔진 · 단계 10개 (회귀 0)", () => {
    expect(shouldSkipGoalStep({ loggedIn: false, mealEnabled: true })).toBe(false);
    expect(surveySteps(false)).toHaveLength(10);
    expect(surveySteps(false)).toContain("goals");
    const a = { ...SURVEY, 목표: ["피로회복"] };
    // 설문 단독 입력이면 통합 엔진과 현행 엔진 추천이 같다 (엔진 재사용 확인)
    expect(recIds(run(a, loaded()))).toEqual(recIds(runRecommendation(a)));
    // 로그인 + 식사 ON 이면 9단계
    expect(shouldSkipGoalStep({ loggedIn: true, mealEnabled: true })).toBe(true);
    expect(surveySteps(true)).toHaveLength(9);
  });

  it("G09 MEAL_ENABLED=false → 식이·user_goals 미로드, 설문 목표 그대로 · 목표 단계 유지", () => {
    const p = planInputLoads({ mealEnabled: false, checkupEnabled: true });
    expect(p).toEqual({ diet: false, checkup: true, userGoals: false });
    expect(shouldSkipGoalStep({ loggedIn: true, mealEnabled: false })).toBe(false);
    const a = { ...SURVEY, 목표: ["눈건강"] };
    const input = composeUnifiedInput({ freshSurvey: a, loaded: loaded({ goals: null }) });
    expect(input.surveyAnswers?.목표).toEqual(["눈건강"]);
  });

  it("G10 CHECKUP_ENABLED=false → 검진 미로드", () => {
    expect(planInputLoads({ mealEnabled: true, checkupEnabled: false }).checkup).toBe(false);
  });

  it("G11 BMI 17.5 → 체중관리 칩 비활성·저장 제외, 다른 목표는 저장", () => {
    const bmi = bmiFromAnswers({ 신장: 170, 체중: 50.6 })!;
    expect(bmi).toBeCloseTo(17.5, 1);
    expect(isGoalBlockedByBmi("체중관리", bmi)).toBe(true);
    expect(isGoalBlockedByBmi("근육증가", bmi)).toBe(false);
    expect(validateGoalsForSave(["체중관리", "수면개선"], bmi)).toEqual({ goals: ["수면개선"], rejected: ["체중관리"] });
    // BMI 미상 → 차단 근거 없음
    expect(isGoalBlockedByBmi("체중관리", null)).toBe(false);
    expect(isGoalBlockedByBmi("체중관리", 18.5)).toBe(false);
  });

  it("G12 목표 수정 직후 /recommend → 새 목표 반영", () => {
    const before = run(null, loaded({ latestSurvey: SURVEY, goals: ["피로회복"] }));
    const after = run(null, loaded({ latestSurvey: SURVEY, goals: ["눈건강"] }));
    expect((after.scores["눈건강"] ?? 0) - (before.scores["눈건강"] ?? 0)).toBe(2);
    expect((before.scores["피로"] ?? 0) - (after.scores["피로"] ?? 0)).toBe(2);
  });

  it("G13 먹선 스캔 · user_goals=[혈당관리] → 당류·탄수 관심 영양소 (personalize 규칙 그대로)", () => {
    const answers = withGoals({ ...SURVEY, 목표: [] }, ["혈당관리"]);
    const r = personalizeProduct(null, null, answers);
    expect(r.applicable).toBe(true);
    const keys = r.items.map((i) => i.key);
    expect(keys).toContain("total_sugars");
    expect(keys).toContain("total_carbs");
  });

  it("G14 /survey(방금 답변) vs /recommend(저장된 같은 답변) → 추천·점수 동일", () => {
    const common = { goals: ["수면개선", "간건강"], dietSummary: { days: 7, kcal: 2000, protein_g: 30, sugar_g: 40, sodium_mg: 1800, fiber_g: 10 } };
    const viaSurvey = run(SURVEY, loaded(common));
    const viaRecommend = run(null, loaded({ ...common, latestSurvey: SURVEY }));
    expect(viaSurvey.scores).toEqual(viaRecommend.scores);
    expect(recIds(viaSurvey)).toEqual(recIds(viaRecommend));
    expect(viaSurvey.nutrition_info).toEqual(viaRecommend.nutrition_info);
  });

  it("G15 기존 설문 goals=[피로회복,눈건강] → 이전 후 동일 목표 · 추천 순위 변화 0", () => {
    const old = { ...SURVEY, 목표: ["피로회복", "눈건강"] };
    const r = resolveEffectiveGoals(null, old.목표);
    expect(r.goals).toEqual(["피로회복", "눈건강"]);
    const before = runRecommendation(old);
    const after = run(null, loaded({ latestSurvey: { ...old, 목표: [] }, goals: r.goals }));
    expect(recIds(after)).toEqual(recIds(before));
    expect(after.scores).toEqual(before.scores);
  });

  it("보조: GOAL_OPTIONS 13종 = scorer goalBoostMap 키 (글자 일치)", () => {
    expect(GOAL_OPTIONS).toHaveLength(13);
    for (const g of GOAL_OPTIONS) {
      const base = runRecommendation({ ...SURVEY, 목표: [] }).scores;
      const withG = runRecommendation({ ...SURVEY, 목표: [g.id] }).scores;
      expect(withG, g.id).not.toEqual(base);
    }
  });
});
