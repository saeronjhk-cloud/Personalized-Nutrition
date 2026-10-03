/**
 * 가공식품 섭취 기록 v1 — 평가 M01~M04 (IP/integration/meal_product_log_eval_v1.md §M)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

let lastInsert: any = null
vi.mock('../supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => ({ insert: (row: unknown) => { lastInsert = row; return { select: () => Promise.resolve({ data: [{ id: 'm9' }], error: null }) } } }),
  },
}))

import { productFoodFromPortion, productSummary, saveProductMeal, nutrientText, type PortionProduct, type Portion } from '../productLog'

const product: PortionProduct = { product_id: 7, barcode: '8801043014809', product_name: '새우깡', brand: '농심', total_content: 90, content_unit: 'g' }
const portion: Portion = {
  ok: true, basis: 'per_100g', kind: 'pack', qty: 0.5, factor: 0.45, grams: 45, unit: 'g', approx: false, label: '½개(45g)',
  nutrients: { calories_kcal: 225.5, carbs_g: 28.4, protein_g: 2.7, fat_g: 11.3, sodium_mg: 290, sugar_g: null, fiber_g: 0.9, sat_fat_g: 3.6 },
}
beforeEach(() => { lastInsert = null })

describe('가공식품 기록 — 매핑·저장', () => {
  it('M01 portion → MealFood (옮기기만 · null→0 · 표식·바코드 보존)', () => {
    const f = productFoodFromPortion(product, portion) as any
    expect(f).toMatchObject({
      name_ko: '새우깡', amount: '½개(45g)', calories_kcal: 225.5, carbs_g: 28.4, protein_g: 2.7, fat_g: 11.3,
      sodium_mg: 290, sugar_g: 0, fiber_g: 0.9, estimated_serving_g: 45, user_edit: 'added', name_source: 'product_db',
      match_confidence: 'product_label', barcode: '8801043014809', product_id: 7, brand: '농심', db_matched: true,
    })
    expect(f.portion).toEqual({ kind: 'pack', qty: 0.5, basis: 'per_100g', approx: false })
    // M05 값 없는 영양소는 표식 + 화면 «정보 없음»(0 으로 보이지 않음)
    expect(f.missing_nutrients).toEqual(['sugar_g'])
    expect(nutrientText(null, 'g')).toBe('정보 없음')
    expect(nutrientText(0, 'g')).toBe('0g')
    expect(productFoodFromPortion(product, { ok: false, reason: 'need_total_content' })).toBeNull()
    expect(productFoodFromPortion(product, null)).toBeNull()
  })
  it('M02 합계 = 재합산', () => {
    const a = productFoodFromPortion(product, portion)!
    const b = { ...a, calories_kcal: 100, sodium_mg: 10 }
    const s = productSummary([a, b])
    expect(s.total_calories_kcal).toBeCloseTo(325.5)
    expect(s.total_sodium_mg).toBe(300)
    expect(productSummary([]).total_calories_kcal).toBe(0)
  })
  it('M03 저장: source barcode · 사진 없음 · food_item_id · client_meal_id', async () => {
    const r = await saveProductMeal({ foods: [productFoodFromPortion(product, portion)!], mealSlot: 'snack' })
    expect(r).toEqual({ ok: true, id: 'm9' })
    expect(lastInsert).toMatchObject({ user_id: 'u1', source: 'barcode', photo_path: null, photo_sha256: null, meal_slot: 'snack' })
    expect(lastInsert.foods[0].food_item_id).toBe('food_01')
    expect(typeof lastInsert.client_meal_id).toBe('string')
    expect(lastInsert.summary.total_calories_kcal).toBeCloseTo(225.5)
  })
  it('M04 음식 0개면 저장 안 함', async () => {
    const r = await saveProductMeal({ foods: [], mealSlot: 'snack' })
    expect(r.ok).toBe(false)
    expect(lastInsert).toBeNull()
  })
})
