/**
 * 설문 동의 v2 — 서버(SQL 163) 호출 래퍼. 서버가 권위, localStorage 동의 키는 쓰지 않음(규칙 76 동일).
 * 평가 IP/integration/survey_consent_v2_eval_v1.md
 */
import { supabase } from "./supabase";
import type { SurveyConsentStatus } from "../domain/survey/consent_v2";

/** 서버 동의 상태(로그인). 실패 시 null(호출부는 진입 차단 — 거짓 통과 금지). */
export async function fetchSurveyConsentStatus(): Promise<SurveyConsentStatus | null> {
  try {
    const { data, error } = await supabase.rpc("survey_consent_status");
    if (error || !data) return null;
    const d = data as Partial<SurveyConsentStatus>;
    return {
      has_row: d.has_row === true,
      active: d.active === true,
      needs_reconsent: d.needs_reconsent === true,
      survey_count: typeof d.survey_count === "number" ? d.survey_count : 0,
      goals_exists: d.goals_exists === true,
      consented_at: typeof d.consented_at === "string" ? d.consented_at : null,
    };
  } catch {
    return null;
  }
}

/** 동의 기록(로그인) — 실패는 반드시 throw(조용한 성공 금지). 버전·시각은 서버가 채운다. */
export async function giveSurveyConsent(pi: boolean, sensitive: boolean, channel: string): Promise<void> {
  const { error } = await supabase.rpc("give_survey_consent", {
    p_pi: pi,
    p_sensitive: sensitive,
    p_channel: channel,
  });
  if (error) throw error;
}

/** 철회 = 설문 기록·건강 목표·연결된 비회원 설문 원자 삭제. 삭제 건수 반환. */
export async function revokeSurveyConsent(): Promise<{ survey_responses: number; user_goals: number; anon_sessions: number }> {
  const { data, error } = await supabase.rpc("revoke_survey_consent");
  if (error) throw error;
  const d = (data ?? {}) as { survey_responses?: number; user_goals?: number; anon_sessions?: number };
  return { survey_responses: d.survey_responses ?? 0, user_goals: d.user_goals ?? 0, anon_sessions: d.anon_sessions ?? 0 };
}

/** 로더용 — 서버 active. 실패·비로그인은 false(쓰기 시도 안 함 = 안전 쪽). */
export async function isSurveyConsentActive(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("survey_consent_active", { p_uid: userId });
    return !error && data === true;
  } catch {
    return false;
  }
}
