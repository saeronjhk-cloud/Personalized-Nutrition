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

/**
 * 알레르기 3분리. 서버가 세션44부터 계산해 왔고 응답에도 실려 있었지만
 * 이 클라이언트는 «필드의 존재조차 몰랐다»(2026-08-06 확인 — 인터페이스에 아예 없었다).
 *   contains   직접 함유 — 라벨이 명시적으로 선언한 것
 *   inferred   원재료 추정 — 원재료명에서 읽어낸 것(실제로 들어 있다)
 *   mayContain 혼입 가능 — 같은 제조시설·라인. 제품에 «직접» 들어 있다는 뜻이 아니다
 */
export interface MsAllergensV2 {
  contains?: string[] | null
  inferred?: string[] | null
  mayContain?: string[] | null
}

export interface MsProductResult {
  product: MsProduct
  nutrition: MsNutrition | null
  traffic_light?: MsTrafficLight | null
  /**
   * 평탄 목록 = contains + inferred. **혼입은 들어 있지 않다.**
   * ⚠ `null` 은 「없음」이 아니라 「미수집」이다. `allergens_available` 로 구분할 것.
   */
  allergens?: string[] | null
  allergens_v2?: MsAllergensV2 | null
  /** false = 이 제품의 알레르기 정보를 «수집하지 못했다». 「알레르겐 없음」과 다르다. */
  allergens_available?: boolean
  /** false = flat 목록이 전부가 아니다(혼입이 따로 있다). */
  allergens_flat_complete?: boolean
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

/* ──────────────────────────────────────────────────────────────────────────
 * 사진 제보 (POST /api/ocr/multi-photo)
 *
 * 왜 생겼나 (2026-08-06 발견):
 *   미등록 바코드 화면이 "제품 앞면과 영양성분·원재료 표기를 찍어 보내주시면 검토 후
 *   등록해 드릴게요" 라고 «약속»하면서, 그 아래 「이 제품 제보하기」 버튼은
 *   `setReported(true)` 로 로컬 상태만 바꾸고 **서버에 아무것도 보내지 않았다.**
 *   그러고는 「제보 감사합니다!」를 띄웠다 — 사용자를 향한 거짓 확인이다.
 *   서버(`meokseon-server`)에는 이 엔드포인트가 처음부터 완비돼 있었다. 화면만 안 붙어 있었다.
 *
 * 서버 계약 (src/routes/ocrRoutes.js:457):
 *   multipart/form-data
 *     label_image      (선택) 제품 앞면·원재료·알레르기 표기 사진
 *     nutrition_image  (선택) 영양성분표 사진
 *     ★ 둘 중 «하나 이상»은 필수. 없으면 400.
 *     barcode          (선택) 등록 시 키가 된다
 *     save             'true' 면 크라우드 기여로 저장한다
 *   응답 { success, data: { analysis, traffic_light, save_result, ... } }
 *   ⚠ 파일당 10MB 제한(multer). 초과하면 서버가 아니라 미들웨어가 막는다.
 *
 * ★ 두 사진은 «합집합»으로 병합된다(세션44 치명B 수정분). 법정 알레르기 표기가
 *   영양성분표 옆에 인쇄된 제품이 흔해서, 한 장만 보내면 경고를 잃는다.
 *   → UI 는 두 장 다 받도록 유도하되, 한 장만으로도 보낼 수 있어야 한다.
 * ────────────────────────────────────────────────────────────────────────── */

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

/**
 * ★★★★ 세션61 `U60-7`/`U61-4` — 이 타입은 **알레르기 3키를 버리고 있었다.**
 *
 *   서버는 사진 제보 응답(`/api/ocr/multi-photo`)에도 바코드 경로와 «똑같이»
 *   `allergens` · `allergens_v2` · `allergens_available` · `allergens_flat_complete` 를
 *   실어 보낸다 (`meokseon-server/src/routes/ocrRoutes.js:724` → `buildAllergenKeys`).
 *   그런데 이 클라이언트는 `analysis.allergens`(flat) «하나»만 꺼내 썼다.
 *
 *   그 결과 화면(`Scan.tsx`)이 목록이 비면 **아무 말도 안 했다**. 침묵이다.
 *   `domain/meokseon/allergens.ts:15` 가 바로 그걸 경고한다 —
 *   「아무 표시도 안 하면 사용자는 «안전하다»고 읽는다」.
 *
 *   실측(세션61 · 실물 67건): 목록이 비는 라벨 **24건(35.8%)**, 그중
 *     · 실제로 «직접 함유»가 있는 것      **7건 (29.2%)**
 *     · 혼입까지 세면 알려줄 게 있는 것   **15건 (62.5%)**
 *   같은 24건을 바코드 경로로 보면 **전부** 무언가를 말해 준다(13건 「확인 못 함」 + 11건 혼입).
 *   ⇒ 설계가 없었던 게 아니라 **한쪽 경로에만 배선돼 있었다.**
 *
 * ⚠ 이 세 필드를 다시 «지우지» 말 것. 지우는 순간 화면이 도로 침묵한다.
 * ⚠ `raw` 에 `data` 전체가 이미 들어 있었지만, 그건 «타입이 없는» 통로다.
 *   화면이 안전하게 읽으려면 이렇게 «이름 붙은 필드»여야 한다.
 */
export interface MsPhotoReportResult {
  /** 서버가 크라우드 기여로 «실제로» 저장했는가. false 면 분석만 된 것이다. */
  saved: boolean
  productName: string | null
  /** 값이 읽힌 영양소 개수(0 이면 영양표를 못 읽은 것) */
  nutritionCount: number
  /** 평탄 목록 = contains + inferred. ⚠ **혼입은 들어 있지 않다.** */
  allergens: string[]
  allergens_v2?: MsAllergensV2 | null
  /**
   * ⚠ OCR 경로에서 `true` 의 뜻은 「**읽어낸 텍스트에서** 선언란을 봤다」이지
   * 「라벨 전체를 봤다」가 «아니다». 서버 주석 `ocrRoutes.js:174~179` 참조.
   * ⇒ 이 값이 true 라고 해서 불완전성 고지를 내리면 안 된다.
   */
  allergens_available?: boolean
  /** false = flat 목록이 전부가 아니다(혼입이 따로 있다). */
  allergens_flat_complete?: boolean
  raw: unknown
}

export async function submitPhotoReport(params: {
  barcode?: string | null
  labelImage?: File | null
  nutritionImage?: File | null
}): Promise<MsPhotoReportResult> {
  if (!BASE) throw new Error('먹선 API URL 미설정(VITE_MEOKSEON_API_URL)')

  const { barcode, labelImage, nutritionImage } = params
  if (!labelImage && !nutritionImage) {
    throw new Error('사진을 한 장 이상 골라 주세요.')
  }
  for (const f of [labelImage, nutritionImage]) {
    if (f && f.size > MAX_IMAGE_BYTES) {
      throw new Error(`사진이 너무 커요(${(f.size / 1024 / 1024).toFixed(1)}MB). 10MB 이하로 다시 찍어 주세요.`)
    }
  }

  const fd = new FormData()
  if (labelImage) fd.append('label_image', labelImage)
  if (nutritionImage) fd.append('nutrition_image', nutritionImage)
  if (barcode) fd.append('barcode', barcode)
  fd.append('save', 'true')

  const res = await fetch(`${BASE}/api/ocr/multi-photo`, { method: 'POST', body: fd })

  let json: any = null
  try { json = await res.json() } catch { /* 비-JSON 응답 */ }

  if (!res.ok || !json || json.success !== true) {
    const msg = (json && (json.message || json.error?.message)) || `서버 오류(${res.status})`
    throw new Error(msg)
  }

  const data = json.data || {}
  const analysis = data.analysis || {}
  const nutrition = analysis.nutrition || {}
  const nutritionCount = Object.keys(nutrition).filter((k) => {
    const v = (nutrition as Record<string, unknown>)[k]
    return v !== null && v !== undefined && v !== ''
  }).length

  return {
    // ★ save_result 가 있어야 «저장됐다». 분석만 되고 저장이 안 될 수 있다(게이트 반려 등).
    saved: !!data.save_result,
    productName: (analysis.product_meta && analysis.product_meta.product_name) || null,
    nutritionCount,
    allergens: Array.isArray(analysis.allergens) ? analysis.allergens : [],
    // ★★★ 세션61 U60-7 — 서버가 이미 보내 주던 3키. 여기서 버리면 화면이 침묵한다.
    //   ⚠ `?? null` 로 «명시적 null» 을 만든다. `undefined` 로 두면 화면이
    //     「필드가 없다」와 「서버가 없다고 했다」를 구분할 수 없다.
    allergens_v2: analysis.allergens_v2 ?? null,
    allergens_available: analysis.allergens_available,
    allergens_flat_complete: analysis.allergens_flat_complete,
    raw: data,
  }
}
