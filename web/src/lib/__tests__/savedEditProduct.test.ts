/**
 * 저장된 식사에 가공식품 추가 v1 — 평가 S01~S06 (IP/integration/meal_saved_edit_product_eval_v1.md)
 */
import { describe, it, expect } from 'vitest'
import type { MealRecord } from '../mealHistory'
import { startSavedEdit, draftAddProduct, draftRemove, draftRename, buildSavedEditUpdate } from '../mealSavedEdit'
import { productFoodFromPortion, type PortionProduct, type Portion } from '../productLog'
import type { ResolvedFood } from '../foodEdit'

function rec(extra: Partial<MealRecord> = {}): MealRecord {
  return {
    id: 'm1', eaten_at: '2026-10-04T03:00:00Z', meal_slot: 'lunch', source: 'photo', updated_at: '2026-10-04T03:00:00Z',
    foods: [{ name_ko: '김밥', food_item_id: 'food_01', calories_kcal: 300, protein_g: 8, carbs_g: 50, fat_g: 7, sodium_mg: 700, sugar_g: 2, fiber_g: 1 } as any],
    summary: { total_calories_kcal: 300, total_protein_g: 8, total_carbs_g: 50, total_fat_g: 7, total_sodium_mg: 700, total_sugar_g: 2, total_fiber_g: 1 } as any,
    adjusted_summary: null,
    ...extra,
  } as MealRecord
}
const shrimp: PortionProduct = { product_id: 77, barcode: '8801043012607', product_name: '새우깡', brand: '농심' }
const half: Portion = { ok: true, kind: 'pack', qty: 0.5, grams: 45, label: '½개(45g)', basis: 'per_serving',
  nutrients: { calories_kcal: 210, protein_g: 3, carbs_g: null, fat_g: 10, sodium_mg: null, sugar_g: null, fiber_g: 1 } }
const product = () => productFoodFromPortion(shrimp, half)!
const gukbap: ResolvedFood = { name_ko: '소고기국밥', estimated_serving_g: 500, calories_kcal: 237, protein_g: 11.4, carbs_g: 39.2, fat_g: 3.4, sugar_g: 0, sodium_mg: 1152.5, fiber_g: 0 }

describe('저장된 식사에 가공식품 추가', () => {
  it('S01 추가 · 새 id · after_save · 합계', () => {
    const d = draftAddProduct(startSavedEdit(rec()), product())
    expect(d.foods.length).toBe(2)
    const f = d.foods[1] as any
    expect(f.food_item_id).toBe('food_02')
    expect(f.edit_stage).toBe('after_save')
    expect(d.dirty).toBe(true)
    expect(d.summary.total_calories_kcal).toBe(510)
  })
  it('S02 제품 필드 보존', () => {
    const f = draftAddProduct(startSavedEdit(rec()), product()).foods[1] as any
    expect(f.barcode).toBe('8801043012607')
    expect(f.amount).toBe('½개(45g)')
    expect(f.portion.kind).toBe('pack')
    expect(f.missing_nutrients).toEqual(['carbs_g', 'sodium_mg', 'sugar_g'])
  })
  it('S03 null → 그대로', () => {
    const d = startSavedEdit(rec())
    expect(draftAddProduct(d, null)).toBe(d)
  })
  it('S04 지운 번호 재사용 금지', () => {
    let d = draftAddProduct(startSavedEdit(rec()), product())
    d = draftRemove(d, 1)
    d = draftAddProduct(d, product())
    expect((d.foods[1] as any).food_item_id).toBe('food_03')
  })
  it('S05 보정된 기록 → 보정 초기화 포함', () => {
    const r = rec({ adjusted_summary: { total_calories_kcal: 150 } as any })
    const p = buildSavedEditUpdate(r, draftAddProduct(startSavedEdit(r), product()))!
    expect(p.adjusted_summary).toBeNull()
    expect(p.eaten_ratio).toBe(1)
    expect(p.original_summary).toBeNull()
  })
  it('S06 가공식품 → 일반 음식 rename 시 제품 필드 제거', () => {
    const d = draftRename(draftAddProduct(startSavedEdit(rec()), product()), 1, gukbap)
    const f = d.foods[1] as any
    expect(f).not.toHaveProperty('barcode')
    expect(f).not.toHaveProperty('amount')
    expect(f.edit_stage).toBe('after_save')
  })
})
