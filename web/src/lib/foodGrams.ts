/**
 * 화면에 보이는 음식 무게 = 엔진이 영양을 계산한 무게 (2026-10-14)
 * - 양 가중(C3c)이 걸린 사진 음식은 estimated_serving_g(GPT 추정) 와 계산 무게(portion_base_g)가 다르다
 *   (운영 10-13: 맥주 200g 표시 · 245g 기준 105.4kcal). 기준 g 가 있으면 그것을 보인다.
 * - 양을 고른 음식(portion_choice)은 estimated_serving_g 가 이미 «기준 g × 배율» = 계산 무게.
 * - portion_base_g 가 없는 10-13 이전 기록은 estimated_serving_g 그대로.
 * 평가: lib/__tests__/mealDetail.test.ts D06 · manualMeal.test.ts N11
 */
const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0

export function shownServingG(food: unknown): number | null {
  const f = (food ?? {}) as { estimated_serving_g?: unknown; portion_base_g?: unknown; portion_choice?: unknown }
  if (f.portion_choice == null && ok(f.portion_base_g)) return Math.round(f.portion_base_g)
  return ok(f.estimated_serving_g) ? Math.round(f.estimated_serving_g) : null
}
