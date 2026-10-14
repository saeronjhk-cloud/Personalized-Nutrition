/**
 * 사진 없이 기록 v1 (2026-10-13) — 음식 이름으로 찾아 담기 → 끼니 → 저장 (영양공식 웹앱트랙)
 * ══════════════════════════════════════════════════════════════════
 * 설계 IP/integration/meal_manual_log_design_v1.md · 평가 N01~N07 (lib/__tests__/manualMeal.test.ts)
 *
 * ★ 영양 숫자는 엔진(/v1/food/resolve — 사진 분석과 같은 match_with_db)이 준 값을 «쓰기만» 한다.
 *   담기·빼기·양 칩은 foodEdit.ts(addFood · removeFood · applyPortion)를 그대로 쓴다 — 사진 결과와 한 길.
 * ★ 저장은 meal_log 1행(source 'manual', 사진 없음). 합계는 저장 직전 목록에서 다시 더한다.
 *   주간 리포트·남김 보정(slider)은 source·사진으로 거르지 않는다(Edge weekly-report v7 · meal-leftover v10 확인).
 */
import { shownServingG } from './foodGrams'
import { supabase } from './supabase'
import { genMealId, type AnalyzeResult, type MealFood, type MealSummary } from './nutrilens'
import { recomputeSummary } from './foodCorrection'
import { assignFoodItemIds } from './foodEdit'

export const MANUAL_MAX_FOODS = 20

const EMPTY: MealSummary = {
  total_calories_kcal: 0, total_protein_g: 0, total_carbs_g: 0, total_fat_g: 0,
  total_sodium_mg: 0, total_sugar_g: 0, total_fiber_g: 0,
}

/** 빈 식사 — foodEdit 의 addFood/removeFood/applyPortion 이 그대로 받는 모양. */
export function emptyManualMeal(): AnalyzeResult {
  return { foods: [], summary: { ...EMPTY } }
}

/** 담은 음식의 양 표시 — 봉지 기준(엔진 package_count)이면 «N봉», 아니면 «Ng». 둘 다 없으면 null. */
export function manualAmountText(food: MealFood | null | undefined): string | null {
  const f = (food ?? {}) as { package_count?: unknown; estimated_serving_g?: unknown }
  if (typeof f.package_count === 'number' && Number.isFinite(f.package_count) && f.package_count > 0) {
    return `${Math.round(f.package_count * 10) / 10}봉`
  }
  const g = shownServingG(food)
  return g != null ? `${g}g` : null
}

/** 사진 없는 식사 저장 — meal_log 1행(source 'manual'). 0개·상한 초과면 저장 안 함. */
export async function saveManualMeal(params: { result: AnalyzeResult; mealSlot: string; eatenAt?: string; clientMealId?: string }): Promise<{ ok: boolean; error?: string; id?: string }> {
  const list = Array.isArray(params.result?.foods) ? params.result.foods : []
  if (list.length === 0) return { ok: false, error: '담은 음식이 없어요.' }
  if (list.length > MANUAL_MAX_FOODS) return { ok: false, error: `한 끼에 ${MANUAL_MAX_FOODS}개까지 담을 수 있어요.` }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다' }
  const foods = assignFoodItemIds(list)
  const { data, error } = await supabase.from('meal_log').insert({
    user_id: user.id,
    client_meal_id: params.clientMealId ?? genMealId(),
    eaten_at: params.eatenAt ?? new Date().toISOString(),
    meal_slot: params.mealSlot,
    foods,
    summary: recomputeSummary(foods, EMPTY),
    photo_path: null,
    photo_sha256: null,
    engine_version: null,
    source: 'manual',
  }).select('id')
  if (error) return { ok: false, error: `기록 저장 실패: ${error.message}` }
  return { ok: true, id: data?.[0]?.id ? String(data[0].id) : undefined }
}
