/**
 * ★ 세션80 결정 80-1 — 식약처 K-FIND(식품영양성분 DB) 품목 표시 규칙(순수 함수 · 문구 정본).
 *   정답 backends/먹선/IP/eval_kfind_expose_v1/cases_v1.json (wording · R7 · R8) = __tests__/fixtures/kfind_expose_v1.json
 *   ⚠ 배지·경고·출처 문구는 서버 값을 «그대로» 쓴다(서버 productService.KFIND_* 정본). 비어 있을 때만 아래 기본값.
 *   ⚠ 알레르기·원재료가 «없는» 자료다 — 화면은 «없음»이 아니라 «정보 없음»으로 말한다(AllergenCard 의 미수집 경로).
 */
import type { MsProductResult } from '../../lib/meokseon'

export const KFIND_BADGE = '식약처 영양성분 DB · 바코드·원재료 정보 없음'
export const KFIND_WARNING = '영양성분만 있는 공공 데이터예요. 알레르기와 원재료는 실물 포장을 확인하세요.'
export const KFIND_SOURCE_LABEL = '출처: 식품의약품안전처 식품영양성분 데이터베이스'
export const KFIND_SUPPLEMENT_BADGE = '식약처 영양성분 DB 보충'
export const KFIND_NUTRITION_OFF_NOTE = '영양 수치가 열량 계산과 맞지 않아 신호등을 표시하지 않아요. 수치는 참고만 해 주세요.'
export const KFIND_RESULTS_TITLE = '식약처 영양성분 DB 품목 · 영양정보만 있어요(바코드·원재료 없음)'

export interface KfindNotice { badgeLine: string; warning: string; sourceLine: string; originLine: string | null; nutritionOff: boolean }

/** K-FIND 품목이면 상단 고정 고지, 아니면 null. */
export function kfindNotice(result: Pick<MsProductResult, 'kfind'> | null | undefined): KfindNotice | null {
  const k = result?.kfind
  if (!k) return null
  const badge = (k.badge || '').trim() || KFIND_BADGE
  const src = (k.source_label || '').trim() || KFIND_SOURCE_LABEL
  const origin = k.is_imported
    ? ['수입', k.origin_country, k.importer ? `수입 ${k.importer}` : null].filter(Boolean).join(' · ')
    : null
  return {
    badgeLine: badge,
    warning: (k.warning || '').trim() || KFIND_WARNING,
    sourceLine: k.release_label ? `${src} (${k.release_label})` : src,
    originLine: origin || null,
    nutritionOff: k.nutrition_ok === false,
  }
}

const ROWS: Array<[string, string, string]> = [
  ['calories', '열량', 'kcal'], ['sodium', '나트륨', 'mg'], ['total_carbs', '탄수화물', 'g'], ['total_sugars', '당류', 'g'],
  ['total_fat', '지방', 'g'], ['trans_fat', '트랜스지방', 'g'], ['saturated_fat', '포화지방', 'g'], ['cholesterol', '콜레스테롤', 'mg'],
  ['protein', '단백질', 'g'], ['dietary_fiber', '식이섬유', 'g'],
]
const BASIS: Record<string, string> = { per_100g: '100g당', per_100ml: '100ml당' }

export interface KfindSupplementView { title: string; sourceLine: string; basisLabel: string | null; rows: Array<{ label: string; value: number; unit: string }> }

/** 판매처 품목의 K-FIND 보충(R8) → 화면 모델. 값 없는 행은 만들지 않는다(0 은 «있음»). 보여줄 것이 없으면 null. */
export function kfindSupplementView(result: (Pick<MsProductResult, 'web_label'> & Partial<Pick<MsProductResult, 'kfind_supplement'>>) | null | undefined): KfindSupplementView | null {
  // ★ 세션82 결정 ⑧ — 판매처 품목(web_label.kfind_supplement)이 우선, 없으면 바코드 응답의 사진 제보 보충(최상위 kfind_supplement).
  const s = result?.web_label?.kfind_supplement ?? result?.kfind_supplement
  if (!s || !s.nutrition) return null
  const rows = ROWS.flatMap(([k, label, unit]) => {
    const v = (s.nutrition as Record<string, unknown>)[k]
    return typeof v === 'number' && Number.isFinite(v) ? [{ label, value: v, unit }] : []
  })
  if (!rows.length) return null
  const src = (s.source_label || '').trim() || KFIND_SOURCE_LABEL
  return {
    title: (s.badge || '').trim() || KFIND_SUPPLEMENT_BADGE,
    sourceLine: s.release_label ? `${src} (${s.release_label})` : src,
    basisLabel: s.nutrition.basis ? (BASIS[s.nutrition.basis] ?? null) : null,
    rows,
  }
}

/** 바코드가 없는 품목(판매처 라벨·K-FIND)인가 — 스캔 이력·제보·결손 카드 경로를 닫는 데 쓴다. */
export function isNoBarcodeItem(result: Pick<MsProductResult, 'web_label' | 'kfind'> | null | undefined): boolean {
  return !!(result && (result.web_label || result.kfind))
}
