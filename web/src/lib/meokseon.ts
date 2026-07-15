// 먹선(가공식품 온톨로지) 공개 API 클라이언트.
// 무료 후킹(스캔->객관 팩트)은 무인증 공개 엔드포인트만 사용(개인정보 무관).
//   GET /api/products/:barcode         제품+영양+신호등+첨가물(mfras)
//   GET /api/products/:barcode/additives 첨가물 위해성 요약
//   GET /api/products/search?q=         이름 검색
// 배포 URL은 VITE_MEOKSEON_API_URL(Railway). CORS는 먹선 서버 기본 '*'.
// 소비 대상은 resolved 소비 계층(productModel) — candidate 미노출(통합 안전).

// BASE 정규화: 스킴이 없으면 https:// 자동 부여(스킴 누락 시 상대URL로 해석돼
//   dev 서버 SPA fallback(HTML)을 받아 조용히 깨지는 footgun 방지). 후행 슬래시 제거.
function normalizeBase(raw: string): string {
  const v = (raw || '').trim().replace(/\/+$/, '')
  if (!v) return ''
  if (/^https?:\/\//i.test(v)) return v
  return `https://${v}`
}
const BASE = normalizeBase(import.meta.env.VITE_MEOKSEON_API_URL || '')

export interface MsProduct {
  product_id: number
  barcode: string
  product_name: string
  brand?: string | null
  manufacturer?: string | null
  food_type?: string | null
  food_category?: string | null
  serving_size?: number | null
  total_content?: number | null
  content_unit?: string | null
  image_url?: string | null
  data_source?: string | null
}

export interface MsNutrition {
  calories?: number | null
  total_fat?: number | null
  saturated_fat?: number | null
  trans_fat?: number | null
  cholesterol?: number | null
  sodium?: number | null
  total_carbs?: number | null
  total_sugars?: number | null
  dietary_fiber?: number | null
  protein?: number | null
  source?: string | null
  off_grade?: string | null
  confidence?: string | null
  source_license?: string | null
}

// 먹선 신호등(정본 판정). 개인화는 이 색을 "소비"만 하고 자체 임계를 만들지 않는다.
//   color: green/yellow/red = 판정됨, null = 판정 없음(회색/결측) — "안전"이 아님(절대 안전 취급 금지).
//   basis: 'pct_dv' | 'per_100g' | 'per_100ml' | 'racc_*' | 'absolute' 등(판정 근거).
export type TrafficLightColor = 'green' | 'yellow' | 'red' | null
export interface MsTrafficLightNutrient {
  color: TrafficLightColor
  pct_dv?: number | null
  per_100?: number | null
  amount?: number | null
  basis?: string | null
  data?: 'present' | 'missing' | string
  tooltip?: string | null
}
export interface MsTrafficLight {
  // keys: sodium, sugars, sat_fat, total_fat, cholesterol, protein, fiber, trans_fat
  nutrients?: Record<string, MsTrafficLightNutrient | null>
  [k: string]: unknown
}

export interface MsProductResult {
  product: MsProduct
  nutrition: MsNutrition | null
  traffic_light?: MsTrafficLight | null
  mfras?: unknown
  context?: unknown
  sources?: unknown
  data_freshness?: unknown
}

export interface MsAdditiveSummary {
  product_id: number
  product_name: string
  additives: Array<Record<string, unknown>>
  risk_summary: {
    total: number
    by_color: { green: number; yellow: number; orange: number; red: number }
    with_v2_data: number
  }
}

export interface MsSearchItem {
  product_id: number
  barcode?: string
  product_name: string
  brand?: string | null
  manufacturer?: string | null
  food_type?: string | null
  food_category?: string | null
  image_url?: string | null
}

/** 제품 미등록(404). 콜드스타트 폴백 분기용. */
export class MeokseonNotFound extends Error {}

export function meokseonConfigured(): boolean {
  return !!BASE
}

async function getJson(path: string): Promise<any> {
  if (!BASE) throw new Error('먹선 API URL 미설정(VITE_MEOKSEON_API_URL)')
  const res = await fetch(`${BASE}${path}`)
  if (res.status === 404) throw new MeokseonNotFound('제품 미등록')
  if (!res.ok) throw new Error(`먹선 API 오류: ${res.status}`)
  const json = await res.json()
  if (!json || json.success !== true) throw new Error('먹선 API 응답 형식 오류')
  return json.data
}

// 먹선 서버는 PostgreSQL numeric 컬럼을 "문자열"로 반환한다(node-pg 기본).
// 클라이언트 경계에서 숫자로 정규화 — 영양 표시·개인화·이력 전부 실수치 확보.
const MS_NUM_FIELDS: (keyof MsNutrition)[] = [
  'calories', 'total_fat', 'saturated_fat', 'trans_fat', 'cholesterol',
  'sodium', 'total_carbs', 'total_sugars', 'dietary_fiber', 'protein',
]
function coerceNum(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') { const n = Number(v); return Number.isFinite(n) ? n : null }
  return null
}
function normalizeNutrition(n: MsNutrition | null | undefined): MsNutrition | null {
  if (!n) return n ?? null
  const out: MsNutrition = { ...n }
  for (const k of MS_NUM_FIELDS) (out as any)[k] = coerceNum(n[k])
  return out
}

export async function getProduct(barcode: string): Promise<MsProductResult> {
  const data = (await getJson(`/api/products/${encodeURIComponent(barcode)}`)) as MsProductResult
  if (data) data.nutrition = normalizeNutrition(data.nutrition)
  return data
}

export async function getAdditiveSummary(barcode: string): Promise<MsAdditiveSummary> {
  return await getJson(`/api/products/${encodeURIComponent(barcode)}/additives`)
}

export async function searchProducts(q: string, limit = 20): Promise<MsSearchItem[]> {
  const data = await getJson(`/api/products/search?q=${encodeURIComponent(q)}&limit=${limit}`)
  return (data && data.products) || []
}
