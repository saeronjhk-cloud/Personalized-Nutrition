/**
 * 통합 추천 입력 조립 — 순수 (Phase G)
 *
 * 두 추천 경로를 «한 엔진»으로 모은다 (웹앱트랙 인수인계 §1-2 · 원칙5 엔진 재사용).
 *   A. /survey 제출(로그인)  : 방금 답한 설문 + 저장된 검진·식이·목표
 *   B. /recommend            : 최신 저장 설문 + 저장된 검진·식이·목표
 * 두 경로 모두 composeUnifiedInput → runUnifiedRecommendation. 엔진은 수정하지 않는다.
 */
import type { SurveyAnswers } from "../../types";
import type { CategoryResult } from "../checkup/engine";
import type { DietDailyAvg } from "./diet_adapter";
import type { UnifiedInput } from "./recommend";
import { withGoals } from "../goals/goals";

export interface LoadedInputs {
  latestSurvey: SurveyAnswers | null;
  checkupResults: CategoryResult[] | null;
  dietSummary: DietDailyAvg | null;
  profile: { sex?: string | null; age?: number | null } | null;
  /**
   * 목표 출처(user_goals → 설문 폴백)에서 확정된 유효 목표.
   * null = 목표를 외부에서 주입하지 않음(식사 기록 기능 OFF — 설문 안의 목표를 그대로 쓴다).
   */
  goals: string[] | null;
}

export function composeUnifiedInput(opts: {
  freshSurvey?: SurveyAnswers | null;
  loaded: LoadedInputs;
}): UnifiedInput {
  const { loaded } = opts;
  let survey = opts.freshSurvey ?? loaded.latestSurvey ?? null;
  if (survey && loaded.goals !== null) survey = withGoals(survey, loaded.goals);
  return {
    surveyAnswers: survey,
    checkupResults: loaded.checkupResults,
    dietSummary: loaded.dietSummary,
    profile: loaded.profile,
  };
}

/** 기능 플래그 → 무엇을 불러오나 (G09·G10). */
export function planInputLoads(flags: { mealEnabled: boolean; checkupEnabled: boolean }) {
  return {
    diet: flags.mealEnabled,
    checkup: flags.checkupEnabled,
    /** 목표는 식사 기록 화면에서 관리 → 식사 기능이 켜져 있을 때만 user_goals 를 출처로 쓴다. */
    userGoals: flags.mealEnabled,
  };
}
