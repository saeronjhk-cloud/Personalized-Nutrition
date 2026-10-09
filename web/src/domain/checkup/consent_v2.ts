/**
 * 검진 동의 v2 — 순수 로직 + 문구(복사본).
 * 문구 정본: IP/검진동의_고지문안_정본_v2_20261007.md §1·§4·§5 (여기는 1:1 복사본 — 고칠 땐 정본 먼저)
 * 평가: IP/integration/checkup_consent_v2_eval_v1.md (A01~A14)
 * 서버 버전(재동의 판정)은 SQL 161 checkup_consent_policy.current_notice_version 이 권위. 아래는 표시·테스트용.
 */
export const CHECKUP_NOTICE_VERSION = "checkup_v2";
export const CHECKUP_POLICY_VERSION = "13_v5.1";
export const CHECKUP_CONSENT_CHANNEL = "web_checkup_gate";
/** 처리방침 13_v5.1 시행일(배포일). ⚠️ 배포일이 바뀌면 이 한 줄만 고칠 것. */
export const CHECKUP_POLICY_EFFECTIVE = "2026년 10월 9일";

export interface CheckupConsentStatus {
  has_row: boolean;
  core_active: boolean;
  combine_active: boolean;
  needs_reconsent: boolean;
  record_count: number;
}

export type GateMode = "login" | "first" | "reconsent" | "pass" | "error";

/** 게이트 화면 결정. status=null 은 서버 확인 실패(진입 차단 — 거짓 통과 금지). */
export function decideGateMode(args: {
  loggedIn: boolean;
  status: CheckupConsentStatus | null;
  legacyLocalConsent: boolean;
}): GateMode {
  if (!args.loggedIn) return "login";
  if (!args.status) return "error";
  if (args.status.core_active) return "pass";
  if (args.status.needs_reconsent || args.legacyLocalConsent || args.status.record_count > 0) return "reconsent";
  return "first";
}

/** 필수 2개(민감정보·만14세)가 모두 체크돼야 제출 가능. 선택 체크는 무관(A02). */
export function canSubmitConsent(core: boolean, age14: boolean): boolean {
  return core === true && age14 === true;
}

/** 계정 화면 철회 버튼 상태(A09~A11). */
export function accountRevokeState(s: CheckupConsentStatus | null): {
  showCombineRevoke: boolean;
  coreRevokeEnabled: boolean;
} {
  if (!s) return { showCombineRevoke: false, coreRevokeEnabled: false };
  return {
    showCombineRevoke: s.combine_active,
    coreRevokeEnabled: s.has_row || s.record_count > 0,
  };
}

// ── 문구(정본 §1) ──
export const GATE_TITLE = "건강검진 정보 이용 동의";
export const GATE_CORE_INTRO =
  "회사는 이용자가 직접 입력하거나 결과지 PDF에서 이용자 기기 안에서 읽어 들인 건강검진 수치(혈압·혈당·지질·간기능·신장기능·체격·요단백 등), 검진일, 성별·연령대, 입력일시, 적용 기준표 버전과 해석 결과를 건강에 관한 민감정보로 처리합니다.";
export const GATE_CORE_BULLETS = [
  "목적: 참고범위 안내, 의료진 상담 권고, 본인 검진 기록 저장·비교·추이 관리",
  "보유기간: 입력일부터 730일. 다만 회원 탈퇴, 기록 삭제 요청 또는 이 동의를 철회하면 지체 없이 파기합니다.",
  "거부 권리: 동의하지 않을 수 있습니다. 동의하지 않으면 검진 기능은 이용할 수 없으나, 회원가입과 다른 기능은 이용할 수 있습니다.",
  "결과지 PDF 파일은 서버로 전송·저장하지 않으며, 이용자 기기에서 수치만 읽어 들입니다.",
  "본 기능은 의학적 진단·치료·처방이 아니며 의료기기가 아닙니다.",
];
export const GATE_CHECK_CORE = "(필수) 건강검진 민감정보 수집·이용에 동의합니다.";
export const GATE_CHECK_AGE = "(필수) 만 14세 이상입니다.";
export const GATE_COMBINE_BULLETS = [
  "목적: 검진 정보를 설문 응답·식사 기록과 결합하여 맞춤 건강기능식품 추천, 식사 코칭, 주간 리포트에 이용",
  "항목: 위 검진 정보 중 최신 기록의 수치·해석 결과",
  "보유기간: 위와 같음(이 동의만 철회하면 결합 이용을 중단하고 결합으로 만든 결과를 삭제합니다)",
  "거부 권리: 동의하지 않아도 검진 기록·해석과 다른 서비스는 그대로 이용할 수 있습니다. 검진 정보가 반영된 맞춤 추천·코칭·리포트만 제공되지 않습니다.",
];
export const GATE_CHECK_COMBINE =
  "(선택) 검진 정보를 설문·식사 기록과 결합해 맞춤 추천·코칭·리포트에 이용하는 데 동의합니다.";
export const GATE_SMALL_PRINT =
  "타인의 건강검진 결과지는 그 사람의 동의 없이 입력하지 마세요. 타인의 정보임을 알게 되면 회사는 해당 기록을 삭제할 수 있습니다. 자세한 내용은 개인정보처리방침(건강검진 정보(민감정보)의 별도 동의)을 확인하세요.";
export const GATE_BTN_ACCEPT = "동의하고 검진 입력 시작";
export const GATE_BTN_DECLINE = "동의하지 않음";

// ── 정본 §5 재동의 ──
export const RECONSENT_TITLE = "건강검진 동의 내용이 바뀌었어요";
export const RECONSENT_BODY =
  "검진 정보를 맞춤 추천·코칭·리포트에 쓰는 것은 이제 선택 동의로 따로 받고, 동의 기록을 안전하게 서버에 남깁니다. 계속 이용하시려면 아래 내용을 확인하고 다시 동의해 주세요. 동의하지 않으면 검진 기능은 이용할 수 없지만, 저장된 기록은 계정 화면에서 삭제할 수 있어요.";

// ── 게이트 오류·로그인 (정본 외 운영 문구) ──
export const GATE_SUBMIT_ERROR = "동의를 서버에 기록하지 못했어요. 잠시 후 다시 시도해 주세요.";
export const GATE_STATUS_ERROR = "동의 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.";
export const GATE_LOGIN_REQUIRED = "건강검진 기능은 로그인 후 이용할 수 있어요. 동의 기록을 계정에 안전하게 남기기 위해서예요.";

// ── 정본 §4 계정 화면 철회 ──
export const ACCOUNT_BLOCK_TITLE = "건강검진 정보 동의";
export const ACCOUNT_BTN_COMBINE = "검진 결합 이용 동의 철회";
export const ACCOUNT_DONE_COMBINE =
  "검진 정보의 결합 이용 동의를 철회했어요. 이제 맞춤 추천·코칭·리포트에 검진 정보를 쓰지 않아요. 검진 기록과 해석은 그대로 볼 수 있어요.";
export const ACCOUNT_BTN_CORE = "검진 기능 동의 철회(기록 전부 삭제)";
export const ACCOUNT_CONFIRM_CORE =
  "철회하면 저장된 검진 기록과 수치, 해석 결과가 모두 지체 없이 삭제되고 되돌릴 수 없어요. 철회할까요?";
export const ACCOUNT_DONE_CORE =
  "검진 기능 동의를 철회하고 검진 기록을 모두 삭제했어요. 계정과 다른 기능은 계속 이용할 수 있어요.";
export const ACCOUNT_NONE = "동의 내역 없음";
export const ACCOUNT_REVOKE_ERROR = "철회 처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.";
