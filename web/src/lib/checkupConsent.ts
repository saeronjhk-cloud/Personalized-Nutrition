/**
 * 검진 동의 v2 — 서버(SQL 161) 호출 래퍼. 서버가 권위, localStorage 는 쓰지 않음(식사 08-28 사고 교훈:
 * 로컬 캐시가 계정을 따라다니지 않아 갇힘 발생). 평가 IP/integration/checkup_consent_v2_eval_v1.md
 */
import { supabase } from "./supabase";
import { CHECKUP_CONSENT_CHANNEL, type CheckupConsentStatus } from "../domain/checkup/consent_v2";

/** 서버 동의 상태. 실패 시 null(호출부는 진입 차단). */
export async function fetchCheckupConsentStatus(): Promise<CheckupConsentStatus | null> {
  try {
    const { data, error } = await supabase.rpc("checkup_consent_status");
    if (error || !data) return null;
    const d = data as Partial<CheckupConsentStatus>;
    return {
      has_row: d.has_row === true,
      core_active: d.core_active === true,
      combine_active: d.combine_active === true,
      needs_reconsent: d.needs_reconsent === true,
      record_count: typeof d.record_count === "number" ? d.record_count : 0,
    };
  } catch {
    return null;
  }
}

/** 동의 기록 — 실패는 반드시 throw(조용한 성공 금지, A04). 버전·시각은 서버가 채운다. */
export async function giveCheckupConsent(core: boolean, age14: boolean, combine: boolean): Promise<void> {
  const { error } = await supabase.rpc("give_checkup_consent", {
    p_core: core,
    p_age14: age14,
    p_combine: combine,
    p_channel: CHECKUP_CONSENT_CHANNEL,
  });
  if (error) throw error;
}

/** 철회 A — 결합 이용만. */
export async function revokeCheckupCombine(): Promise<void> {
  const { error } = await supabase.rpc("revoke_checkup_combine");
  if (error) throw error;
}

/** 철회 B — 검진 기록 전부 원자 삭제. 삭제 건수 반환. */
export async function revokeCheckupConsent(): Promise<{ checkup_records: number; biomarker_values: number }> {
  const { data, error } = await supabase.rpc("revoke_checkup_consent");
  if (error) throw error;
  const d = (data ?? {}) as { checkup_records?: number; biomarker_values?: number };
  return { checkup_records: d.checkup_records ?? 0, biomarker_values: d.biomarker_values ?? 0 };
}

/** 결합 로더용 — 서버 combine_active. 실패·비로그인은 false(결합 안 함 = 안전 쪽). */
export async function isCheckupCombineActive(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("checkup_consent_combine_active", { p_uid: userId });
    return !error && data === true;
  } catch {
    return false;
  }
}
