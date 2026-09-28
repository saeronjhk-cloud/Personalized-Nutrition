/**
 * 통합 추천 입력 로더 (IO) — Recommend.tsx 에서 추출 (Phase G)
 * /recommend 와 /survey(로그인) 두 경로가 «같은» 로더를 쓴다 → 결과 동일성(G14).
 */
import {
  fetchMyProfile,
  fetchCheckupRecords,
  fetchCheckupRecordDetail,
  fetchRanges,
} from "./checkup_api";
import { fetchSurveyResponses, fetchSurveyResponseDetail } from "./survey_api";
import { CHECKUP_ENABLED, MEAL_ENABLED } from "./flags";
import { loadRecentDietSummary } from "./dietSummary";
import { loadEffectiveGoals } from "./userGoals";
import { runEngine, type Range, type CategoryResult, type BiomarkerInput } from "../domain/checkup/engine";
import { planInputLoads, type LoadedInputs } from "../domain/unified/compose";
import type { DietDailyAvg } from "../domain/unified/diet_adapter";
import type { SurveyAnswers } from "../types";

export type LoadResult =
  | { isLoggedIn: false }
  | { isLoggedIn: true; userId: string; inputs: LoadedInputs; hasSurvey: boolean };

export async function loadUnifiedInputs(opts: { skipLatestSurvey?: boolean } = {}): Promise<LoadResult> {
  const profile = await fetchMyProfile();
  if (!profile.isLoggedIn || !profile.userId) return { isLoggedIn: false };
  const userId = profile.userId;
  const plan = planInputLoads({ mealEnabled: MEAL_ENABLED, checkupEnabled: CHECKUP_ENABLED });

  const sex = profile.profile?.sex === "F" ? "F" : "M";
  const age = profile.profile?.birth_year ? new Date().getFullYear() - profile.profile.birth_year : null;

  // 최신 검진 → CategoryResult[] (CHECKUP_ENABLED 게이트 — G10)
  const loadCheckup = async (): Promise<CategoryResult[] | null> => {
    if (!plan.checkup) return null;
    const recs = await fetchCheckupRecords(userId);
    if (recs.records.length === 0) return null;
    const [detail, rangeRes] = await Promise.all([
      fetchCheckupRecordDetail(recs.records[0].id, userId),
      fetchRanges(sex),
    ]);
    if (!detail.detail || rangeRes.error) return null;
    const input: BiomarkerInput = {};
    for (const [key, v] of Object.entries(detail.detail.values)) input[key] = v.value;
    return runEngine(input, rangeRes.ranges as Range[]);
  };

  // 최신 설문 → answers
  const loadSurvey = async (): Promise<{ answers: SurveyAnswers | null; exists: boolean }> => {
    const surveys = await fetchSurveyResponses(userId);
    if (surveys.responses.length === 0) return { answers: null, exists: false };
    if (opts.skipLatestSurvey) return { answers: null, exists: true };
    const d = await fetchSurveyResponseDetail(surveys.responses[0].id, userId);
    return { answers: d.detail?.answers ?? null, exists: true };
  };

  // 식이 (MEAL_ENABLED 게이트 — G09)
  const loadDiet = async (): Promise<DietDailyAvg | null> => (plan.diet ? loadRecentDietSummary(7) : null);

  // 목표 (식사 기록이 켜져 있을 때만 user_goals 출처)
  const loadGoals = async (): Promise<string[] | null> =>
    plan.userGoals ? (await loadEffectiveGoals(userId)).goals : null;

  const [checkupResults, survey, dietSummary, goals] = await Promise.all([
    loadCheckup(),
    loadSurvey(),
    loadDiet(),
    loadGoals(),
  ]);

  return {
    isLoggedIn: true,
    userId,
    hasSurvey: survey.exists,
    inputs: { latestSurvey: survey.answers, checkupResults, dietSummary, profile: { sex, age }, goals },
  };
}
