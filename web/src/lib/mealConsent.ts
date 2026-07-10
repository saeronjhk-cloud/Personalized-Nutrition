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

// 두 동의를 각각 독립 키로 보관(별도 동의 원칙). 둘 다 'accepted'여야 진입 허용.
const MEAL_SENSITIVE_KEY = 'sf_meal_sensitive_consent' // 'accepted' | null
const MEAL_INTL_KEY = 'sf_meal_intl_consent'           // 'accepted' | null

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

/** 촬영 진입 허용 여부 — 두 동의 모두 accepted일 때만 true. */
export function hasConsentedMeal(): boolean {
  return hasConsentedMealSensitive() && hasConsentedMealIntl()
}

/** 두 동의를 함께 기록. 게이트에서 두 체크박스가 모두 켜졌을 때만 호출한다. */
export function markMealConsent(): void {
  try {
    localStorage.setItem(MEAL_SENSITIVE_KEY, 'accepted')
    localStorage.setItem(MEAL_INTL_KEY, 'accepted')
  } catch {
    // 무시(로컬 저장 실패해도 UI는 진행 가능하게 두지 않음 — 아래 게이트가 재확인)
  }
}

/** 동의 철회(설정/삭제 흐름에서 사용). */
export function revokeMealConsent(): void {
  try {
    localStorage.removeItem(MEAL_SENSITIVE_KEY)
    localStorage.removeItem(MEAL_INTL_KEY)
  } catch {
    // 무시
  }
}
