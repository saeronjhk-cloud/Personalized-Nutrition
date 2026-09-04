import type { AnalyzeResult, MealFood, MealSummary } from './nutrilens'

/**
 * 세션52 (2026-09-03) — 「구별 불가 쌍」 사용자 정정
 * ══════════════════════════════════════════════════════════════════
 *
 * 배경 (IP/178 §17-5, IP/179 §2)
 *   설렁탕↔곰탕 · 꽃게탕↔해물탕 은 엔진도 GPT-4o 도 구별하지 못한다.
 *   엔진 대칭도 0.58 / 1.00 이고, aihub300 3개 실행에서 그룹 내부 교체는
 *   정확히 2:2 — 동전던지기다. 어느 쪽을 자동으로 고르든 절반은 틀린다.
 *
 *   ⇒ 제이 결정: 화면에는 «가능성 높은 쪽 하나»만 보여주고,
 *     틀렸을 때 사용자가 한 번에 고칠 수 있게 한다.
 *
 * ★ 왜 여기(순수 함수)에 두는가 — 규칙 70
 *   정정은 «화면»의 일이 아니라 «결과»의 일이다. 컴포넌트 안에 두면
 *   저장 경로(Meal.onSave)가 정정 전 result 를 그대로 저장해 버린다.
 *   함수로 빼서 상태를 통째로 갈아끼우면 저장·요약·기록이 자동으로 따라온다.
 *
 * ★ 서버가 대안의 «영양까지» 계산해 내려보낸다
 *   (food_analyzer.attach_food30_alternates). 앱에는 음식 DB 가 없으므로
 *   이름만 받으면 칼로리를 바꿀 방법이 없다. 여기서는 받은 값을 쓰기만 한다.
 */

/** 서버가 내려보내는 대안 후보. MealFood 의 영양 필드 부분집합. */
export interface FoodAlternate {
  name_ko: string
  calories_kcal?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  sugar_g?: number
  sodium_mg?: number
  fiber_g?: number
  estimated_serving_g?: number
  source?: string | null
}

export type MealFoodWithAlternates = MealFood & {
  alternates?: FoodAlternate[]
  alternates_reason?: string
}

const NUTRIENT_KEYS = [
  'calories_kcal', 'protein_g', 'carbs_g', 'fat_g',
  'sugar_g', 'sodium_mg', 'fiber_g',
] as const

type NutrientKey = typeof NUTRIENT_KEYS[number]

const SUMMARY_KEY: Record<NutrientKey, keyof MealSummary> = {
  calories_kcal: 'total_calories_kcal',
  protein_g: 'total_protein_g',
  carbs_g: 'total_carbs_g',
  fat_g: 'total_fat_g',
  sugar_g: 'total_sugar_g',
  sodium_mg: 'total_sodium_mg',
  fiber_g: 'total_fiber_g' as keyof MealSummary,
}

function num(v: unknown): number {
  return typeof v === 'number' && isFinite(v) ? v : 0
}

export function alternatesOf(food: MealFood): FoodAlternate[] {
  const a = (food as MealFoodWithAlternates).alternates
  return Array.isArray(a) ? a : []
}

/**
 * 합계를 «음식 목록에서 다시» 계산한다.
 *
 * ⚠ 기존 합계에서 옛 값을 빼고 새 값을 더하는 방식은 쓰지 않는다.
 *   서버 합계와 음식별 값이 (반올림·미매칭 등으로) 어긋나 있으면 그 오차가
 *   정정할 때마다 누적된다. 매번 전체를 다시 더하면 그런 표류가 없다.
 */
export function recomputeSummary(foods: MealFood[], base: MealSummary): MealSummary {
  const out = { ...base } as any
  for (const k of NUTRIENT_KEYS) {
    const key = SUMMARY_KEY[k]
    if (!(key in out)) continue
    out[key] = foods.reduce((s, f) => s + num((f as any)[k]), 0)
  }
  return out as MealSummary
}

/**
 * index 번째 음식을 대안 이름으로 바꾼 «새» 결과를 만든다.
 *
 * - 원본은 건드리지 않는다(불변). 저장 경로가 옛 객체를 붙들고 있어도 안전하다.
 * - 바꾼 뒤의 후보 목록에는 «원래 이름»이 들어간다 → 되돌리기가 같은 동작으로 된다.
 * - 대안을 못 찾으면 원본을 그대로 돌려준다(화면이 조용히 아무것도 안 한다).
 */
export function applyAlternate(
  result: AnalyzeResult, index: number, altName: string,
): AnalyzeResult {
  const foods = result?.foods
  if (!Array.isArray(foods) || index < 0 || index >= foods.length) return result

  const current = foods[index] as MealFoodWithAlternates
  const alts = alternatesOf(current)
  const picked = alts.find((a) => a.name_ko === altName)
  if (!picked) return result

  // 되돌아갈 자리 — 지금 값을 후보 형태로 접어 둔다.
  const back: FoodAlternate = { name_ko: current.name_ko }
  for (const k of NUTRIENT_KEYS) {
    const v = (current as any)[k]
    if (typeof v === 'number') back[k] = v
  }
  const cs = (current as any).estimated_serving_g
  if (typeof cs === 'number') back.estimated_serving_g = cs
  if ((current as any).source !== undefined) back.source = (current as any).source

  const swapped: MealFoodWithAlternates = { ...current, name_ko: picked.name_ko }
  for (const k of NUTRIENT_KEYS) {
    if (typeof picked[k] === 'number') (swapped as any)[k] = picked[k]
  }
  if (typeof picked.estimated_serving_g === 'number') {
    (swapped as any).estimated_serving_g = picked.estimated_serving_g
  }
  if (picked.source !== undefined) (swapped as any).source = picked.source

  // 사용자가 직접 고른 이름이다. DB 매칭 신뢰도 표시가 남아 있으면 거짓말이 된다.
  swapped.match_confidence = 'user_selected'
  ;(swapped as any).name_source = 'user_correction'
  swapped.alternates = [back, ...alts.filter((a) => a.name_ko !== altName)]

  const nextFoods = foods.slice()
  nextFoods[index] = swapped
  return {
    ...result,
    foods: nextFoods,
    summary: recomputeSummary(nextFoods, result.summary),
  }
}
