/**
 * 가공식품 섭취 기록 — 먹선 «먹은 양» API 소비 + 식사 기록 저장 (영양공식 웹앱트랙)
 * ══════════════════════════════════════════════════════════════════
 * 설계 IP/integration/meal_product_log_design_v1.md · 평가 M01~M04 (lib/__tests__/productLog.test.ts)
 *
 * ★ 먹은 양 × 영양 계산은 먹선 서버 한 곳(GET /api/products/:barcode/portion — portionService).
 *   여기서는 받은 숫자를 MealFood 로 «옮기기만» 하고, 합계는 목록 재합산(recomputeSummary)만 한다.
 */
import { supabase } from './supabase'
import type { MealFood, MealSummary } from './nutrilens'
import { genMealId } from './nutrilens'
import { recomputeSummary } from './foodCorrection'
import { assignFoodItemIds } from './foodEdit'

function normalizeBase(raw: string): string {
  const v = (raw || '').trim().replace(/\/+$/, '')
  if (!v) return ''
  return /^https?:\/\//i.test(v) ? v : `https://${v}`
}
const BASE = normalizeBase(import.meta.env.VITE_MEOKSEON_API_URL || '')

export type PortionKind = 'pack' | 'serving' | 'gram'
export interface PortionOption { kind: PortionKind; available: boolean; reason?: string }
export interface PortionNutrients {
  calories_kcal: number | null; carbs_g: number | null; protein_g: number | null; fat_g: number | null
  sodium_mg: number | null; sugar_g: number | null; fiber_g: number | null; sat_fat_g?: number | null
}
export interface Portion {
  ok: boolean; reason?: string
  basis?: string; kind?: PortionKind; qty?: number; factor?: number
  grams?: number | null; unit?: 'g' | 'ml'; approx?: boolean; label?: string
  nutrients?: PortionNutrients
}
export interface PortionProduct {
  product_id: number; barcode: string; product_name: string; brand?: string | null
  serving_size?: number | null; total_content?: number | null; content_unit?: string | null
  servings_per_container?: number | null
}
export interface PortionResponse { product: PortionProduct; basis: string | null; options: PortionOption[]; portion: Portion | null }

export const PRODUCT_NOT_FOUND = '먹선에 아직 없는 제품이에요. 「제품 스캔」에서 사진으로 제보해 주시면 등록해 드려요.'
export const PRODUCT_FAIL = '지금은 제품 정보를 불러올 수 없어요. 잠시 후 다시 시도해 주세요.'

/** 불가 이유 → 화면 문구 */
export const REASON_TEXT: Record<string, string> = {
  no_nutrition: '영양 정보가 없는 제품이에요',
  need_total_content: '총 내용량 정보가 없어요',
  need_serving_info: '1회 제공량 정보가 없어요',
  invalid_qty: '양을 다시 확인해 주세요',
  invalid_kind: '지원하지 않는 단위예요',
}

/** 먹선 /portion 호출. kind 없으면 단위별 가능 여부만. 실패는 throw 하지 않고 {ok:false,message}. */
export async function getPortion(barcode: string, kind?: PortionKind, qty?: number): Promise<{ ok: true; data: PortionResponse } | { ok: false; message: string; notFound?: boolean }> {
  if (!BASE) return { ok: false, message: PRODUCT_FAIL }
  if (!/^\d{8,14}$/.test(barcode)) return { ok: false, message: '바코드는 8~14자리 숫자예요.' }
  const q = kind ? `?kind=${kind}&qty=${encodeURIComponent(String(qty ?? 1))}` : ''
  try {
    const res = await fetch(`${BASE}/api/products/${encodeURIComponent(barcode)}/portion${q}`)
    if (res.status === 404) return { ok: false, message: PRODUCT_NOT_FOUND, notFound: true }
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.success) return { ok: false, message: PRODUCT_FAIL }
    return { ok: true, data: json.data as PortionResponse }
  } catch {
    return { ok: false, message: PRODUCT_FAIL }
  }
}

const n0 = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** 서버 portion → MealFood (숫자는 옮기기만 · null → 0). 계산 불가면 null. */
export function productFoodFromPortion(product: PortionProduct, portion: Portion | null | undefined): MealFood | null {
  if (!portion?.ok || !portion.nutrients) return null
  const nu = portion.nutrients
  const name = (product.product_name || '').trim() || '가공식품'
  return {
    name_ko: name,
    amount: portion.label ?? undefined,
    calories_kcal: n0(nu.calories_kcal),
    protein_g: n0(nu.protein_g),
    carbs_g: n0(nu.carbs_g),
    fat_g: n0(nu.fat_g),
    sodium_mg: n0(nu.sodium_mg),
    sugar_g: n0(nu.sugar_g),
    fiber_g: n0(nu.fiber_g),
    db_matched: true,
    db_name: name,
    match_confidence: 'product_label',
    estimated_serving_g: portion.grams ?? null,
    user_edit: 'added',
    name_source: 'product_db',
    barcode: product.barcode,
    product_id: product.product_id,
    brand: product.brand ?? null,
    portion: { kind: portion.kind, qty: portion.qty, basis: portion.basis, approx: !!portion.approx },
  } as MealFood
}

export const EMPTY_SUMMARY: MealSummary = {
  total_calories_kcal: 0, total_protein_g: 0, total_carbs_g: 0, total_fat_g: 0,
  total_sodium_mg: 0, total_sugar_g: 0, total_fiber_g: 0,
}

/** 담은 제품 목록의 합계 — 재합산만. */
export function productSummary(foods: MealFood[]): MealSummary {
  return recomputeSummary(foods, EMPTY_SUMMARY)
}

/** 가공식품 식사 저장 — meal_log 1행(source 'barcode', 사진 없음). 음식 0개면 저장 안 함. */
export async function saveProductMeal(params: { foods: MealFood[]; mealSlot: string; eatenAt?: string; clientMealId?: string }): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!Array.isArray(params.foods) || params.foods.length === 0) return { ok: false, error: '담은 제품이 없어요.' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다' }
  const foods = assignFoodItemIds(params.foods)
  const { data, error } = await supabase.from('meal_log').insert({
    user_id: user.id,
    client_meal_id: params.clientMealId ?? genMealId(),
    eaten_at: params.eatenAt ?? new Date().toISOString(),
    meal_slot: params.mealSlot,
    foods,
    summary: productSummary(foods),
    photo_path: null,
    photo_sha256: null,
    engine_version: null,
    source: 'barcode',
  }).select('id')
  if (error) return { ok: false, error: `기록 저장 실패: ${error.message}` }
  return { ok: true, id: data?.[0]?.id ? String(data[0].id) : undefined }
}
