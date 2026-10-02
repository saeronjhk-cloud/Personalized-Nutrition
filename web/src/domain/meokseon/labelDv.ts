/**
 * ★ 세션73 U71-3 — 라벨에 «인쇄된» 1일 기준치 비율(%)과 우리 계산 %를 함께 보여 준다(제이 방향 「병기」 · 세션71).
 *   서버 `nutrition.label_dv = {basis, items:{key:{label_pct, our_pct, agree}}}` (labelDvCheck.buildLabelDv).
 *   ⚠ 이 %는 «라벨의 기준»(예: 총 내용량 80g)이다. 위 영양 표의 양(1회 제공량 등)과 기준이 다를 수 있으므로
 *     표에 섞지 않고 «따로» 보여 주고, 기준을 반드시 함께 말한다.
 *   ⚠ 라벨 %와 계산이 다르면 둘 다 보여 주고 판단은 사용자 몫 — 어느 쪽도 «고치지» 않는다(P1).
 */
export interface LabelDvItem { label_pct: number; our_pct: number | null; agree: boolean | null }
export interface LabelDv { basis: string | null; items: Record<string, LabelDvItem> }

const ORDER: [string, string][] = [
  ['sodium', '나트륨'], ['total_carbs', '탄수화물'], ['total_sugars', '당류'], ['total_fat', '지방'],
  ['saturated_fat', '포화지방'], ['cholesterol', '콜레스테롤'], ['protein', '단백질'],
]

export interface LabelDvRow { key: string; label: string; labelPct: number; ourPct: number | null; differs: boolean }
export interface LabelDvView { caption: string; rows: LabelDvRow[]; differCount: number }

/** 라벨 기준 → 사람이 읽는 말. 모르면 「라벨 표기 기준」(지어내지 않는다). */
export function basisPhrase(basis: string | null | undefined, product?: { total_content?: number | null; content_unit?: string | null; serving_size?: number | null } | null): string {
  const amt = (n: unknown, u: unknown) => (typeof n === 'number' && n > 0 ? `${n}${typeof u === 'string' && u ? u : ''}` : '')
  switch (basis) {
    case 'per_total': { const a = amt(product?.total_content, product?.content_unit); return a ? `총 내용량 ${a} 기준` : '총 내용량 기준' }
    case 'per_serving': return '1회 제공량 기준'
    case 'per_100g': return '100g 기준'
    case 'per_100ml': return '100ml 기준'
    default: return '라벨 표기 기준'
  }
}

/** 순수 — 서버 값 → 화면 모델. 보여 줄 것이 없으면 null. 테스트 대상. */
export function describeLabelDv(v: unknown, product?: { total_content?: number | null; content_unit?: string | null } | null): LabelDvView | null {
  if (!v || typeof v !== 'object') return null
  const lv = v as Partial<LabelDv>
  const items = lv.items && typeof lv.items === 'object' ? lv.items : null
  if (!items) return null
  const rows: LabelDvRow[] = []
  for (const [key, label] of ORDER) {
    const it = (items as Record<string, LabelDvItem>)[key]
    if (!it || typeof it.label_pct !== 'number' || !Number.isFinite(it.label_pct)) continue
    const ourPct = typeof it.our_pct === 'number' && Number.isFinite(it.our_pct) ? it.our_pct : null
    rows.push({ key, label, labelPct: it.label_pct, ourPct, differs: it.agree === false })
  }
  if (!rows.length) return null
  return {
    caption: `라벨에 인쇄된 1일 영양성분 기준치 비율 · ${basisPhrase(lv.basis ?? null, product)}`,
    rows,
    differCount: rows.filter((r) => r.differs).length,
  }
}

export const LABEL_DV_DIFFER_NOTE = '라벨의 %가 표시된 양으로 계산한 값과 달라요. 두 값을 함께 보여 드려요.'
