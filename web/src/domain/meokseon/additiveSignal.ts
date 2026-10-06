/**
 * ★ 세션75j — 첨가물 신호등 v3 (서버 `additiveSignal.js` 결과를 화면용으로 읽기만 한다).
 *
 * 판정은 서버에 있다(근거 DB `IP/첨가물신호등_v3/evidence_v1.1.json` · 규칙 R0~R7+R6n · eval gold 30+10).
 * 이 파일은 «읽기 + 문구»만 한다. 색을 여기서 다시 계산하지 않는다.
 *
 * 문구는 안전 계약이다(제이 결정 2026-10-06 «원재료·신호등 v3 함께»). 바꾸려면 제이 승인.
 */

export type SignalColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'gray'

export interface SignalView {
  color: SignalColor
  emoji: string
  /** 색 이름(예: «조건부 주의») */
  label: string
  /** 왜 이 색인지 한 줄(서버 reason) */
  reason: string
  /** 색을 바꾸지 않는 참고 표시(예: «고섭취자 기준 초과 가능») */
  badges: string[]
  /** «국내: 식약처 허용 첨가물 · …» 한 줄. 없으면 null */
  domestic: string | null
  /** IARC 분류가 걸린 경우 고정 문구. 없으면 null */
  iarcNote: string | null
}

const COLORS: SignalColor[] = ['red', 'orange', 'yellow', 'green', 'blue', 'gray']
const EMOJI: Record<SignalColor, string> = { red: '🔴', orange: '🟠', yellow: '🟡', green: '🟢', blue: '🔵', gray: '⚪' }

const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** 서버 `signal` 객체 → 화면 뷰. 모양이 다르면 null(그리지 않는다 — 추측으로 색을 만들지 않음). */
export function readSignal(raw: unknown): SignalView | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const color = s(o['color']) as SignalColor
  if (!COLORS.includes(color)) return null
  const badges = Array.isArray(o['badges'])
    ? (o['badges'] as unknown[]).map((b) => (b && typeof b === 'object' ? s((b as Record<string, unknown>)['text']) : s(b))).filter(Boolean)
    : []
  const dom = o['domestic'] && typeof o['domestic'] === 'object' ? s((o['domestic'] as Record<string, unknown>)['text']) : ''
  return {
    color,
    emoji: EMOJI[color],
    label: s(o['color_label']) || SIGNAL_LABEL[color],
    reason: s(o['reason']),
    badges,
    domestic: dom || null,
    iarcNote: s(o['iarc_note']) || null,
  }
}

export const SIGNAL_LABEL: Record<SignalColor, string> = {
  red: '주의 근거 있음',
  orange: '조건부 주의',
  yellow: '사용기준 관리',
  green: '현재 평가에서 수치 제한 불필요',
  blue: '영양강화 성분 · 상한섭취량 관리',
  gray: '자료 부족 · 성분 특정 불가',
}

/** 섹션 끝 각주 한 번 */
export const SIGNAL_SECTION_NOTE =
  '색은 국제 평가기관(JECFA·EFSA·IARC)과 EU 규정의 결론을 정해진 규칙으로 정리한 참고 표시예요. ' +
  '식약처가 허용한 첨가물이며, 진단이나 의학적 조언이 아니에요.'

/** 저장된 첨가물 목록이 없어 원재료 원문에서 찾은 경우 */
export const DERIVED_TITLE = '원재료에서 찾은 첨가물'
export const DERIVED_NOTE = '이 제품은 첨가물 목록이 따로 없어, 원재료 표시에서 식품첨가물공전 품목명과 정확히 일치하는 것만 찾았어요.'

/** 원재료 원문 출처 문구 */
export const INGREDIENTS_TITLE = '원재료'
export const SIBLING_INGREDIENT_NOTE = '같은 품목제조번호의 다른 바코드(용량만 다른 같은 제품)에 표시된 원재료예요.'

/**
 * 첨가물 카드 머리 안내 — 신호등 v3 가 하나라도 있으면 GRADE_HIDDEN_NOTICE 대신 쓴다.
 *   (GRADE_HIDDEN_NOTICE 는 주간 화면 등 다른 곳이 쓰고 있어 그대로 둔다.)
 */
export const SIGNAL_V3_NOTICE =
  '첨가물마다 국제 평가기관의 결론을 정리한 신호등(🔴 주의 근거 · 🟠 조건부 주의 · 🟡 사용기준 관리 · 🟢 수치 제한 불필요 · 🔵 영양강화 · ⚪ 자료 부족)을 함께 보여드려요. '
  + '예전 위험 등급(먹선 MFRAS)은 재검토 중이라 표시하지 않아요.'

/** ★ 세션75j — 영양이 같은 품목제조번호의 형제 바코드에서 온 경우(서버 nutrition.source === 'entity_profile') */
export const SIBLING_NUTRITION_NOTE = '같은 품목제조번호의 다른 바코드(용량만 다른 같은 제품)에 표시된 100g(㎖)당 값이에요.'
