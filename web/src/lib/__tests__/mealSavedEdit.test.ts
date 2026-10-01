/**
 * 저장된 식사 «음식 편집» v1 — 평가 I01~I05 · S01~S11 · H01~H04
 * (IP/integration/meal_saved_edit_eval_v1.md)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const calls: { op: string; args: unknown[] }[] = []
let updateRows: unknown[] = [{ id: 'm1' }]
let lastInsert: any = null
vi.mock('../supabase', () => {
  const chain: any = {}
  for (const op of ['update', 'eq', 'select', 'order', 'limit']) {
    chain[op] = (...args: unknown[]) => {
      calls.push({ op, args })
      if (op === 'select' && calls.some((c) => c.op === 'update')) return Promise.resolve({ data: updateRows, error: null })
      return chain
    }
  }
  chain.insert = (row: unknown) => { lastInsert = row; return Promise.resolve({ error: null }) }
  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
      from: (t: string) => { calls.push({ op: 'from', args: [t] }); return chain },
      storage: { from: () => ({ upload: async () => ({ error: null }) }) },
    },
  }
})

import type { MealFood, MealSummary } from '../nutrilens'
import { saveMeal } from '../nutrilens'
import { assignFoodItemIds } from '../foodEdit'
import type { ResolvedFood } from '../foodEdit'
import { kcalOf, isAdjusted, summarizeMeals, MEAL_LIST_COLUMNS, type MealRecord } from '../mealHistory'
import {
  startSavedEdit, draftRename, draftRemove, draftAdd, canSaveDraft, needsLeftoverResetConfirm,
  buildSavedEditUpdate, saveSavedEdit, LEFTOVER_RESET, CONFLICT_MSG,
} from '../mealSavedEdit'

function food(name: string, kcal: number, extra: Record<string, unknown> = {}): MealFood {
  return { name_ko: name, calories_kcal: kcal, protein_g: 1, carbs_g: 1, fat_g: 1, sodium_mg: 100, sugar_g: 0, fiber_g: 0, ...extra } as MealFood
}
function sum(kcal: number): MealSummary {
  return { total_calories_kcal: kcal, total_protein_g: 3, total_carbs_g: 3, total_fat_g: 3, total_sodium_mg: 300, total_sugar_g: 0, total_fiber_g: 0 }
}
function rec(over: Partial<MealRecord> = {}): MealRecord {
  return {
    id: 'm1', eaten_at: new Date().toISOString(), meal_slot: 'lunch', photo_path: 'u1/x.jpg',
    foods: [food('매운탕', 300, { estimated_serving_g: 350 }), food('흰밥', 300), food('김치', 20)],
    summary: sum(620), adjusted_summary: null, updated_at: '2026-10-01T03:00:00.123456+00:00', meal_session_id: null,
    ...over,
  }
}
const gukbap: ResolvedFood = {
  name_ko: '소고기국밥', db_name: '소고기국밥', db_matched: true, source: 'GOLD_REF', estimated_serving_g: 350,
  calories_kcal: 166, protein_g: 8, carbs_g: 27.4, fat_g: 2.4, sugar_g: 0, sodium_mg: 806.8, fiber_g: 0,
}
const egg: ResolvedFood = { ...gukbap, name_ko: '계란찜', db_name: '계란찜', estimated_serving_g: 150, calories_kcal: 110 }

beforeEach(() => { calls.length = 0; updateRows = [{ id: 'm1' }]; lastInsert = null })

describe('I. food_item_id 고정', () => {
  it('I01 id 없는 3개 → food_01~03 · 원본 불변', () => {
    const src = [food('a', 1), food('b', 1), food('c', 1)]
    const out = assignFoodItemIds(src)
    expect(out.map((f) => f.food_item_id)).toEqual(['food_01', 'food_02', 'food_03'])
    expect(src[0].food_item_id).toBeUndefined()
  })
  it('I02 부분 id 충돌 → 다음 빈 번호 · 중복 0', () => {
    const out = assignFoodItemIds([food('a', 1, { food_item_id: 'food_02' }), food('b', 1)])
    expect(out.map((f) => f.food_item_id)).toEqual(['food_02', 'food_03'])
  })
  it('I03 saveMeal insert 의 모든 foods 에 food_item_id', async () => {
    await saveMeal({ blob: new Blob(['x']), result: { foods: [food('a', 1), food('b', 2)], summary: sum(3) } as any, photo_sha256: 'h', clientMealId: 'c' })
    expect(lastInsert.foods.map((f: MealFood) => f.food_item_id)).toEqual(['food_01', 'food_02'])
  })
  it('I04 편집 시작 후 2번 삭제 → food_01, food_03 유지', () => {
    const d = draftRemove(startSavedEdit(rec()), 1)
    expect(d.foods.map((f) => f.food_item_id)).toEqual(['food_01', 'food_03'])
  })
  it('I05 삭제 후 추가 → food_04 (마지막 번호를 지워도 재사용 안 함)', () => {
    let d = draftRemove(startSavedEdit(rec()), 2) // food_03 삭제
    d = draftAdd(d, egg)
    expect(d.foods.map((f) => f.food_item_id)).toEqual(['food_01', 'food_02', 'food_04'])
  })
})

describe('S. 편집 → UPDATE 페이로드', () => {
  it('S01 이름 바꾸기: 엔진 영양 · 정정 표식 · after_save · 재합산 · 보정 컬럼 없음', () => {
    const r = rec()
    const d = draftRename(startSavedEdit(r), 0, gukbap)
    const p = buildSavedEditUpdate(r, d)!
    const f = (p.foods as any[])[0]
    expect(f.name_ko).toBe('소고기국밥')
    expect(f.calories_kcal).toBe(166)
    expect(f.user_edit).toBe('renamed')
    expect(f.ai_name).toBe('매운탕')
    expect(f.edit_stage).toBe('after_save')
    expect(f.food_item_id).toBe('food_01')
    expect((p.summary as any).total_calories_kcal).toBe(166 + 300 + 20)
    expect('adjusted_summary' in p).toBe(false)
  })
  it('S02 저장 전에 이미 바꾼 음식을 다시 바꿔도 ai_name 유지', () => {
    const r = rec({ foods: [food('해물탕', 280, { user_edit: 'renamed', ai_name: '매운탕' })] })
    const d = draftRename(startSavedEdit(r), 0, gukbap)
    expect((d.foods[0] as any).ai_name).toBe('매운탕')
  })
  it('S03 삭제: 제거 · 재합산 · 원본 불변', () => {
    const r = rec()
    const d = draftRemove(startSavedEdit(r), 0)
    expect(d.foods.map((f) => f.name_ko)).toEqual(['흰밥', '김치'])
    expect(d.summary.total_calories_kcal).toBe(320)
    expect(r.foods.length).toBe(3)
    expect(r.foods[0].food_item_id).toBeUndefined()
  })
  it('S04 추가: 끝에 · added · after_save · id', () => {
    const d = draftAdd(startSavedEdit(rec()), egg)
    const f = d.foods[3] as any
    expect(f.name_ko).toBe('계란찜')
    expect(f.user_edit).toBe('added')
    expect(f.edit_stage).toBe('after_save')
    expect(f.food_item_id).toBe('food_04')
  })
  it('S05 마지막 1개 삭제 → 저장 불가 · 페이로드 null', async () => {
    const r = rec({ foods: [food('김치', 20)], summary: sum(20) })
    const d = draftRemove(startSavedEdit(r), 0)
    expect(canSaveDraft(d)).toBe(false)
    expect(buildSavedEditUpdate(r, d)).toBeNull()
    const res = await saveSavedEdit(r, d)
    expect(res.ok).toBe(false)
    expect(calls.some((c) => c.op === 'update')).toBe(false)
  })
  it('S06 편집 없이 저장 → no-op', async () => {
    const r = rec()
    const res = await saveSavedEdit(r, startSavedEdit(r))
    expect(res.ok).toBe(true)
    expect(calls.some((c) => c.op === 'update')).toBe(false)
  })
  it('S07 resolve 실패(null) → 초안 그대로', () => {
    const d0 = startSavedEdit(rec())
    expect(draftRename(d0, 0, null)).toBe(d0)
    expect(draftAdd(d0, null)).toBe(d0)
  })
  it('S08 보정된 기록 → 확인 필요 · 보정 초기화 포함', () => {
    const r = rec({ adjusted_summary: sum(310) })
    expect(needsLeftoverResetConfirm(r)).toBe(true)
    const p = buildSavedEditUpdate(r, draftRemove(startSavedEdit(r), 2))!
    expect(p).toMatchObject(LEFTOVER_RESET)
    expect(p.adjusted_summary).toBeNull()
    expect(p.original_summary).toBeNull()
    expect(p.eaten_ratio).toBe(1)
    expect(p.leftover_method).toBe('none')
    for (const k of ['leftover_note', 'leftover_confidence', 'leftover_adjusted_at', 'leftover_engine_version']) expect(p[k]).toBeNull()
  })
  it('S09 보정 없는 기록 → 확인 불필요', () => {
    expect(needsLeftoverResetConfirm(rec())).toBe(false)
  })
  it('S10 페이로드에 불변 컬럼 없음', () => {
    const r = rec({ adjusted_summary: sum(1) })
    const p = buildSavedEditUpdate(r, draftAdd(startSavedEdit(r), egg))!
    for (const k of ['photo_path', 'photo_sha256', 'eaten_at', 'meal_slot', 'source', 'engine_version', 'user_id', 'id']) expect(k in p).toBe(false)
  })
  it('S11 낙관적 잠금: id·user_id·updated_at 조건 · 0행이면 conflict', async () => {
    const r = rec()
    const d = draftRemove(startSavedEdit(r), 2)
    const ok = await saveSavedEdit(r, d)
    expect(ok.ok).toBe(true)
    const eqs = calls.filter((c) => c.op === 'eq').map((c) => c.args)
    expect(eqs).toContainEqual(['id', 'm1'])
    expect(eqs).toContainEqual(['user_id', 'u1'])
    expect(eqs).toContainEqual(['updated_at', '2026-10-01T03:00:00.123456+00:00'])
    calls.length = 0; updateRows = []
    const bad = await saveSavedEdit(r, d)
    expect(bad).toEqual({ ok: false, conflict: true, message: CONFLICT_MSG })
  })
})

describe('H. 기록 목록 실섭취 우선 (R6 결함 수정)', () => {
  it('H01 보정 있으면 보정 kcal', () => {
    const r = rec({ summary: sum(600), adjusted_summary: sum(300) })
    expect(kcalOf(r)).toBe(300)
    expect(isAdjusted(r)).toBe(true)
  })
  it('H02 보정 없으면 원본', () => {
    expect(kcalOf(rec({ summary: sum(600) }))).toBe(600)
    expect(isAdjusted(rec())).toBe(false)
  })
  it('H03 오늘 합계 = 실섭취 합', () => {
    const now = new Date()
    const st = summarizeMeals([rec({ summary: sum(600), adjusted_summary: sum(300) }), rec({ id: 'm2', summary: sum(400) })], now)
    expect(st.todayKcal).toBe(700)
  })
  it('H04 조회 컬럼에 adjusted_summary·updated_at·meal_session_id', () => {
    for (const c of ['adjusted_summary', 'updated_at', 'meal_session_id']) expect(MEAL_LIST_COLUMNS).toContain(c)
  })
})
