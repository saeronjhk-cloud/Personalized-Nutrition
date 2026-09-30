/**
 * ★ 세션72d — 앱(web) 관리자 화면용 먹선 admin API 클라이언트 (제이 결정 2026-09-30)
 *   인증: Supabase 로그인 토큰. 서버 `requireAdmin` 이 이메일 ∈ ADMIN_EMAILS 일 때만 통과(아니면 403).
 *   ⚠ 화면을 숨기는 것은 보조일 뿐 — 권한 판정은 서버 한 곳이다.
 */
import { getMeokseonAccessToken } from './meokseonAuth'

function normalizeBase(raw: string): string {
  const v = (raw || '').trim().replace(/\/+$/, '')
  if (!v) return ''
  return /^https?:\/\//i.test(v) ? v : `https://${v}`
}
export const MEOKSEON_BASE = normalizeBase(import.meta.env.VITE_MEOKSEON_API_URL || '')

export type AdminGate = 'ok' | 'login' | 'forbidden' | 'unavailable'

export class AdminApiError extends Error {
  status: number; code: string | null
  constructor(status: number, code: string | null, message: string) { super(message); this.status = status; this.code = code }
}

async function adminFetch(path: string, init?: RequestInit): Promise<any> {
  if (!MEOKSEON_BASE) throw new AdminApiError(0, 'NO_BASE', '먹선 API URL 미설정(VITE_MEOKSEON_API_URL)')
  const token = await getMeokseonAccessToken()
  if (!token) throw new AdminApiError(401, 'AUTH_REQUIRED', '로그인이 필요합니다.')
  const r = await fetch(`${MEOKSEON_BASE}/api/admin${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
  })
  let body: any = null
  try { body = await r.json() } catch { body = null }
  if (!r.ok) throw new AdminApiError(r.status, body?.error?.code ?? null, body?.error?.message ?? `HTTP ${r.status}`)
  return body
}

/** 순수 판정 — whoami 결과/오류 → 화면 상태. 테스트 대상. */
export function gateFromError(e: unknown): AdminGate {
  const s = e instanceof AdminApiError ? e.status : 0
  if (s === 401) return 'login'
  if (s === 403) return 'forbidden'
  return 'unavailable'
}

export async function adminWhoami(): Promise<{ admin: boolean; email: string | null }> {
  const b = await adminFetch('/whoami')
  return { admin: !!b?.data?.admin, email: b?.data?.email ?? null }
}

export async function listReviewQueue(status: string[]): Promise<any> {
  const q = new URLSearchParams({ status: status.join(','), limit: '100' })
  const b = await adminFetch(`/review/contributions?${q}`)
  return b?.data ?? b
}

export async function getReviewDetail(productId: number): Promise<any> {
  const b = await adminFetch(`/review/contributions/${Number(productId)}`)
  return b?.data ?? b
}

export async function verifyReviews(productId: number, body: {
  action: 'approve' | 'reject' | 'undo' | 'reopen' | 'retry'; review_ids: number[]; reject_reason?: string
}): Promise<any> {
  const b = await adminFetch(`/verify/${Number(productId)}`, { method: 'POST', body: JSON.stringify(body) })
  return b?.data ?? b
}

// ── ★ 세션72f — 제보 사진 축소본 · 관리자 정정(알레르기·원재료·영양) ──
export interface AdminPhoto { photo_id: number; kind: 'label' | 'nutrition'; mime: string; byte_size: number; created_at: string }

export async function listPhotos(productId: number): Promise<AdminPhoto[]> {
  const b = await adminFetch(`/review/contributions/${Number(productId)}/photos`)
  return b?.data?.photos ?? []
}

/** 사진 바이트는 Authorization 이 필요해 <img src> 로 못 연다 → blob URL. 쓰고 나면 revoke 할 것. */
export async function fetchPhotoUrl(photoId: number): Promise<string> {
  if (!MEOKSEON_BASE) throw new AdminApiError(0, 'NO_BASE', '먹선 API URL 미설정(VITE_MEOKSEON_API_URL)')
  const token = await getMeokseonAccessToken()
  if (!token) throw new AdminApiError(401, 'AUTH_REQUIRED', '로그인이 필요합니다.')
  const r = await fetch(`${MEOKSEON_BASE}/api/admin/photos/${Number(photoId)}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!r.ok) throw new AdminApiError(r.status, null, `사진을 불러오지 못했어요(HTTP ${r.status}).`)
  return URL.createObjectURL(await r.blob())
}

/** 서버 `ALLERGEN_CANONICAL`(ocrParser.ALLERGEN_NAMES 키)과 같은 19종 · 같은 순서. */
export const ALLERGENS_19 = [
  '난류(가금류)', '우유', '메밀', '땅콩', '대두', '밀', '고등어', '게', '새우', '돼지고기',
  '복숭아', '토마토', '아황산류', '호두', '닭고기', '쇠고기', '오징어', '조개류', '잣',
] as const
export type AllergenMark = 'none' | 'contains' | 'may_contain'
export const NUTRIENT_KEYS = ['calories', 'sodium', 'total_carbs', 'total_sugars', 'total_fat', 'saturated_fat', 'trans_fat', 'cholesterol', 'protein', 'dietary_fiber'] as const

/** 순수 — 상세 한 축에서 편집기 초기값(정정이 있으면 정정값, 없으면 제보값). 테스트 대상. */
export function initialEdit(axis: string, a: any): any {
  const p = a?.effective?.proposed ?? a?.proposed
  if (axis === 'allergens') {
    const marks: Record<string, AllergenMark> = {}
    for (const n of ALLERGENS_19) marks[n] = 'none'
    for (const x of p?.allergens || []) {
      if (!(x.name in marks)) continue
      marks[x.name] = x.evidence_level === 'may_contain' ? 'may_contain' : 'contains'
    }
    return marks
  }
  if (axis === 'ingredients') {
    const ov = a?.override?.values?.ingredients_text
    return typeof ov === 'string' ? ov : (a?.proposed?.ingredients || []).join(', ')
  }
  if (axis === 'nutrition') {
    const src = a?.effective?.nutrition ?? a?.proposed?.nutrition ?? {}
    const out: Record<string, string> = {}
    for (const k of NUTRIENT_KEYS) out[k] = src[k] === null || src[k] === undefined ? '' : String(src[k])
    return out
  }
  return null
}

/** 순수 — 편집값 → 서버 override `values`. 바뀐 것이 없으면 null(정정 없이 승인). 테스트 대상. */
export function buildOverrideValues(axis: string, edit: any, initial: any): Record<string, any> | null {
  if (axis === 'allergens') {
    const same = ALLERGENS_19.every((n) => edit[n] === initial[n])
    if (same) return null
    return {
      allergens: {
        contains: ALLERGENS_19.filter((n) => edit[n] === 'contains'),
        may_contain: ALLERGENS_19.filter((n) => edit[n] === 'may_contain'),
      },
    }
  }
  if (axis === 'ingredients') {
    const t = String(edit || '').trim()
    return t && t !== String(initial || '').trim() ? { ingredients_text: t } : null
  }
  if (axis === 'nutrition') {
    const v: Record<string, number | null> = {}
    for (const k of NUTRIENT_KEYS) {
      if ((edit[k] ?? '') === (initial[k] ?? '')) continue
      const raw = String(edit[k] ?? '').trim()
      if (raw === '') { v[k] = null; continue }
      const n = Number(raw)
      if (!Number.isFinite(n) || n < 0) throw new Error(`${k} 값이 숫자가 아닙니다: ${raw}`)
      v[k] = n
    }
    return Object.keys(v).length ? v : null
  }
  return null
}

export async function overrideReview(reviewId: number, values: Record<string, any>, note: string): Promise<any> {
  const b = await adminFetch(`/review/contributions/${Number(reviewId)}/override`, {
    method: 'POST', body: JSON.stringify({ values, note }),
  })
  return b?.data ?? b
}

const AXIS_KO: Record<string, string> = { nutrition: '영양', ingredients: '원재료', allergens: '알레르기', additives: '첨가물' }
const STATUS_KO: Record<string, string> = {
  candidate: '검토 대기', approved: '승인', rejected: '반려', undone: '되돌림', superseded: '대체됨', auto_applied: '자동반영',
}
const LEVEL_KO: Record<string, string> = { contains: '함유', may_contain: '혼입', inferred: '추정' }
const NUT_KO: Record<string, string> = {
  calories: '열량', sodium: '나트륨', total_carbs: '탄수화물', total_sugars: '당류', total_fat: '지방',
  saturated_fat: '포화지방', trans_fat: '트랜스지방', cholesterol: '콜레스테롤', protein: '단백질', dietary_fiber: '식이섬유',
}
export const axisKo = (a: string) => AXIS_KO[a] ?? a
export const statusKo = (s: string) => STATUS_KO[s] ?? s

/** 순수 — 상세의 proposed 를 사람이 읽는 줄들로. 테스트 대상. */
export function describeProposed(axis: string, p: any): string[] {
  if (!p) return ['(제보 값 없음)']
  if (axis === 'allergens') {
    if (!p.inspected) return ['알레르기 항목을 읽지 않은 제보']
    const by: Record<string, string[]> = {}
    for (const a of p.allergens || []) (by[a.evidence_level] ||= []).push(a.name)
    const lines = Object.entries(by).map(([lv, ns]) => `${LEVEL_KO[lv] ?? lv}: ${ns.join(', ')}`)
    return lines.length ? lines : ['읽었고 0종']
  }
  if (axis === 'ingredients') return p.ingredients?.length ? [p.ingredients.join(', ')] : ['원재료 없음']
  if (axis === 'additives') return p.ingredient_names?.length ? [`원재료 ${p.ingredient_names.length}개에서 첨가물 검출`] : ['원재료 없음']
  if (axis === 'nutrition') {
    const n = p.nutrition
    if (!n) return ['영양값 없음']
    const parts = Object.entries(n).filter(([, v]) => v !== null).map(([k, v]) => `${NUT_KO[k] ?? k} ${v}`)
    return parts.length ? [parts.join(' · ')] : ['영양값 없음']
  }
  return [JSON.stringify(p)]
}
