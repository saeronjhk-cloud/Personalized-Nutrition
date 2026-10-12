/**
 * 설문 동의 v2(서버 기록) — 순수 로직 + 문구(복사본).
 * 문구 정본: IP/설문동의_고지문안_정본_v1_20261012.md §1~§4 (여기는 1:1 복사본 — 고칠 땐 정본 먼저, 규칙 78)
 * 평가: IP/integration/survey_consent_v2_eval_v1.md (D1~D16 · A01~A12)
 * 서버 버전(재동의 판정)은 SQL 163 survey_consent_policy.current_notice_version 이 권위. 아래는 표시·테스트용.
 * 제이 결정 10-12: 비로그인 = 저장 시 같은 행에 서버가 동의 기록(J2) · 기존 사용자 = 제이 1명 → 이관 없음(J3).
 */
export const SURVEY_NOTICE_VERSION = "survey_v1";
export const SURVEY_POLICY_VERSION = "13_v5.2";
/** 처리방침 13_v5.2 시행일(배포일). ⚠️ 배포일이 바뀌면 이 한 줄만 고칠 것. */
export const SURVEY_POLICY_EFFECTIVE = "2026년 10월 12일";
export const SURVEY_CHANNEL_GATE = "web_survey_gate";
export const SURVEY_CHANNEL_GOALS = "web_goals_card";

export interface SurveyConsentStatus {
  has_row: boolean;
  active: boolean;
  needs_reconsent: boolean;
  survey_count: number;
  goals_exists: boolean;
  consented_at: string | null;
}

/** anon = 비로그인(화면 안 메모리 동의 → 저장 시 RPC 가 서버 기록). error = 서버 확인 실패(진입 차단). */
export type SurveyGateMode = "anon" | "first" | "reconsent" | "pass" | "error";

export function decideSurveyGateMode(args: { loggedIn: boolean; status: SurveyConsentStatus | null }): SurveyGateMode {
  if (!args.loggedIn) return "anon";
  if (!args.status) return "error";
  if (args.status.active) return "pass";
  if (args.status.needs_reconsent) return "reconsent";
  return "first";
}

/** 필수 2개(개인정보·민감정보) 모두 체크돼야 제출 가능. */
export function canSubmitSurveyConsent(pi: boolean, sensitive: boolean): boolean {
  return pi === true && sensitive === true;
}

/** 계정 화면 철회 버튼 활성(D13): 동의 행·설문 기록·건강 목표 중 하나라도 있으면(삭제권). */
export function surveyRevokeEnabled(s: SurveyConsentStatus | null): boolean {
  if (!s) return false;
  return s.has_row || s.survey_count > 0 || s.goals_exists;
}

/** 계정 화면 상태 문구(정본 §3). */
export function surveyAccountStatusText(s: SurveyConsentStatus | null): string {
  if (!s) return GATE_STATUS_ERROR;
  if (s.active && s.consented_at) return ACCOUNT_STATUS_ACTIVE(s.consented_at);
  if (s.survey_count > 0 || s.goals_exists || s.has_row) return ACCOUNT_STATUS_NO_CONSENT;
  return ACCOUNT_STATUS_NONE;
}

function ymd(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // KST 기준 표시
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${k.getUTCFullYear()}년 ${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일`;
}

// ── 정본 §1 동의 화면 ──
export const GATE_TITLE = "설문 기반 건강 관련 정보 수집·이용 동의";
export const GATE_BODY_BEFORE_LINKS =
  "이 설문은 맞춤 영양(건강기능식품 등) 추천과 생활습관 가이드를 제공하고 본인 기록·변화 추적에 활용하기 위해, 증상·기저질환·가족력·생활습관·성별·연령·신장·체중·건강 목표 등 설문 입력 정보와 그로부터 산출된 추천 결과를 건강 관련 민감정보로 취급하여 수집·이용합니다. 로그인한 경우 회원 계정에 저장되어 변화 추적에 사용되며, 비로그인 시 비회원 임시 세션 식별자를 통해 처리됩니다. 이 정보는 생성일로부터 최대 730일 또는 탈퇴·삭제요청 시까지 보관됩니다. 자세한 내용은";
export const GATE_FAMILY_NOTE =
  "가족력은 본인의 건강관리 참고 범위에서만 입력해 주세요. 가족 구성원의 이름·연락처·생년월일 등 식별정보는 입력하지 마세요.";
export const GATE_CHECK_PI =
  "[필수] 개인정보 수집·이용에 동의합니다. (성별·연령·신장·체중·생활습관 등 설문 입력 정보 및 추천 결과)";
export const GATE_CHECK_SENSITIVE =
  "[필수] 민감정보(건강에 관한 정보) 수집·이용에 동의합니다. (증상·기저질환·가족력·건강 목표) 거부 시 설문 기능 이용이 제한되며, 회원가입 및 다른 기능은 이용할 수 있습니다.";
export const GATE_BTN_ACCEPT = "동의하고 설문 시작";
export const GATE_BTN_ACCEPT_GOALS = "동의하고 목표 설정";
export const GATE_BTN_DECLINE = "동의하지 않음";

// ── 정본 §2 ──
export const RECONSENT_TITLE = "설문 동의 내용이 바뀌었어요";
export const RECONSENT_BODY =
  "설문 정보 이용 동의 내용이 바뀌어 다시 동의를 받고 있어요. 바뀐 내용을 확인하고 동의하시면 이전과 같이 이용하실 수 있어요.";
export const GATE_SUBMIT_ERROR = "동의를 저장하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.";
export const GATE_STATUS_ERROR = "동의 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.";

// ── 정본 §3 계정 화면 ──
export const ACCOUNT_BLOCK_TITLE = "설문 정보 동의";
export const ACCOUNT_STATUS_ACTIVE = (iso: string) => `설문·건강 목표 정보 이용에 동의하셨어요 (${ymd(iso)})`;
export const ACCOUNT_STATUS_NO_CONSENT =
  "서버에 기록된 설문 동의가 없어요. 아래에서 설문 기록과 건강 목표를 삭제할 수 있어요.";
export const ACCOUNT_STATUS_NONE = "설문 동의 내역이 없어요";
export const ACCOUNT_BTN_REVOKE = "설문 동의 철회 (설문 기록·건강 목표 삭제)";
export const ACCOUNT_CONFIRM_REVOKE =
  "설문 동의를 철회하면 계정에 저장된 설문 기록 전체와 건강 목표가 즉시 영구 삭제되며 되돌릴 수 없어요. 맞춤 추천은 새로 설문에 동의하고 응답한 뒤에 다시 이용할 수 있어요. 철회할까요?";
export const ACCOUNT_CONFIRM_OK = "철회하고 삭제";
export const ACCOUNT_DONE_REVOKE = (n: number) => `설문 동의를 철회했어요. 설문 기록 ${n}건과 건강 목표를 삭제했어요.`;
export const ACCOUNT_REVOKE_ERROR =
  "철회하지 못했어요. 잠시 후 다시 시도해 주세요. 계속 실패하면 contact@saeronmedia.com 으로 알려 주세요.";
