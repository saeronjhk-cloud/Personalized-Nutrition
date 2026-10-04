/**
 * 사진 식사 + 가공식품 v1 — 평가 X01~X08 · P01~P03 (IP/integration/meal_photo_product_mix_eval_v1.md)
 */
import { describe, it, expect } from 'vitest'
import type { AnalyzeResult } from '../nutrilens'
import { addProductFood, removeFood, renameFood, assignFoodItemIds, type ResolvedFood } from '../foodEdit'
import { productFoodFromPortion, type PortionProduct, type Portion } from '../productLog'

function photo(): AnalyzeResult {
  return {
    foods: [{ name_ko: '김밥', amount: '1줄', calories_kcal: 300, protein_g: 8, carbs_g: 50, fat_g: 7, sodium_mg: 700, sugar_g: 2, fiber_g: 1, estimated_serving_g: 250 } as any],
    summary: { total_calories_kcal: 300, total_protein_g: 8, total_carbs_g: 50, total_fat_g: 7, total_sodium_mg: 700, total_sugar_g: 2, total_fiber_g: 1 },
  }
}
const shrimp: PortionProduct = { product_id: 77, barcode: '8801043012607', product_name: '새우깡', brand: '농심', serving_size: 30, total_content: 90, content_unit: 'g' }
const half: Portion = {
  ok: true, basis: 'per_serving', kind: 'pack', qty: 0.5, factor: 1.5, grams: 45, unit: 'g', approx: false, label: '½개(45g)',
  nutrients: { calories_kcal: 210, protein_g: 3, carbs_g: null, fat_g: 10, sodium_mg: null, sugar_g: null, fiber_g: 1 },
}
const product = () => productFoodFromPortion(shrimp, half)!
const gukbap: ResolvedFood = {
  name_ko: '소고기국밥', db_name: '소고기국밥', db_matched: true, source: 'GOLD_REF', estimated_serving_g: 500,
  calories_kcal: 237, protein_g: 11.4, carbs_g: 39.2, fat_g: 3.4, sugar_g: 0, sodium_mg: 1152.5, fiber_g: 0,
}

describe('X 사진 식사에 가공식품 섞어 담기', () => {
  it('X01 끝에 붙고 합계 재합산', () => {
    const r = addProductFood(photo(), product())
    expect(r.foods.length).toBe(2)
    expect(r.foods[1].name_ko).toBe('새우깡')
    expect(r.summary.total_calories_kcal).toBe(510)
  })
  it('X02 제품 필드 보존', () => {
    const f = addProductFood(photo(), product()).foods[1] as any
    expect(f.barcode).toBe('8801043012607')
    expect(f.product_id).toBe(77)
    expect(f.portion).toEqual({ kind: 'pack', qty: 0.5, basis: 'per_serving', approx: false })
    expect(f.amount).toBe('½개(45g)')
    expect(f.match_confidence).toBe('product_label')
    expect(f.user_edit).toBe('added')
  })
  it('X03 없는 영양소는 0 으로 합산 · missing 유지', () => {
    const r = addProductFood(photo(), product())
    expect(r.summary.total_carbs_g).toBe(50)
    expect(r.summary.total_sodium_mg).toBe(700)
    expect(r.summary.total_sugar_g).toBe(2)
    expect((r.foods[1] as any).missing_nutrients).toEqual(['carbs_g', 'sodium_mg', 'sugar_g'])
  })
  it('X04 null → 원본 그대로', () => {
    const src = photo()
    expect(addProductFood(src, null)).toBe(src)
  })
  it('X05 원본 불변', () => {
    const src = photo()
    addProductFood(src, product())
    expect(src.foods.length).toBe(1)
    expect(src.summary.total_calories_kcal).toBe(300)
  })
  it('X06 저장 경로 food_item_id 부여', () => {
    const foods = assignFoodItemIds(addProductFood(photo(), product()).foods) as any[]
    expect(foods.map((f) => f.food_item_id)).toEqual(['food_01', 'food_02'])
  })
  it('X07 담은 뒤 삭제 → 합계 원래로', () => {
    const r = removeFood(addProductFood(photo(), product()), 1)
    expect(r.summary.total_calories_kcal).toBe(300)
  })
  it('X08 같은 제품 2번 → 2행 · 2배', () => {
    const r = addProductFood(addProductFood(photo(), product()), product())
    expect(r.foods.length).toBe(3)
    expect(r.summary.total_calories_kcal).toBe(720)
  })
})

describe('P 가공식품 행 이름 바꾸기', () => {
  it('P01 제품 필드 제거', () => {
    const r = renameFood(addProductFood(photo(), product()), 1, gukbap)
    const f = r.foods[1] as any
    for (const k of ['barcode', 'product_id', 'brand', 'portion', 'missing_nutrients', 'amount']) expect(f).not.toHaveProperty(k)
    expect(f.match_confidence).toBe('user_selected')
    expect(f.name_ko).toBe('소고기국밥')
    expect(r.summary.total_calories_kcal).toBe(537)
  })
  it('P02 추가 음식 표식 유지', () => {
    const f = renameFood(addProductFood(photo(), product()), 1, gukbap).foods[1] as any
    expect(f.user_edit).toBe('added')
    expect(f.name_source).toBe('user_added')
  })
  it('P03 일반 음식 rename 회귀', () => {
    const f = renameFood(photo(), 0, gukbap).foods[0] as any
    expect(f.amount).toBe('1줄')
    expect(f.ai_name).toBe('김밥')
    expect(f.user_edit).toBe('renamed')
  })
})
