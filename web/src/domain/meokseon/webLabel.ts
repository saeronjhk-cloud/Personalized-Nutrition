/**
 * ★ 세션79 U78-3 — 판매처 라벨 기반(web_label) 표시 규칙(순수 함수 · 문구 정본).
 *   설계: backends/먹선/IP/U78-3_web_label_노출/설계_v2.md §2-2 A·B
 *   ⚠ 배지·경고 문구는 서버가 실어 준 값을 «그대로» 쓴다(서버 productService.WEB_LABEL_BADGE/WARNING 정본). 비어 있을 때만 아래 기본값.
 *   ⚠ 보충(web_label_supplements)은 «빈 축»만 채운 참고 정보다 — 알레르기 «없음»을 말하는 데 쓰지 않는다.
 */
import type { MsProductResult, MsWebLabelSupplements, MsLabelNutrition } from '../../lib/meokseon'

export const WEB_LABEL_BADGE = '판매처 라벨 기반 · 바코드 미확인'
export const WEB_LABEL_WARNING = '포장 리뉴얼로 실제와 다를 수 있어요. 알레르기는 반드시 실물 포장을 확인하세요.'
export const WEB_NUTRITION_OFF_NOTE = '판매처 라벨의 영양 수치가 열량 계산과 맞지 않아 신호등을 표시하지 않아요. 수치는 참고만 해 주세요.'
export const WEB_STALE_NOTE = '수집한 지 1년이 지난 정보예요. 지금 포장과 다를 가능성이 더 커요.'
export const WEB_SUPPLEMENT_TITLE = '판매처 라벨 기반 보충 정보'

export interface WebLabelNotice { badgeLine: string; warning: string; nutritionOff: boolean; stale: boolean }

/** web_label 품목이면 상단 고정 고지, 아니면 null. */
export function webLabelNotice(result: Pick<MsProductResult, 'web_label'> | null | undefined): WebLabelNotice | null {
  const w = result?.web_label
  if (!w) return null
  const badge = (w.badge || '').trim() || WEB_LABEL_BADGE
  return {
    badgeLine: w.collected_label ? `${badge} · ${w.collected_label}` : badge,
    warning: (w.warning || '').trim() || WEB_LABEL_WARNING,
    nutritionOff: w.nutrition_ok === false,
    stale: w.is_stale === true,
  }
}

const NUT_ROWS: Array<[keyof NonNullable<MsWebLabelSupplements['nutrition']>, string, string]> = [
  ['calories', '열량', 'kcal'], ['sodium', '나트륨', 'mg'], ['total_carbs', '탄수화물', 'g'], ['total_sugars', '당류', 'g'],
  ['total_fat', '지방', 'g'], ['trans_fat', '트랜스지방', 'g'], ['saturated_fat', '포화지방', 'g'], ['cholesterol', '콜레스테롤', 'mg'],
  ['protein', '단백질', 'g'], ['dietary_fiber', '식이섬유', 'g'],
]
const BASIS_LABEL: Record<string, string> = { per_100g: '100g 당', per_100ml: '100ml 당' }

const UNIT: Record<string, string> = Object.fromEntries(NUT_ROWS.map(([k, , u]) => [k as string, u]))
const NAME: Record<string, string> = Object.fromEntries(NUT_ROWS.map(([k, n]) => [k as string, n]))
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100))

/** ★ 세션79(제이 23:05) — 포장지 기준 머리말: «190ml당» · «총 내용량 500ml당» · «100g당». */
export function labelHeader(l: Pick<MsLabelNutrition, 'basis' | 'amount' | 'unit'>): string {
  if (l.basis === 'per_total') return `총 내용량 ${fmt(l.amount)}${l.unit}당`
  if (l.basis === 'per_100g' || l.basis === 'per_100ml') return `100${l.unit}당`
  return `${fmt(l.amount)}${l.unit}당`
}

export interface LabelNutritionView { header: string; rows: string[]; secondary: string | null }

/**
 * 포장지에 인쇄된 숫자 «그대로»(다시 계산하지 않는다). 상한값 키는 «이하».
 * secondary = 라벨 기준이 100 이 아닐 때만 «100ml당 39.5kcal»(비교용 · 소수 1자리).
 */
export function labelNutritionView(l: MsLabelNutrition | null | undefined, per100?: Partial<Record<string, number | null>> | null): LabelNutritionView | null {
  if (!l || !l.values || !(l.amount > 0)) return null
  const ub = new Set(l.upper_bound ?? [])
  const rows = NUT_ROWS.flatMap(([k]) => {
    const v = l.values[k as string]
    return typeof v === 'number' && Number.isFinite(v) ? [`${NAME[k as string]} ${fmt(v)}${UNIT[k as string]}${ub.has(k as string) ? ' 이하' : ''}`] : []
  })
  if (!rows.length) return null
  const is100 = l.basis === 'per_100g' || l.basis === 'per_100ml'
  const kc = per100 && typeof per100.calories === 'number' ? per100.calories : null
  return { header: labelHeader(l), rows, secondary: !is100 && kc != null ? `100${l.unit}당 ${Math.round(kc * 10) / 10}kcal` : null }
}

export interface SupplementView {
  title: string
  warning: string
  allergens: { contains: string[]; mayContain: string[]; collectedLabel: string | null } | null
  nutrition: { basisLabel: string | null; rows: Array<{ label: string; value: number; unit: string }>; collectedLabel: string | null; label: LabelNutritionView | null } | null
}

/** 바코드 조회 응답의 보충 블록 → 화면 모델. 보여줄 것이 없으면 null(값 없는 행은 만들지 않는다 · 0 은 «있음»). */
export function supplementView(result: Pick<MsProductResult, 'web_label_supplements'> | null | undefined): SupplementView | null {
  const s = result?.web_label_supplements
  if (!s) return null
  const a = s.allergens && (s.allergens.contains.length || s.allergens.may_contain.length)
    ? { contains: [...s.allergens.contains], mayContain: [...s.allergens.may_contain], collectedLabel: s.allergens.collected_label ?? null } : null
  let n: SupplementView['nutrition'] = null
  if (s.nutrition) {
    const rows = NUT_ROWS.flatMap(([k, label, unit]) => {
      const v = (s.nutrition as Record<string, unknown>)[k]
      const ub = (s.nutrition?.upper_bound ?? []).includes(k as string)
      return typeof v === 'number' && Number.isFinite(v) ? [{ label, value: v, unit: ub ? `${unit} 이하` : unit }] : []
    })
    if (rows.length) n = { basisLabel: s.nutrition.basis ? (BASIS_LABEL[s.nutrition.basis] ?? null) : null, rows, collectedLabel: s.nutrition.collected_label ?? null, label: labelNutritionView(s.nutrition.label ?? null, s.nutrition as unknown as Record<string, number | null>) }
  }
  if (!a && !n) return null
  return { title: WEB_SUPPLEMENT_TITLE, warning: (s.warning || '').trim() || WEB_LABEL_WARNING, allergens: a, nutrition: n }
}
