/**
 * 식사 기록 흐름 v2 — 평가 N01~N03 · L01~L06 · D01~D05 (IP/integration/meal_flow_v2_eval_v1.md)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

let insertResult: any = { data: [{ id: 'new1' }], error: null }
let existing: any[] = [{ id: 'old9' }]
const eqs: unknown[][] = []
vi.mock('../supabase', () => {
  const sel: any = { eq: (...a: unknown[]) => { eqs.push(a); return sel }, limit: () => Promise.resolve({ data: existing, error: null }) }
  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
      storage: { from: () => ({ upload: async () => ({ error: null }) }) },
      from: () => ({ insert: () => ({ select: () => Promise.resolve(insertResult) }), select: () => sel }),
    },
  }
})

import { saveMeal } from '../nutrilens'
import type { MealFood, MealSummary } from '../nutrilens'
import type { MealRecord } from '../mealHistory'
import { leftoverStatusLabel, mealDetailView, ANALYZE_BUSY_MSG, ANALYZE_WAIT_MSG } from '../mealDetail'

const sum = (k: number, p = 10): MealSummary => ({ total_calories_kcal: k, total_protein_g: p, total_carbs_g: 50.26, total_fat_g: 5, total_sodium_mg: 800, total_sugar_g: 2, total_fiber_g: 1 })
const food = (name: string, kcal: number, x: Record<string, unknown> = {}) => ({ name_ko: name, calories_kcal: kcal, protein_g: 3.14, carbs_g: 20.05, fat_g: 1, sodium_mg: 1, sugar_g: 0, fiber_g: 0, ...x }) as MealFood
function rec(o: Partial<MealRecord> = {}): MealRecord {
  return { id: 'm1', eaten_at: '2026-10-02T03:30:00.000Z', meal_slot: 'lunch', photo_path: null,
    foods: [food('국밥', 500.4, { estimated_serving_g: 499.6, food_item_id: 'food_01' }), food('깍두기', 20, { user_edit: 'added' })],
    summary: sum(520), adjusted_summary: null, eaten_ratio: 1, leftover_method: 'none', ...o }
}
const blob = () => new Blob(['x'])
beforeEach(() => { insertResult = { data: [{ id: 'new1' }], error: null }; existing = [{ id: 'old9' }]; eqs.length = 0 })

describe('N. 문구·저장 id', () => {
  it('N01 «사진은 준비하고» 제거 · 분석 문구', () => {
    const meal = readFileSync(resolve(__dirname, '../../pages/Meal.tsx'), 'utf-8')
    expect(meal).not.toContain('사진은 준비하고')
    expect(meal).toContain('{waiting ? ANALYZE_WAIT_MSG : ANALYZE_BUSY_MSG}')
    expect(ANALYZE_BUSY_MSG).toBe('사진을 분석하고 있어요…')
    expect(ANALYZE_WAIT_MSG).toBe('분석 중이에요… 음식이 많으면 조금 더 걸려요')
  })
  it('N02 저장 성공 → id', async () => {
    const r = await saveMeal({ blob: blob(), result: { foods: [food('a', 1)], summary: sum(1) } as any, photo_sha256: 'h', clientMealId: 'c1' })
    expect(r).toEqual({ ok: true, id: 'new1' })
  })
  it('N03 중복(23505) → client_meal_id 로 찾은 id', async () => {
    insertResult = { data: null, error: { code: '23505', message: 'dup' } }
    const r = await saveMeal({ blob: blob(), result: { foods: [food('a', 1)], summary: sum(1) } as any, photo_sha256: 'h', clientMealId: 'c1' })
    expect(r).toEqual({ ok: true, id: 'old9' })
    expect(eqs).toContainEqual(['client_meal_id', 'c1'])
    expect(eqs).toContainEqual(['user_id', 'u1'])
  })
})

describe('L. 먹은 양 상태 라벨', () => {
  it('L01 보정 없음 → null', () => expect(leftoverStatusLabel(rec())).toBeNull())
  it('L02 slider 0.7', () => expect(leftoverStatusLabel(rec({ adjusted_summary: sum(364), eaten_ratio: 0.7, leftover_method: 'slider' }))).toBe('먹은 양 70%'))
  it('L03 photo_ai 0.6', () => expect(leftoverStatusLabel(rec({ adjusted_summary: sum(312), eaten_ratio: 0.6, leftover_method: 'photo_ai' }))).toBe('식후 사진 60%'))
  it('L04 음식별(slider+평균 0.8)', () => expect(leftoverStatusLabel(rec({ adjusted_summary: sum(400), eaten_ratio: 0.8, leftover_method: 'slider' }))).toBe('먹은 양 80%'))
  it('L05 이상값 → 퍼센트 없이', () => {
    expect(leftoverStatusLabel(rec({ adjusted_summary: sum(1), eaten_ratio: 1.5, leftover_method: 'slider' }))).toBe('먹은 양 반영')
    expect(leftoverStatusLabel(rec({ adjusted_summary: sum(1), eaten_ratio: NaN, leftover_method: 'photo_ai' }))).toBe('식후 사진 반영')
  })
  it('L06 100%로 되돌린 상태 → null', () => expect(leftoverStatusLabel(rec({ adjusted_summary: sum(520), eaten_ratio: 1, leftover_method: 'slider' }))).toBeNull())
})

describe('D. 상세 뷰 모델', () => {
  it('D01 칩 = 실섭취 · 반올림', () => {
    const v = mealDetailView(rec({ adjusted_summary: sum(364.6, 7.04), eaten_ratio: 0.7, leftover_method: 'slider' }))
    expect(v.chips.find((c) => c.label === '칼로리')!.value).toBe(365)
    expect(v.chips.find((c) => c.label === '단백질')!.value).toBe(7)
    expect(v.chips.find((c) => c.label === '탄수화물')!.value).toBe(50.3)
  })
  it('D02 보정 있으면 before/after · 없으면 before null', () => {
    const a = mealDetailView(rec({ adjusted_summary: sum(364), eaten_ratio: 0.7, leftover_method: 'slider' }))
    expect([a.kcalBefore, a.kcalAfter, a.status]).toEqual([520, 364, '먹은 양 70%'])
    const b = mealDetailView(rec())
    expect([b.kcalBefore, b.kcalAfter, b.status]).toEqual([null, 520, null])
  })
  it('D03 음식 행', () => {
    const [f1, f2] = mealDetailView(rec()).foods
    expect(f1).toEqual({ key: 'food_01', name: '국밥', grams: 500, amountText: '500g', kcal: 500, protein: 3.1, carbs: 20.1, fat: 1, mark: null, partial: false })
    expect(f2.grams).toBeNull()
    expect(f2.mark).toBe('직접 추가')
    expect(f2.amountText).toBeNull()
    // 가공식품은 먹은 양 라벨
    const pv = mealDetailView(rec({ foods: [food('새우깡', 175, { barcode: '8801043014809', amount: '½개(45g)', estimated_serving_g: 45 })] }))
    expect(pv.foods[0].amountText).toBe('½개(45g)')
    const pp = mealDetailView(rec({ foods: [food('새우깡', 210, { barcode: '8801043012607', amount: '½개(45g)', missing_nutrients: ['carbs_g', 'sugar_g', 'sodium_mg'] })] }))
    expect(pp.foods[0].partial).toBe(true)
  })
  it('D04 빈 foods·이상값 → 0, throw 없음', () => {
    const v = mealDetailView(rec({ foods: [{ name_ko: '', calories_kcal: 'x' } as any], summary: {} as any }))
    expect(v.foods[0]).toMatchObject({ name: '음식 1', kcal: 0, protein: 0 })
    expect(v.kcalAfter).toBe(0)
    expect(mealDetailView(rec({ foods: undefined as any })).foods).toEqual([])
  })
  it('D05 끼니·날짜 라벨', () => {
    const d = new Date('2026-10-02T03:30:00.000Z')
    const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0')
    expect(mealDetailView(rec()).when).toBe(`점심 · ${d.getMonth() + 1}월 ${d.getDate()}일 ${hh}:${mm}`)
  })
})
