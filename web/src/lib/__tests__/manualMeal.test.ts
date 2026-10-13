/**
 * 사진 없이 기록 v1 (2026-10-13) — 음식 이름으로 찾아 담기 → 끼니 → 저장. 평가 N01~N07 · 배선 W1~W4
 * 설계 IP/integration/meal_manual_log_design_v1.md
 * - 영양은 엔진(/v1/food/resolve — 사진 분석과 같은 match_with_db) 단일 소스. 여기서는 옮기기·재합산만.
 * - 저장: meal_log 1행 source 'manual' · 사진 없음 (DB CHECK 가 'manual' 허용 — 2026-10-13 확인)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

let lastInsert: any = null
vi.mock('../supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => ({ insert: (row: unknown) => { lastInsert = row; return { select: () => Promise.resolve({ data: [{ id: 'm7' }], error: null }) } } }),
  },
}))

import { emptyManualMeal, manualAmountText, saveManualMeal, MANUAL_MAX_FOODS } from '../manualMeal'
import { addFood, applyPortion, portionRequest, removeFood, renameFood, type ResolvedFood } from '../foodEdit'

const HERE = dirname(fileURLToPath(import.meta.url))
const read = (p: string) => readFileSync(resolve(HERE, p), 'utf8')

// 엔진 실측(2026-10-13, resolve_food(name) — serving_g 없음)
const kimchi: ResolvedFood = {
  name_ko: '김치찌개', db_name: '김치찌개', db_matched: true, source: 'GOLD_REF', estimated_serving_g: 400, shape: 'volume',
  calories_kcal: 200, protein_g: 14, carbs_g: 10, fat_g: 11, sugar_g: 3, sodium_mg: 1800, fiber_g: 2, portion_base_g: 400,
}
const ramen: ResolvedFood = {
  name_ko: '라면', db_name: '라면', db_matched: true, source: 'GOLD_REF', estimated_serving_g: 120, shape: 'volume',
  calories_kcal: 500, protein_g: 10, carbs_g: 79, fat_g: 16, sugar_g: 4, sodium_mg: 1790, fiber_g: 2, portion_base_g: 600, package_count: 1,
}

beforeEach(() => { lastInsert = null })

describe('사진 없이 기록 — 담기·양·저장', () => {
  it('N01 빈 식사 → 엔진 음식 담기 = 직접 추가 표식 · 합계 재합산', () => {
    const m0 = emptyManualMeal()
    expect(m0.foods).toEqual([])
    expect(m0.summary.total_calories_kcal).toBe(0)
    const m = addFood(addFood(m0, kimchi), ramen)
    expect(m.foods.map((f) => f.name_ko)).toEqual(['김치찌개', '라면'])
    expect((m.foods[0] as any).user_edit).toBe('added')
    expect(m.summary.total_calories_kcal).toBe(700)
    expect(m.summary.total_sodium_mg).toBe(3590)
  })
  it('N02 담은 음식도 적게·보통·많게 칩 대상(엔진 기준 g)', () => {
    const m = addFood(emptyManualMeal(), kimchi)
    expect(portionRequest(m.foods[0])).toEqual({ name: '김치찌개', baseG: 400, riceSeparated: false })
    const more: ResolvedFood = { ...kimchi, estimated_serving_g: 520, calories_kcal: 260, portion_choice: '많게' }
    const m2 = applyPortion(m, 0, more, '많게')
    expect(m2.summary.total_calories_kcal).toBe(260)
    expect((m2.foods[0] as any).portion_base_g).toBe(400)
  })
  it('N03 양 표시: 봉지 기준이면 «N봉», 아니면 «Ng», 없으면 null', () => {
    const m = addFood(addFood(emptyManualMeal(), kimchi), ramen)
    expect(manualAmountText(m.foods[0])).toBe('400g')
    expect(manualAmountText(m.foods[1])).toBe('1봉')
    expect(manualAmountText({ ...(m.foods[1] as any), package_count: 1.5 })).toBe('1.5봉')
    expect(manualAmountText({ name_ko: 'x' } as any)).toBeNull()
  })
  it('N04 저장: source manual · 사진 없음 · food_item_id · 끼니 · 합계', async () => {
    const m = addFood(addFood(emptyManualMeal(), kimchi), ramen)
    const r = await saveManualMeal({ result: m, mealSlot: 'lunch' })
    expect(r).toEqual({ ok: true, id: 'm7' })
    expect(lastInsert).toMatchObject({ user_id: 'u1', source: 'manual', photo_path: null, photo_sha256: null, meal_slot: 'lunch', engine_version: null })
    expect(lastInsert.foods.map((f: any) => f.food_item_id)).toEqual(['food_01', 'food_02'])
    expect(typeof lastInsert.client_meal_id).toBe('string')
    expect(lastInsert.summary.total_calories_kcal).toBe(700)
  })
  it('N05 음식 0개면 저장 안 함', async () => {
    const r = await saveManualMeal({ result: emptyManualMeal(), mealSlot: 'lunch' })
    expect(r.ok).toBe(false)
    expect(lastInsert).toBeNull()
  })
  it('N06 저장 합계는 목록 재합산(넘겨받은 summary 를 믿지 않음)', async () => {
    const m = addFood(emptyManualMeal(), kimchi)
    await saveManualMeal({ result: { ...m, summary: { ...m.summary, total_calories_kcal: 9999 } }, mealSlot: 'dinner' })
    expect(lastInsert.summary.total_calories_kcal).toBe(200)
  })
  it('N07 상한: MANUAL_MAX_FOODS 초과 저장 거부 · 빼기 후 재합산', async () => {
    expect(MANUAL_MAX_FOODS).toBe(20)
    let m = emptyManualMeal()
    for (let i = 0; i < MANUAL_MAX_FOODS + 1; i++) m = addFood(m, kimchi)
    const r = await saveManualMeal({ result: m, mealSlot: 'snack' })
    expect(r.ok).toBe(false)
    expect(lastInsert).toBeNull()
    const less = removeFood(addFood(addFood(emptyManualMeal(), kimchi), ramen), 1)
    expect(less.summary.total_calories_kcal).toBe(200)
  })
  it('N08 이름 바꾸기: 옛 음식의 양 표식(봉지 수·선택·기준 g)이 새 음식에 남지 않음', () => {
    const m = applyPortion(addFood(emptyManualMeal(), ramen), 0, { ...ramen, package_count: 1.5, portion_choice: '많게' }, '많게')
    expect((m.foods[0] as any).package_count).toBe(1.5)
    const noBase: ResolvedFood = { ...kimchi, portion_base_g: null }
    const r = renameFood(m, 0, noBase) as any
    const f = r.foods[0]
    expect(f.name_ko).toBe('김치찌개')
    expect(f.package_count).toBeUndefined()
    expect(f.portion_choice).toBeUndefined()
    expect(f.portion_base_g).toBeUndefined()
    expect(renameFood(m, 0, kimchi).foods[0]).toMatchObject({ portion_base_g: 400 })
  })
})

describe('백반·정식 구성 합산 v1 — 나눠 담기', () => {
  // 엔진 실측(resolve_food('김치찌개백반') 10-13): 세트 542.8 · set_components 4개(각 «보통», 기준 g = 표의 g)
  const part = (name_ko: string, g: number, kcal: number): ResolvedFood => ({
    name_ko, db_name: name_ko, db_matched: true, source: 'GOLD_REF', estimated_serving_g: g, shape: null,
    calories_kcal: kcal, protein_g: 1, carbs_g: 1, fat_g: 1, sugar_g: 0, sodium_mg: 10, fiber_g: 0, portion_base_g: g, portion_choice: '보통',
  })
  const set: ResolvedFood = {
    ...kimchi, name_ko: '김치찌개백반', db_name: '김치찌개백반', estimated_serving_g: 710, portion_base_g: 710, calories_kcal: 542.8,
    set_components: [part('흰밥', 210, 315), part('김치찌개', 400, 200), part('배추김치', 40, 6.8), part('콩나물무침', 60, 21)],
  }
  it('N09 세트를 담으면 구성 음식 4개로 나눠 담김 · 합계 = 세트 · 각자 양 칩', () => {
    const m = addFood(emptyManualMeal(), set)
    expect(m.foods.map((f) => f.name_ko)).toEqual(['흰밥', '김치찌개', '배추김치', '콩나물무침'])
    expect(m.summary.total_calories_kcal).toBeCloseTo(542.8, 1)
    expect(m.foods.every((f) => (f as any).user_edit === 'added')).toBe(true)
    expect(m.foods.map((f) => portionRequest(f)?.baseG)).toEqual([210, 400, 40, 60])
    expect(m.foods.every((f) => (f as any).set_components === undefined)).toBe(true)
  })
  it('N10 이름 바꾸기는 세트를 한 줄로 유지(구성 목록은 저장하지 않음)', () => {
    const m = renameFood(addFood(emptyManualMeal(), kimchi), 0, set)
    expect(m.foods).toHaveLength(1)
    expect(m.foods[0].name_ko).toBe('김치찌개백반')
    expect((m.foods[0] as any).set_components).toBeUndefined()
    expect(m.summary.total_calories_kcal).toBeCloseTo(542.8, 1)
  })
})

describe('사진 없이 기록 — 배선', () => {
  it('W1 Meal.tsx: 결과 없을 때 MEAL_EDIT_ENABLED 로 ManualMealCard 렌더 + 기록 목록 새로고침', () => {
    const s = read('../../pages/Meal.tsx')
    expect(s).toMatch(/import ManualMealCard from '\.\.\/components\/ManualMealCard'/)
    expect(s).toMatch(/!result && MEAL_EDIT_ENABLED && <ManualMealCard onSaved=\{\(\) => setHistoryKey/)
  })
  it('W2 카드: 엔진 음식 찾기(FoodEditPanel add) → addFood · 저장은 saveManualMeal', () => {
    const s = read('../../components/ManualMealCard.tsx')
    expect(s).toMatch(/<FoodEditPanel[^>]*mode="add"/)
    expect(s).toMatch(/addFood\(/)
    expect(s).toMatch(/saveManualMeal\(/)
  })
  it('W3 카드: 칩은 portionRequest 로만 그리고 resolveFood(portionChoice) → applyPortion', () => {
    const s = read('../../components/ManualMealCard.tsx')
    expect(s).toMatch(/portionRequest\(/)
    expect(s).toMatch(/resolveFood\([^)]*portionChoice/)
    expect(s).toMatch(/applyPortion\(/)
  })
  it('W4 목록·상세: manual 은 ✍️ 표시', () => {
    expect(read('../../components/MealHistory.tsx')).toMatch(/source === 'manual' \? '✍️'/)
    expect(read('../../components/MealDetail.tsx')).toMatch(/source === 'manual' \? ' · ✍️ 직접 기록'/)
  })
})
