import { getDeviceId } from './deviceId'
import { getMeokseonAccessToken } from './meokseonAuth'
import { normalizeContributionPage, type MyContributionPage } from '../domain/meokseon/contributions'
import { classifyAuthFailure, type MeokseonAuthCode } from '../domain/meokseon/reportAuth'

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

/**
 * ★ 무인증 GET. **여기에 `Authorization` 을 붙이지 말 것.**
 *   제품 조회(`/api/products/*` · `/search`)는 세션64c 이후에도 «무인증 유지»다
 *   (서버 담당과 동일 확정). 스캔 앞에 로그인 벽을 세우면 무료 후킹이 통째로 죽는다.
 */
async function getJson(path: string): Promise<any> {
  if (!BASE) throw new Error('먹선 API URL 미설정(VITE_MEOKSEON_API_URL)')
  const res = await fetch(`${BASE}${path}`)
  if (res.status === 404) throw new MeokseonNotFound('제품 미등록')
  if (!res.ok) throw new Error(`먹선 API 오류: ${res.status}`)
  const json = await res.json()
  if (!json || json.success !== true) throw new Error('먹선 API 응답 형식 오류')
  return json.data
}

/* ──────────────────────────────────────────────────────────────────────────
 * 인증 — 제보 계열 전용 (세션64c · 2026-08-24 제이 확정 「제보도 로그인 필수」)
 *
 * ★ 계약(서버 담당과 «동일». 임의로 바꾸지 말 것)
 *     헤더   `Authorization: Bearer <supabase access token>`
 *     401    `{ success:false, error:{ code:'AUTH_REQUIRED'|'AUTH_INVALID', message:'<한국어>' } }`
 *   인증 필수: POST /api/ocr/multi-photo · POST /api/ocr/confirm · GET /api/contributions/mine
 *   무인증  : GET /api/products/* · /search   ← **스캔은 종전대로 로그인 없이 된다**
 *
 * ⚠ 2026-08-24 기준 서버의 이 배선은 **구현 중**이다. 이 파일과 테스트는 목(mock) 기반이고
 *   실제 왕복은 확인하지 못했다.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * 인증 실패. **코드를 잃지 않는다** — 「로그인 안 됨」과 「토큰 만료」는 문구가 다르다.
 * 문구 판정은 `domain/meokseon/reportAuth.ts:classifyAuthFailure` 가 한다(여기서 하지 않는다).
 */
export class MeokseonAuthError extends Error {
  code: MeokseonAuthCode
  /** 서버가 준 한국어 원문. 없으면 null — 화면에는 쓰지 않고 진단용으로만 보존한다. */
  serverMessage: string | null
  constructor(rawCode: unknown, rawMessage?: unknown) {
    const f = classifyAuthFailure(rawCode, rawMessage)
    super(f.message)
    this.name = 'MeokseonAuthError'
    this.code = f.code
    this.serverMessage = f.serverMessage
  }
}

/**
 * Bearer 헤더. 토큰이 없으면 **요청을 보내지 않고** 던진다.
 *
 * ★ 왜 미리 막는가 — 사진 두 장을 업로드해 놓고 401 을 받으면 사용자의 데이터 요금만 쓰고
 *   결과는 같다. 서버 401 은 최후의 방어선이지 1차 방어선이 아니다
 *   (`photoReport.ts:confirmPhotoReport` 의 제품명 검사와 같은 관용구).
 */
async function authHeaders(): Promise<Record<string, string>> {
  const token = await getMeokseonAccessToken()
  if (!token) throw new MeokseonAuthError('AUTH_REQUIRED')
  return { Authorization: `Bearer ${token}` }
}

/**
 * 401 이면 던진다. **다른 오류 분류보다 «먼저»** 불러야 한다 —
 * 뒤에 두면 401 이 `MeokseonConfirmError('other')` 로 뭉개져 「잠시 후 다시 시도해 주세요」가
 * 나가고, 사용자는 로그인하면 될 일을 영영 모른다.
 */
function throwIfUnauthorized(res: { status: number }, json: any): void {
  if (res.status !== 401) return
  throw new MeokseonAuthError(json?.error?.code, json?.error?.message ?? json?.message)
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
 *     label_image      (선택) 원재료·알레르기 표기 사진
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
 *
 * ★★★★ 세션64 (2026-08-21) — **한 번에 저장하던 것을 두 단계로 나눴다.**
 *
 *   종전 `submitPhotoReport()` 는 `save='true'` 로 «분석과 저장을 한 번에» 했다.
 *   그런데 제보 사진 두 장(원재료·영양표)에는 **제품명이 없는 경우가 많다** —
 *   실물 67건 실측: 라벨에 제품명이 인쇄된 것 40건(59.7%), OCR 로 쓸 수 있는 값 33건(49.3%).
 *   앱에는 제품명 입력란이 «아예 없었고» `product_info` 를 보내지도 않아서,
 *   서버가 이름을 모르면 **첫 원재료명(「정제수」)이 제품명으로 저장**됐다.
 *   화면은 「제품명 미인식」이라고 말하는데 DB 에는 「정제수」가 들어갔다 — 화면과 DB 가 어긋났다.
 *
 *   제이 결정: ① 제품명은 사용자 입력으로 받는다(OCR 은 자동채움) ② 없으면 저장 거부.
 *   ⇒ 저장 시점에 «사람이 확정한 이름»이 반드시 있어야 하므로 호출이 둘로 갈라진다.
 *
 *     1단계  analyzePhotoReport()   POST /api/ocr/multi-photo  save='false'
 *            → data.analysis_token (문자열, TTL 10분)
 *     2단계  confirmPhotoReport()   POST /api/ocr/confirm      JSON
 *            → { analysis_token, product_info: { product_name } }
 *            → 400 = 거부(서버 한국어 사유 그대로) · 410 = 토큰 만료(1단계 복귀)
 *
 *   ⚠ 두 함수를 다시 하나로 합치지 말 것. 「파라미터만 늘린 한 함수」로 만들면
 *     호출 의미(분석 vs 저장)가 섞여서, 저장 의도가 없는 호출이 조용히 저장하게 된다.
 *   ⚠ 2026-08-21 기준 서버에 `/confirm` · `analysis_token` 은 **아직 없다**(구현 중).
 *     실기기 통합 확인이 남아 있다.
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
export interface MsPhotoAnalysis {
  /**
   * ★ 세션64 — 2단계(`confirmPhotoReport`)에 그대로 넘길 토큰. 서버 TTL 10분.
   *   ⚠ `?? null` 로 «명시적 null» 을 만든다. 없으면 **저장할 방법이 없다** —
   *     화면은 「보내기」를 막고 이유를 말해야 한다. 조용히 저장을 건너뛰면 안 된다.
   */
  analysisToken: string | null
  /**
   * OCR 이 읽은 제품명. ⚠⚠ **이건 정본이 아니다.**
   *   정본은 «사용자 입력란의 값»이다(제이 결정 ①). 이 값은 입력란 자동채움에만 쓴다.
   *   실측상 이 값이 쓸 만한 건 67건 중 33건(49.3%)뿐이다.
   */
  productName: string | null
  /** 값이 읽힌 영양소 «개수». ⚠ 세는 대상은 표시 대상 10종뿐이다(아래 parse 주석 참조). */
  nutritionCount: number
  /** 서버 `analysis.ingredient_count` (ocrRoutes.js:716). 못 읽었으면 0. */
  ingredientCount: number
  /** 서버 `analysis.additive_count` (ocrRoutes.js:718). 못 읽었으면 0. */
  additiveCount: number

  /* ── 세션64b 신설 — 「제보 직후에 결과를 돌려준다」 ──────────────────────────
   *
   * ★★ 서버는 이것들을 **처음부터 전부 보내고 있었다.** 이 파서가 개수만 뽑고 버렸다.
   *   제보자는 사진 두 장을 보내고 「감사합니다 · 원재료 12개」만 받았다.
   *   = 세션61 `U60-7`(알레르기 3키를 버리던 일)과 **정확히 같은 유형**의 소실이다.
   *
   * ⚠ 다시 지우지 말 것. 지우는 순간 화면이 도로 개수만 말한다.
   * ⚠ `raw` 에 이미 다 들어 있었지만 그건 «타입이 없는» 통로다. 화면이 안전하게 읽으려면
   *   이렇게 «이름 붙은 필드»여야 한다(같은 파일 위 U60-7 주석과 같은 이유).
   */

  /** 원재료명 목록(표시 순서 = 라벨 표기 순서). 못 읽었으면 빈 배열. */
  ingredients: MsPhotoIngredient[]
  /**
   * 첨가물 «행» 원본. `domain/meokseon/additives.ts:buildAdditiveList` 에 그대로 넘긴다.
   * ⚠ 바코드 경로의 행(`name_ko`·`mfras_grade`…)과 **모양이 다르다** —
   *   OCR 경로는 `{ name, category, raw, match_type }` 이다(`ocrParser.js:427`).
   *   그래서 등급·IARC·ADI 가 **없다**. `SHOW_RISK_GRADE` 가 꺼져 있어 화면은 이름과
   *   「일반적 용도」만 그리므로 두 경로가 같은 컴포넌트를 쓸 수 있다.
   */
  additives: Record<string, unknown>[]
  /** 읽어낸 영양 수치. 숫자로 좁혀져 있다(바코드 경로와 같은 정규화). */
  nutrition: MsNutrition | null
  /** 서버 파서의 표기 기준 원문(`analysis.nutrition._basis`). 'unknown' 일 수 있다. */
  nutritionBasis: string | null
  /**
   * 영양 신호등. ⚠ **이 값만 보고 화면에 색을 칠하지 말 것.**
   *   표기 기준을 모르면 색이 뒤집힌다 —
   *   판정은 `domain/meokseon/reportNutrition.ts:buildReportNutrition` 이 한다.
   */
  trafficLight: MsTrafficLight | null
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

/** 원재료 한 줄. 서버 `analysis.ingredients[]` (`ocrParser.js:2366`). */
export interface MsPhotoIngredient {
  name: string
  /** 「(호주산)」 등. 없으면 null. */
  origin: string | null
  /** 「12%」의 12. 없으면 null. */
  percentage: number | null
}

/** `analysis.ingredients` → 표시용. 이름이 없는 항목은 버린다(빈 줄을 그리지 않는다). */
function parseIngredients(raw: unknown): MsPhotoIngredient[] {
  if (!Array.isArray(raw)) return []
  const out: MsPhotoIngredient[] = []
  for (const r of raw) {
    // 문자열 배열로 오는 경우도 견딘다 — 서버 파서가 바뀌어도 목록이 «조용히» 비지 않게.
    if (typeof r === 'string') {
      const s = r.trim()
      if (s) out.push({ name: s, origin: null, percentage: null })
      continue
    }
    if (!r || typeof r !== 'object') continue
    const row = r as Record<string, unknown>
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    if (!name) continue
    const pct = typeof row.percentage === 'number' && Number.isFinite(row.percentage) ? row.percentage : null
    out.push({
      name,
      origin: (typeof row.origin === 'string' && row.origin.trim()) ? row.origin.trim() : null,
      percentage: pct,
    })
  }
  return out
}

/** 응답 `data` → 화면이 읽을 수 있는 이름 붙은 필드. 1단계 응답 파싱은 여기 «한 곳»이다. */
function parsePhotoAnalysis(data: any): MsPhotoAnalysis {
  const analysis = data?.analysis || {}
  const nutrition = analysis.nutrition || {}
  /**
   * ★★ 2026-08-23 세션64b — 세는 대상을 **표시 대상 10종으로 좁혔다.**
   *   종전에는 `Object.keys(nutrition)` 을 그냥 셌다. 그런데 서버 파서는 같은 객체에
   *   `_basis`·`_basis_amount`·`serving_size`·`serving_unit`·`total_content`·`content_unit`·
   *   `_calorie_noise_removed` 같은 **영양소가 아닌 키**를 함께 담는다(`ocrParser.js:905~945`).
   *   ⇒ 「영양성분 8개」라고 말해 놓고 표에는 5줄만 그려지는 상태였다.
   *     세션64b 에 수치 표를 «실제로 그리기» 시작하면서 그 어긋남이 화면에 드러난다.
   *   ⚠ 「개수를 늘려 보이게 하는 것」이 목적이 아니다. 화면이 그리는 것과 같은 것을 센다.
   */
  const nutritionCount = MS_NUM_FIELDS.filter((k) => {
    const v = (nutrition as Record<string, unknown>)[k as string]
    return v !== null && v !== undefined && v !== ''
  }).length
  const count = (v: unknown, fallback: unknown[]) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : (Array.isArray(fallback) ? fallback.length : 0)

  const token = data?.analysis_token
  return {
    // ⚠ 문자열이 아니면 «없는 것»으로 본다. 빈 문자열 토큰으로 저장을 시도하면 안 된다.
    analysisToken: typeof token === 'string' && token.trim() ? token : null,
    productName: (analysis.product_meta && analysis.product_meta.product_name) || null,
    nutritionCount,
    // 서버가 count 를 안 주면 배열 길이로 «대신 센다». 안 주는 게 「0개」는 아니다.
    ingredientCount: count(analysis.ingredient_count, analysis.ingredients),
    additiveCount: count(analysis.additive_count, analysis.additives),
    allergens: Array.isArray(analysis.allergens) ? analysis.allergens : [],
    // ★★★ 세션61 U60-7 — 서버가 이미 보내 주던 3키. 여기서 버리면 화면이 침묵한다.
    //   ⚠ `?? null` 로 «명시적 null» 을 만든다. `undefined` 로 두면 화면이
    //     「필드가 없다」와 「서버가 없다고 했다」를 구분할 수 없다.
    allergens_v2: analysis.allergens_v2 ?? null,
    allergens_available: analysis.allergens_available,
    allergens_flat_complete: analysis.allergens_flat_complete,

    // ★★ 세션64b — 서버가 이미 보내 주던 것들. 여기서 버리면 화면이 개수만 말한다.
    ingredients: parseIngredients(analysis.ingredients),
    additives: Array.isArray(analysis.additives)
      ? (analysis.additives as unknown[]).filter(
          (r): r is Record<string, unknown> => !!r && typeof r === 'object',
        )
      : [],
    // 바코드 경로와 «같은» 정규화를 쓴다. 한쪽만 문자열로 남으면 화면이 갈라진다.
    nutrition: normalizeNutrition(analysis.nutrition ?? null),
    nutritionBasis: typeof nutrition._basis === 'string' ? nutrition._basis : null,
    // ⚠ `analysis` 아래가 아니라 `data` 최상위다(ocrRoutes.js:800).
    trafficLight: (data?.traffic_light ?? null) as MsTrafficLight | null,

    raw: data,
  }
}

/**
 * 1단계 — 읽어보기. **저장하지 않는다** (`save='false'`).
 *
 * ⚠ `save` 를 다시 `'true'` 로 바꾸지 말 것. 그러면 사용자가 제품명을 확정하기 «전»에
 *   저장돼 버리고, 이름을 모르는 서버가 첫 원재료명을 제품명으로 넣는 사고가 재발한다.
 */
export async function analyzePhotoReport(params: {
  barcode?: string | null
  labelImage?: File | null
  nutritionImage?: File | null
}): Promise<MsPhotoAnalysis> {
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

  // ★ 세션64c — 토큰을 «업로드 전»에 확보한다. 없으면 사진을 보내지 않고 던진다.
  const headers = await authHeaders()

  const fd = new FormData()
  if (labelImage) fd.append('label_image', labelImage)
  if (nutritionImage) fd.append('nutrition_image', nutritionImage)
  if (barcode) fd.append('barcode', barcode)
  fd.append('save', 'false')   // ★ 세션64 — 저장은 2단계(confirm)에서만 일어난다
  // ★ 세션64b — 제보자 식별자. 이게 없으면 서버 `contributions.device_id` 가 null 로 남고
  //   「내 제보」가 영원히 빈 목록이 된다(웹 제보는 `user_id` 도 null 이다 — 계정 체계가 다르다).
  //   ⚠ 이 값은 «먹선 제보 API 로만» 나간다. `track()` props 에 절대 싣지 않는다(lib/events.ts 원칙).
  fd.append('device_id', getDeviceId())

  // ⚠ `Content-Type` 을 «직접 넣지 말 것». FormData 는 브라우저가 boundary 를 붙여야 한다.
  const res = await fetch(`${BASE}/api/ocr/multi-photo`, { method: 'POST', headers, body: fd })

  let json: any = null
  try { json = await res.json() } catch { /* 비-JSON 응답 */ }

  // ★ 401 을 «먼저» 가른다. 아래 일반 오류로 뭉개지면 「잠시 후 다시」가 나가고
  //   사용자는 로그인하면 될 일을 모른다.
  throwIfUnauthorized(res, json)

  if (!res.ok || !json || json.success !== true) {
    const msg = (json && (json.message || json.error?.message)) || `서버 오류(${res.status})`
    throw new Error(msg)
  }

  return parsePhotoAnalysis(json.data || {})
}

/**
 * 확정 저장 실패. **상태 코드를 잃지 않는다** — 400(거부)과 410(만료)은 사용자 행동이 다르다.
 * 문구 판정은 `domain/meokseon/photoReport.ts:classifyConfirmFailure` 가 한다(여기서 하지 않는다).
 */
export class MeokseonConfirmError extends Error {
  status: number
  /** 서버가 준 한국어 사유. 없으면 null — 「서버가 말이 없었다」와 「이런 사유였다」를 구분한다. */
  serverMessage: string | null
  constructor(status: number, serverMessage: string | null) {
    super(serverMessage || `서버 오류(${status})`)
    this.name = 'MeokseonConfirmError'
    this.status = status
    this.serverMessage = serverMessage
  }
}

export interface MsPhotoConfirmResult {
  /** 서버가 크라우드 기여로 «실제로» 저장했는가. false 면 사람이 검토해야 한다는 뜻이다. */
  saved: boolean
  /**
   * 서버가 «저장하지 않은 이유»(한국어). 저장됐으면 null.
   *
   * ★★ 2026-08-23 세션64 외부검토 §B 중 발견 — 이 필드가 없어서 화면이 **거짓말을 하고 있었다.**
   *   종전 코드는 `saved: !!data.save_result` 였다. 그런데 서버는 반려할 때도
   *   `save_result` «객체»를 준다 — `{ saved:false, rejectReason:'…' }` (crowdsourceService.js).
   *   객체는 언제나 truthy 이므로 **모든 반려가 `saved:true` 로 읽혔고**,
   *   화면은 「제보 감사합니다!」를 띄웠다. 2026-08-06 「거짓 확인」 사고와 같은 유형이다.
   *
   *   기존 제품에 정보를 보태는 경로(세션64 §B)가 열리면서 이게 **상시 경로**가 된다 —
   *   반려 사유가 실제로 흔하다: 「이미 공공데이터 기반 영양정보가 등록되어 있습니다」·
   *   「같은 기기에서 24시간 내에 이미 제출」·「OCR 신뢰도 미달」·「표기 기준 판별 실패」.
   */
  rejectReason: string | null

  /* ── 세션64b 신설 — 「부분 저장」계약 (서버: crowdsourceService.js:686~690) ────────────
   *
   * 서버의 저장 정책이 「통째로 저장 / 통째로 반려」에서 **「부분 저장」**으로 바뀌었다.
   * 영양 관련 실패 6종은 이제 제보 전체를 반려하지 않고 **영양만 버리고**
   * 제품·원재료·알레르기 원증거는 저장한다(서버 `tests/test_nutrition_partial_save.js` §1·§7).
   *
   * ⇒ `saved === true` 만 보고 「제보 감사합니다」를 띄우면 **화면이 또 거짓말을 한다.**
   *   사용자는 영양성분표를 찍어 보냈는데 그게 저장되지 않은 것을 모른 채 떠난다.
   *
   * ★ 여기서는 **판정하지 않는다.** 서버 원문을 그대로 싣기만 한다.
   *   판정과 문구는 `domain/meokseon/photoReport.ts:classifyPhotoReportOutcome` 이 한다
   *   (이 파일의 다른 실패 처리도 같은 규칙이다 — `classifyConfirmFailure` 참조).
   */

  /**
   * 서버 `save_result.nutrition_status` 원문. 알려진 값은 `'ok'` · `'incomplete'`.
   * **null = 서버가 말하지 않았다**(구버전 서버). 「ok 였다」로 읽지 말 것.
   */
  nutritionStatus: string | null
  /**
   * 서버 `save_result.nutrition_reject_code` 원문.
   * 알려진 6종: NO_NUTRIENTS · BASIS_UNKNOWN · PER_TOTAL_UNRESOLVED · SANITY_OUTLIER
   *           · MASS_BALANCE · PUBLIC_DATA_PROTECTED
   * ⚠ 이 목록을 «닫힌 집합»으로 다루지 말 것 — 서버가 코드를 늘리면 앱은 모르는 값을 받는다.
   */
  nutritionRejectCode: string | null
  /** 서버 `save_result.nutrition_reject_reason` 원문(한국어). ⚠ 그대로 화면에 쓰지 않는다(아래 주석). */
  nutritionRejectReason: string | null
  /**
   * 서버 `save_result.nutrient_count`. **내부 계측 전용.**
   * ⚠⚠ 사용자 화면에 노출 금지 — 「영양성분 3개」는 사용자에게 의미가 없고,
   *   개수가 품질 지표처럼 보이면 안 된다(2026-08-23 외부 검토 결론).
   *   서버도 같은 이유로 「관측 전용. 저장 판정에 쓰지 않는다」라고 못 박았다.
   */
  nutrientCount: number | null

  raw: unknown
}

/**
 * 2단계 — 보내기(확정 저장). POST /api/ocr/confirm (JSON)
 *
 * ★ `productName` 은 **사용자 입력란의 값**이어야 한다. OCR 값을 여기로 그냥 흘리지 말 것.
 * ★ 빈 이름은 **서버에 가기 «전»에** 막는다. 서버 400 은 최후의 방어선이지 1차 방어선이 아니다.
 *
 * ⚠ `barcode` 를 본문 최상위에 «함께» 싣는다. 서버의 기존 저장 경로가 `req.body.barcode` 를
 *   읽기 때문이다(ocrRoutes.js). 토큰이 바코드를 이미 품고 있다면 서버가 무시하면 되고,
 *   품고 있지 않다면 이게 없으면 «미등록 바코드 제보»가 바코드를 잃는다.
 *   → 서버 담당과 최종 확인 필요(세션64 미확인 항목).
 */
export async function confirmPhotoReport(params: {
  analysisToken: string
  productName: string
  barcode?: string | null
}): Promise<MsPhotoConfirmResult> {
  if (!BASE) throw new Error('먹선 API URL 미설정(VITE_MEOKSEON_API_URL)')

  const token = (params.analysisToken || '').trim()
  if (!token) throw new Error('읽어본 결과를 확정할 수 없어요. 「읽어보기」를 다시 눌러 주세요.')

  const productName = (params.productName || '').replace(/\s+/g, ' ').trim()
  if (!productName) throw new Error('제품명을 적어야 보낼 수 있어요.')

  const body: Record<string, unknown> = {
    analysis_token: token,
    product_info: { product_name: productName },
    // ★ 세션64b — 1단계와 «같은» 값을 보낸다. 두 단계가 다른 값을 보내면
    //   실제 저장을 하는 이 호출의 기록이 이력에서 빠진다.
    device_id: getDeviceId(),
  }
  if (params.barcode) body.barcode = params.barcode

  // ★ 세션64c — 저장 호출도 인증 필수다. 토큰이 없으면 여기서 던진다.
  const auth = await authHeaders()

  const res = await fetch(`${BASE}/api/ocr/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify(body),
  })

  let json: any = null
  try { json = await res.json() } catch { /* 비-JSON 응답 */ }

  // ★ 401 은 `MeokseonConfirmError` 로 뭉개지 않는다 — 사용자 행동이 «로그인»으로 다르다.
  throwIfUnauthorized(res, json)

  const serverMessage: string | null =
    (json && typeof (json.message || json.error?.message) === 'string')
      ? (json.message || json.error.message)
      : null

  if (!res.ok || !json || json.success !== true) {
    // ★ 상태 코드를 «살려서» 던진다. 화면이 400/410 을 구분해야 한다.
    throw new MeokseonConfirmError(res.status, serverMessage)
  }

  const data = json.data || {}
  const sr = data.save_result

  // ★ save_result 가 있어야 «저장됐다». 200 이어도 게이트에서 반려될 수 있다.
  // ★★ 그리고 «객체가 있다»만으로는 부족하다 — 반려도 객체로 온다(위 타입 주석 참조).
  //    `saved` 키가 있으면 그 값이 정본이다. 키가 없으면(구계약 응답) 종전대로 존재를 믿는다.
  const hasFlag = !!sr && typeof sr === 'object' && 'saved' in sr
  const saved = hasFlag ? sr.saved === true : !!sr

  const reason = (!!sr && typeof sr === 'object' && typeof sr.rejectReason === 'string')
    ? sr.rejectReason.trim()
    : ''

  // ── 세션64b 부분 저장 필드 ────────────────────────────────────────────────
  // ★ 문자열만 문자열로, 숫자만 숫자로 받는다. 타입이 다르면 **null 로 둔다** —
  //   「서버가 뭔가 줬다」를 「이런 값이었다」로 승격시키지 않는다.
  // ★ 빈 문자열은 null 이다. `''` 를 코드로 들고 가면 아래 판정이 「알 수 없는 코드」와
  //   「말이 없었다」를 구분하지 못한다.
  const str = (v: unknown): string | null =>
    (typeof v === 'string' && v.trim()) ? v.trim() : null
  const srObj = (!!sr && typeof sr === 'object') ? (sr as Record<string, unknown>) : null

  const nutrientCountRaw = srObj?.nutrient_count
  const nutrientCount = (typeof nutrientCountRaw === 'number' && Number.isFinite(nutrientCountRaw))
    ? nutrientCountRaw
    : null

  return {
    saved,
    // 저장됐으면 사유가 없다. 사유를 «없는데 있는 척» 하지 않는다.
    rejectReason: saved ? null : (reason || null),
    // ⚠ 이 셋은 `saved` 와 «무관하게» 싣는다. 저장됐어도 영양은 떨어졌을 수 있다 —
    //   그게 이번에 열린 「부분 저장」이다. `saved` 로 걸러내면 화면이 다시 침묵한다.
    nutritionStatus: str(srObj?.nutrition_status),
    nutritionRejectCode: str(srObj?.nutrition_reject_code),
    nutritionRejectReason: str(srObj?.nutrition_reject_reason),
    nutrientCount,
    raw: data,
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * 「내 제보」 이력 — GET /api/contributions/mine (세션64b 신설)
 *
 * ★ 왜 필요한가: 제보를 보내고 나면 그걸로 끝이었다. 서버에는 기록이 남는데
 *   **그 기록을 돌려주는 경로가 없었다.** 사용자는 자기가 뭘 보냈는지, 반영됐는지 모른다.
 *
 * ★★ 2026-08-24 세션64c — **식별자가 `device_id` 에서 «계정»으로 바뀌었다.**
 *   세션64b 에는 `?device_id=<uuid>` 를 보냈다. 그때는 앱(Supabase Auth)과 먹선 서버
 *   (Firebase Auth)의 계정 체계가 연결돼 있지 않아서 그 방법밖에 없었다.
 *   제이 확정(2026-08-24)으로 서버 인증이 **Supabase 로 전면 교체**되면서
 *   서버가 토큰에서 사용자를 직접 알아낸다.
 *
 *   ⇒ **`device_id` 파라미터는 더 이상 보내지 않는다**(서버 담당과 동일 확정).
 *     보내면 서버가 무시하거나 400 을 줄 수 있고, 무엇보다 「이 브라우저」와 「이 사람」이
 *     다른 답을 내면 사용자는 자기 제보가 사라진 줄 안다.
 *   ⇒ 저장소를 지워도, 기기를 바꿔도 **로그인만 하면 보인다.**
 *     `deviceId.ts:DEVICE_ID_LIMIT_NOTICE`(「이 기기에만 연결돼 있어요」)가 말하던 한계는
 *     사라졌다. ⚠ 그 상수는 **화면 어디에도 붙어 있지 않다**(2026-08-24 확인) —
 *     되살려 쓰지 말 것. 지금 쓸 문구는 `contributions.ts:CONTRIBUTIONS_ACCOUNT_NOTICE` 다.
 *
 * ⚠ 2026-08-24 기준 서버에 이 엔드포인트는 **아직 없다**(구현 중). 실제 왕복은 확인 못 했다.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * 이력 조회 실패(401 «아닌» 것). **상태 코드를 잃지 않는다.**
 * ⚠ 401 은 여기가 아니라 `MeokseonAuthError` 다 — 「못 불러왔다」와 「로그인이 필요하다」는
 *   사용자가 할 일이 다르다. 한 오류로 합치면 화면이 「잠시 후 다시」만 말하고 끝난다.
 */
export class MeokseonContributionsError extends Error {
  status: number
  constructor(status: number, message?: string) {
    super(message || `서버 오류(${status})`)
    this.name = 'MeokseonContributionsError'
    this.status = status
  }
}

/**
 * 이 기기가 보낸 제보 목록.
 *
 * ⚠ 응답이 비어 있는 것과 실패는 **다르다.** 실패는 반드시 던진다 —
 *   조용히 빈 배열을 돌려주면 화면이 「아직 보낸 제보가 없어요」라고 «거짓말»을 한다.
 *   (2026-08-06 「거짓 확인」 사고와 방향만 반대인 같은 유형이다.)
 */
export async function listMyContributions(params?: {
  limit?: number
  offset?: number
}): Promise<MyContributionPage> {
  if (!BASE) throw new Error('먹선 API URL 미설정(VITE_MEOKSEON_API_URL)')

  const limit = params?.limit ?? 20
  const offset = params?.offset ?? 0

  // ⚠ `device_id` 를 다시 붙이지 말 것 — 식별자는 토큰이다(위 주석 참조).
  const qs = `limit=${limit}&offset=${offset}`
  const headers = await authHeaders()
  const res = await fetch(`${BASE}/api/contributions/mine?${qs}`, { headers })

  let json: any = null
  try { json = await res.json() } catch { /* 비-JSON 응답 */ }

  // ★ 401 을 「불러오지 못했어요」로 뭉개지 않는다 — 할 일이 「로그인」으로 다르다.
  throwIfUnauthorized(res, json)

  if (!res.ok || !json || json.success !== true) {
    const msg = (json && (json.message || json.error?.message)) || undefined
    throw new MeokseonContributionsError(res.status, typeof msg === 'string' ? msg : undefined)
  }

  return normalizeContributionPage(json.data)
}
