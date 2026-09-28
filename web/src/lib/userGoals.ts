/**
 * 내 건강 목표 저장소 (IO) — public.user_goals (152_user_goals_v1.sql)
 * 순수 규칙은 domain/goals/goals.ts. 여기는 읽기/쓰기/1회 시드만.
 *
 * 규칙1(supabase_anti_patterns): upsert 뒤 .select() 로 반환 행을 확인해 성공 판정.
 */
import { supabase } from "./supabase";
import { resolveEffectiveGoals, sanitizeGoals, type GoalSource } from "../domain/goals/goals";

/** user_goals 행. 없으면 null (빈 배열과 구분 — 빈 배열은 «사용자가 비움»). 오류도 null. */
export async function fetchUserGoalsRow(userId: string): Promise<string[] | null> {
  const { data, error } = await supabase
    .from("user_goals")
    .select("goals")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[userGoals] fetch failed:", error.message);
    return null;
  }
  return data ? ((data.goals as string[] | null) ?? []) : null;
}

export async function saveUserGoals(userId: string, goals: string[]): Promise<{ ok: boolean; error: string | null }> {
  const clean = sanitizeGoals(goals);
  const { data, error } = await supabase
    .from("user_goals")
    .upsert({ user_id: userId, goals: clean, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select("user_id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "저장 결과를 확인하지 못했습니다." };
  return { ok: true, error: null };
}

/** 최신(삭제 안 된) 설문의 goals 컬럼 — 폴백용. */
async function fetchLatestSurveyGoals(userId: string): Promise<string[] | null> {
  const { data, error } = await supabase
    .from("survey_responses")
    .select("goals")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return (data.goals as string[] | null) ?? [];
}

/**
 * 유효 목표 로드 (+ 필요 시 1회 시드).
 * user_goals 행이 없고 설문에 목표가 있으면 그 값을 user_goals 로 옮겨 적는다(G02).
 */
export async function loadEffectiveGoals(userId: string): Promise<{ goals: string[]; source: GoalSource }> {
  const row = await fetchUserGoalsRow(userId);
  const fb = row === null ? await fetchLatestSurveyGoals(userId) : null;
  const r = resolveEffectiveGoals(row, fb);
  if (r.needsSeed) {
    const s = await saveUserGoals(userId, r.goals);
    if (!s.ok) console.error("[userGoals] seed failed:", s.error);
  }
  return { goals: r.goals, source: r.source };
}

/** 최신 설문의 신장·체중 (BMI 게이트용). 없으면 null. */
export async function fetchLatestBody(userId: string): Promise<{ 신장: number; 체중: number } | null> {
  const { data, error } = await supabase
    .from("survey_responses")
    .select("height_cm, weight_kg")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data || !data.height_cm || !data.weight_kg) return null;
  return { 신장: Number(data.height_cm), 체중: Number(data.weight_kg) };
}
