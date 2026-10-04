/**
 * ★ 세션75d — 「내가 보낸 제보」 한 건 상세 — 서버 `GET /api/contributions/mine/:id` 의 readback 정규화(순수).
 *
 * 왜 (제이 실물 2026-10-04): 목록 카드를 누르면 제품 화면으로 갔는데, 제보는 «승인 전까지 제품에 반영되지 않아»
 *   (세션66 C6) 거기엔 아무것도 없었다 → 「카드는 있는데 내용이 안 보인다」. 이제 «내가 보낸 것»을 그대로 보여 준다.
 * ★ 값을 고치지 않는다(읽힌 그대로) · 숫자 아닌 영양값은 버린다(0 은 남긴다) · 없는 칸은 비워 둔다.
 */
export interface ContributionDetail {
  id: number
  createdAt: string | null
  status: string | null
  /** 사람이 아직 확인하지 않았다 — 그래서 제품 화면엔 아직 없다. */
  pending: boolean
  barcode: string | null
  productName: string | null
  foodType: string | null
  content: string | null
  ingredientsText: string | null
  ingredients: string[]
  allergens: { contains: string[]; inferred: string[]; mayContain: string[] } | null
  additives: string[]
  nutrition: { basis: string; basisAmount: number | null; values: Record<string, number> } | null
  nutritionStatus: string | null
}

export const DETAIL_PENDING_NOTE =
  '아직 관리자 확인 전이라 제품 화면에는 반영되지 않았어요. 아래는 보내신 사진에서 읽은 그대로예요.'
export const DETAIL_TITLE = '내가 보낸 내용'
export const DETAIL_LOAD_ERROR = '보낸 내용을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'

const NUT_ORDER: [string, string, string][] = [
  ['calories', '열량', 'kcal'], ['sodium', '나트륨', 'mg'], ['total_carbs', '탄수화물', 'g'], ['total_sugars', '당류', 'g'],
  ['total_fat', '지방', 'g'], ['trans_fat', '트랜스지방', 'g'], ['saturated_fat', '포화지방', 'g'],
  ['cholesterol', '콜레스테롤', 'mg'], ['protein', '단백질', 'g'], ['dietary_fiber', '식이섬유', 'g'],
]

const s = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(s).filter((x): x is string => !!x) : [])

export function normalizeContributionDetail(raw: unknown): ContributionDetail | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = n(r.contribution_id)
  if (id === null) return null
  const rb = (r.readback && typeof r.readback === 'object' ? r.readback : {}) as Record<string, unknown>
  const al = rb.allergens && typeof rb.allergens === 'object' ? rb.allergens as Record<string, unknown> : null
  let nutrition: ContributionDetail['nutrition'] = null
  const nu = rb.nutrition && typeof rb.nutrition === 'object' ? rb.nutrition as Record<string, unknown> : null
  if (nu && nu.values && typeof nu.values === 'object') {
    const values: Record<string, number> = {}
    for (const [k, v] of Object.entries(nu.values as Record<string, unknown>)) { const x = n(v); if (x !== null) values[k] = x }
    if (Object.keys(values).length) nutrition = { basis: s(nu.basis) ?? 'unknown', basisAmount: n(nu.basis_amount), values }
  }
  const tc = n(rb.total_content)
  const status = s(r.status)
  return {
    id, createdAt: s(r.created_at), status, pending: status === null || status === 'pending',
    barcode: s(r.barcode), productName: s(rb.product_name) ?? s(r.product_name), foodType: s(rb.food_type),
    content: tc !== null ? `${tc}${s(rb.content_unit) ?? ''}` : null,
    ingredientsText: s(rb.ingredients_text), ingredients: list(rb.ingredients),
    allergens: al ? { contains: list(al.contains), inferred: list(al.inferred), mayContain: list(al.may_contain) } : null,
    additives: list(rb.additives), nutrition, nutritionStatus: s(rb.nutrition_status),
  }
}

export function detailNutritionRows(d: ContributionDetail): { key: string; label: string; text: string }[] {
  if (!d.nutrition) return []
  return NUT_ORDER.filter(([k]) => k in d.nutrition!.values)
    .map(([k, label, unit]) => ({ key: k, label, text: `${Math.round(d.nutrition!.values[k] * 10) / 10} ${unit}` }))
}

export function basisLabel(basis: string, amount: number | null): string {
  switch (basis) {
    case 'per_100g': return '100g 기준'
    case 'per_100ml': return '100ml 기준'
    case 'per_serving': return amount ? `1회 제공량(${amount}) 기준` : '1회 제공량 기준'
    case 'per_total': return amount ? `총 내용량(${amount}) 기준` : '총 내용량 기준'
    default: return '기준 확인 못 함'
  }
}
