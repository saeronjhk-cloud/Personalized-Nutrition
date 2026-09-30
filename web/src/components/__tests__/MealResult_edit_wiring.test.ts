/**
 * 식사 결과 «음식 편집» v1 — 배선 가드 W1~W4 (소스 검사 · Dashboard_diet_wiring 패턴)
 * IP/integration/meal_food_edit_eval_v1.md §W
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf-8')
const flags = read('../../lib/flags.ts')
const meal = read('../../pages/Meal.tsx')
const mealResult = read('../MealResult.tsx')
const panel = read('../FoodEditPanel.tsx')
const lookup = read('../../lib/foodLookup.ts')

describe('음식 편집 v1 — 배선', () => {
  it('W1 플래그 기본 OFF · 편집 UI 는 플래그 && 저장 전만', () => {
    expect(flags).toContain("export const MEAL_EDIT_ENABLED = import.meta.env.VITE_MEAL_EDIT_ENABLED === 'true'")
    expect(meal).toContain('const editHandlers = MEAL_EDIT_ENABLED ? {')
    expect(meal).toContain('edit={editHandlers}')
    expect(mealResult).toContain('const editable = !!edit && !saved')
  })

  it('W2 음식 0개면 저장 불가 — 버튼과 저장 함수 둘 다', () => {
    expect(mealResult).toContain('disabled={busy || !canSave}')
    expect(meal).toContain('!canSaveFoods(result)')
  })

  it('W3 화면은 영양 숫자를 만들지 않음 — foodEdit/foodLookup 만 사용', () => {
    for (const src of [mealResult, panel]) {
      expect(src).not.toMatch(/calories_kcal\s*[*/]\s*\d|\*\s*0\.\d|serving_g\s*\/\s*100/)
      expect(src).not.toMatch(/from ['"]\.\.\/lib\/supabase['"]/)
    }
    expect(meal).toContain('renameFood(prev, i, food)')
    expect(meal).toContain('removeFood(prev, i)')
    expect(meal).toContain('addFood(prev, food)')
  })

  it('W4 IO 는 functions/v1/food-lookup 한 곳', () => {
    expect(lookup).toContain('`${BASE}/functions/v1/food-lookup`')
    expect(lookup.match(/fetch\(/g)).toHaveLength(1)
    expect(panel).toContain("from '../lib/foodLookup'")
  })
})
