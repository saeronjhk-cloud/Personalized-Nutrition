/**
 * 검진 화면 공용 동의 게이트 — 상태 결정(효과 없는 의존성 주입형).
 * 평가 IP/integration/checkup_subroute_gate_eval_v1.md G01~G07
 * 서버(SQL 161 checkup_consent_status)가 권위. 어떤 예외든 error(거짓 통과 금지).
 */
import { decideGateMode, type CheckupConsentStatus, type GateMode } from "../domain/checkup/consent_v2";
import { fetchCheckupConsentStatus } from "./checkupConsent";
import { supabase } from "./supabase";

export interface CheckupGateDeps {
  isLoggedIn: () => Promise<boolean>;
  fetchStatus: () => Promise<CheckupConsentStatus | null>;
}

export const defaultCheckupGateDeps: CheckupGateDeps = {
  isLoggedIn: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return !!user;
  },
  fetchStatus: fetchCheckupConsentStatus,
};

export async function resolveCheckupGateMode(deps: CheckupGateDeps = defaultCheckupGateDeps): Promise<GateMode> {
  try {
    const loggedIn = await deps.isLoggedIn();
    if (!loggedIn) return decideGateMode({ loggedIn: false, status: null });
    const status = await deps.fetchStatus();
    return decideGateMode({ loggedIn: true, status });
  } catch {
    return "error";
  }
}
