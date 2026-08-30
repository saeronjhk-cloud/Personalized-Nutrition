/**
 * 식사 사진 기록(NutriLens) 전용 동의 — 촬영 전 강제되는 출시 게이트.
 *
 * 설문 동의(sf_sensitive_consent)와 별개의 독립 동의다. 식사 사진은 두 가지 별도 고지·동의가 필요하다:
 *  (1) 민감정보: 사진에서 추정된 음식·칼로리·영양이 '건강에 관한 정보'로 취급되어 수집·이용된다.
 *  (2) 국외이전: 사진 분석을 위해 이미지가 국외 처리자(OpenAI, 미국)로 전송·처리된다(개인정보 국외이전).
 *
 * 보호법상 각 동의는 사전 선택 없이 이용자가 직접 개별 체크한다(사전체크 금지).
 * ⚠️ 컴플라이언스: 실제 production 토글(VITE_MEAL_ENABLED) 전에 개인정보처리방침에
 *    '국외이전' 조항(이전받는 자=OpenAI, 국가=미국, 항목=식사 사진, 목적=영양 분석,
 *    보유·이용기간, 거부권·불이익)이 반영되어야 한다. 아래 문구는 그 조항과 1:1 정합시킬 것.
 */

import { supabase } from './supabase'

// 동의 당시 처리방침 버전(서버 기록·감사용).
export const MEAL_CONSENT_POLICY_VERSION = '13_v5.0'

// 두 동의를 각각 독립 키로 보관(별도 동의 원칙). 둘 다 'accepted'여야 진입 허용.
const MEAL_SENSITIVE_KEY = 'sf_meal_sensitive_consent' // 'accepted' | null
const MEAL_INTL_KEY = 'sf_meal_intl_consent'           // 'accepted' | null
// 동의 당시 방침 버전(재동의 게이트용). 저장값이 현재 버전과 다르면 미동의로 간주 → 게이트 재노출.
const MEAL_POLICY_VER_KEY = 'sf_meal_consent_policy_version'

function isAccepted(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'accepted'
  } catch {
    return false
  }
}

/** 식사 사진 민감정보 동의 여부. */
export function hasConsentedMealSensitive(): boolean {
  return isAccepted(MEAL_SENSITIVE_KEY)
}

/** 식사 사진 국외이전(OpenAI, 미국) 동의 여부. */
export function hasConsentedMealIntl(): boolean {
  return isAccepted(MEAL_INTL_KEY)
}

/** 동의 당시 방침 버전이 현재 버전과 일치하는지 — 불일치면 재동의 필요. */
function policyVersionCurrent(): boolean {
  try {
    return localStorage.getItem(MEAL_POLICY_VER_KEY) === MEAL_CONSENT_POLICY_VERSION
  } catch {
    return false
  }
}

/**
 * 촬영 진입 허용 여부 — 두 동의 모두 accepted이고, 동의 당시 방침 버전이 현재와 같을 때만 true.
 * 방침이 중요 변경(버전 bump)되면 기존 동의는 무효화되어 게이트가 다시 뜬다(재동의 게이트).
 */
export function hasConsentedMeal(): boolean {
  return hasConsentedMealSensitive() && hasConsentedMealIntl() && policyVersionCurrent()
}

/** 두 동의를 함께 기록(+동의 시점 방침 버전). 게이트에서 세 체크박스가 모두 켜졌을 때만 호출한다. */
export function markMealConsent(): void {
  try {
    localStorage.setItem(MEAL_SENSITIVE_KEY, 'accepted')
    localStorage.setItem(MEAL_INTL_KEY, 'accepted')
    localStorage.setItem(MEAL_POLICY_VER_KEY, MEAL_CONSENT_POLICY_VERSION)
  } catch {
    // 무시(로컬 저장 실패해도 UI는 진행 가능하게 두지 않음 — 아래 게이트가 재확인)
  }
}

/** 동의 철회(설정/삭제 흐름에서 사용) — 로컬 캐시 제거. */
export function revokeMealConsent(): void {
  try {
    localStorage.removeItem(MEAL_SENSITIVE_KEY)
    localStorage.removeItem(MEAL_INTL_KEY)
    localStorage.removeItem(MEAL_POLICY_VER_KEY)
  } catch {
    // 무시
  }
}

// ── 서버 기록(권위) — Edge(meal-analysis-jobs)가 호출 전 meal_consent_active로 재검증한다.
//    localStorage는 UX용 캐시일 뿐, 실제 게이트는 서버가 판단(P0-③ G2).

/**
 * 두 동의 + 만 14세 이상 확인을 서버(meal_consent)에 기록. 로그인 세션 필요.
 * age_confirmed_14plus는 게이트에서 3번째 체크(만 14세 이상)가 켜졌을 때만 true로 전달한다.
 * meal_consent_active(P0-④)가 이 값을 필수 조건으로 재검증한다.
 */
export async function markMealConsentServer(ageConfirmed14plus = false): Promise<void> {
  // ★ 2026-08-28: 예전에는 `if (!user) return` 이었다 — 로그인 세션이 없으면
  //   «조용히» 아무것도 안 하고 성공한 척했다. 그런데 호출부는 그 직전에
  //   로컬 캐시에 'accepted' 를 이미 박아 둔다. 결과:
  //     로컬 = 동의함  /  서버 = 기록 없음  →  게이트는 다시 안 뜨고 Edge 는 계속 거부
  //   = 사용자가 스스로 빠져나올 수 없는 상태. 실제로 발생했다(2026-08-28).
  //   실패는 반드시 시끄러워야 한다. 호출부가 로컬 캐시를 되돌릴 수 있게 던진다.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다 — 동의를 서버에 기록할 수 없습니다.')
  const now = new Date().toISOString()
  const { error } = await supabase.from('meal_consent').upsert({
    user_id: user.id,
    sensitive_consented_at: now,
    intl_consented_at: now,
    age_confirmed_14plus: ageConfirmed14plus,
    revoked_at: null,
    policy_version: MEAL_CONSENT_POLICY_VERSION,
  }, { onConflict: 'user_id' })
  // upsert 실패도 삼키지 않는다. 서버에 안 남았는데 로컬만 동의됨 = 같은 사고다.
  if (error) throw error
}

/**
 * 서버 동의 철회 — Edge(meal-consent-revoke)가 원자적으로 처리한다:
 *   ① meal_consent.revoked_at 세팅(트리거가 감사로그에 revoke 이벤트 적재)
 *   ② delete_meal_data RPC로 식사 스택(사진 메타·분석·주간리포트) 삭제
 *   ③ Storage(meal-photos) `{uid}/` 원본 사진 스윕
 * 철회 즉시 이후 국외이전이 차단되고, 이미 저장된 사진·파생정보도 삭제된다(변호사 2차 검토 반영).
 * 실패 시 throw → 호출부(Account)가 재시도 안내.
 */
export async function revokeMealConsentServer(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { error } = await supabase.functions.invoke('meal-consent-revoke', { method: 'POST' })
  if (error) throw error
}

/** 서버 기준 활성 동의 여부(meal_consent_active RPC). */
export async function hasServerMealConsent(): Promise<boolean> {
  const { data, error } = await supabase.rpc('meal_consent_active', {
    p_uid: (await supabase.auth.getUser()).data.user?.id,
  })
  return !error && data === true
}

/**
 * ★ 2026-08-28 신설 — 서버를 «권위»로 삼아 로컬 캐시를 맞춘다.
 *
 * 왜 필요한가: 로컬 캐시는 브라우저에 남고 계정을 따라다니지 않는다.
 *   계정 A 로 동의 → 로그아웃 → 계정 B 로 로그인 하면
 *   로컬은 여전히 '동의함' 인데 서버(계정 B)에는 기록이 없다.
 *   그러면 게이트가 안 뜨고, Edge 는 계속 거부하고, 사용자는 갇힌다.
 *   실제로 발생했다(2026-08-28, 계정 교체 후 사진 분석 전면 차단).
 *
 * 반환값: 서버 기준 동의 여부. 서버 확인 자체가 실패하면 null.
 *   null 이면 호출부는 로컬 캐시로 폴백해도 된다 — 최종 게이트는 어차피
 *   Edge(meal-analysis-jobs)가 쥐고 있으므로 «거짓 통과»는 생기지 않는다.
 */
export async function syncMealConsentFromServer(): Promise<boolean | null> {
  let server: boolean
  try {
    server = await hasServerMealConsent()
  } catch {
    return null                       // 네트워크·RPC 실패 — 판단하지 않는다
  }
  if (server) {
    // 서버에 있으면 로컬을 채운다(다른 기기/브라우저에서 동의한 경우).
    markMealConsent()
  } else {
    // 서버에 없으면 로컬의 낡은 '동의함'을 지운다 → 게이트가 다시 뜬다.
    revokeMealConsent()
  }
  return server
}
