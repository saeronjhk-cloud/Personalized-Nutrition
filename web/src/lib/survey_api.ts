import { supabase } from "./supabase";
import type { SurveyAnswers } from "../types";

// =============================================================================
// 내 설문 기록 관리 (Soft delete) — 검진(checkup_api)과 동일 패턴
// 참조: D:\헬스픽\IP\prompts\supabase_anti_patterns.md (규칙 1)
//   .update()/.delete() 후 .select() 체이닝 + 반환 행 수로 성공 판정.
// 전제: survey_responses.deleted_at(timestamptz, nullable) + answers(jsonb) 컬럼
//       (phase_c10_survey_soft_delete_v1.sql). RLS는 기존 select/insert/update 정책 활용.
// =============================================================================

export interface SurveyResponseSummary {
  id: string;
  created_at: string;
  persona_id: string | null;
  symptom_count: number;
  goal_count: number;
}

export interface SurveyResponseDetail {
  id: string;
  created_at: string;
  answers: SurveyAnswers;
}

/** survey_responses 행 → SurveyAnswers (answers jsonb 없으면 컬럼에서 재구성, 구 행 폴백) */
function reconstructAnswers(row: {
  gender: string | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  symptoms: string[] | null;
  goals: string[] | null;
  sleep_pattern: string | null;
  stress_level: string | null;
  exercise_freq: string | null;
  diet_pattern: string | null;
  alcohol_freq: string | null;
  current_supplements: string[] | null;
  conditions: string[] | null;
  family_history: string[] | null;
}): SurveyAnswers {
  return {
    성별: row.gender ?? "male",
    나이: row.age ?? 0,
    신장: row.height_cm ?? 0,
    체중: row.weight_kg ?? 0,
    체중변화: "변화없음",
    증상: row.symptoms ?? [],
    목표: row.goals ?? [],
    수면: row.sleep_pattern ?? undefined,
    스트레스: row.stress_level ?? undefined,
    운동: row.exercise_freq ?? undefined,
    식사패턴: row.diet_pattern ?? undefined,
    음주: row.alcohol_freq ?? undefined,
    현재복용영양제: row.current_supplements ?? [],
    기저질환: row.conditions ?? [],
    가족력: row.family_history ?? [],
  };
}

/** 활성 설문 기록 목록 (관리 UI용). 삭제분 제외. */
export async function fetchSurveyResponses(userId: string): Promise<{
  responses: SurveyResponseSummary[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("survey_responses")
    .select("id, created_at, persona_id, symptoms, goals")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[survey_api] fetchSurveyResponses failed:", error.message);
    return { responses: [], error: error.message };
  }

  const responses: SurveyResponseSummary[] = (data ?? []).map((row: {
    id: string;
    created_at: string;
    persona_id: string | null;
    symptoms: string[] | null;
    goals: string[] | null;
  }) => ({
    id: row.id,
    created_at: row.created_at,
    persona_id: row.persona_id,
    symptom_count: row.symptoms?.length ?? 0,
    goal_count: row.goals?.length ?? 0,
  }));

  return { responses, error: null };
}

/** 단건 설문 상세 (결과 보기용). answers jsonb 우선, 없으면 컬럼 재구성. 삭제분 제외. */
export async function fetchSurveyResponseDetail(
  responseId: string,
  userId: string,
): Promise<{ detail: SurveyResponseDetail | null; error: string | null }> {
  const { data, error } = await supabase
    .from("survey_responses")
    .select(
      "id, created_at, answers, gender, age, height_cm, weight_kg, symptoms, goals, sleep_pattern, stress_level, exercise_freq, diet_pattern, alcohol_freq, current_supplements, conditions, family_history",
    )
    .eq("id", responseId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[survey_api] fetchSurveyResponseDetail failed:", error.message);
    return { detail: null, error: error.message };
  }
  if (!data) {
    return { detail: null, error: null };
  }

  const row = data as Record<string, any>;
  const answers: SurveyAnswers =
    row.answers && typeof row.answers === "object"
      ? (row.answers as SurveyAnswers)
      : reconstructAnswers(row as any);

  return {
    detail: { id: row.id, created_at: row.created_at, answers },
    error: null,
  };
}

/** 설문 기록 삭제 (soft) — deleted_at 마킹. 물리 삭제 아님. */
export async function deleteSurveyResponse(
  responseId: string,
  userId: string,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("survey_responses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", responseId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    console.error("[survey_api] deleteSurveyResponse failed:", error.message);
    return { id: null, error: error.message };
  }
  if (!data || data.length === 0) {
    return { id: null, error: "삭제 대상이 없거나 권한이 없습니다." };
  }
  return { id: data[0].id, error: null };
}

/** 설문 기록 복구 — 실행취소(undo). */
export async function restoreSurveyResponse(
  responseId: string,
  userId: string,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("survey_responses")
    .update({ deleted_at: null })
    .eq("id", responseId)
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .select("id");

  if (error) {
    console.error("[survey_api] restoreSurveyResponse failed:", error.message);
    return { id: null, error: error.message };
  }
  if (!data || data.length === 0) {
    return { id: null, error: "복구 대상이 없습니다." };
  }
  return { id: data[0].id, error: null };
}
