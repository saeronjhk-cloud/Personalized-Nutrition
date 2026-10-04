/**
 * 사진 식사 + 가공식품 v1 — 배선 W1~W5 (IP/integration/meal_photo_product_mix_eval_v1.md §W)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf-8')
const result = read('../MealResult.tsx')
const meal = read('../../pages/Meal.tsx')
const panel = read('../ProductAddPanel.tsx')
const foodEdit = read('../../lib/foodEdit.ts')

describe('사진 식사 + 가공식품 — 배선', () => {
  it('W1 추가 영역 탭 · 가공식품 탭은 ProductAddPanel · onAddProduct 있을 때만', () => {
    expect(result).toContain('🍽️ 음식')
    expect(result).toContain('📦 가공식품')
    expect(result).toContain('<ProductAddPanel context="photo"')
    expect(result).toMatch(/onAddProduct\s*&&/)
  })
  it('W2 Meal.tsx 는 MEAL_PRODUCT_ENABLED 일 때만 onAddProduct · addProductFood 로 갱신', () => {
    expect(meal).toMatch(/onAddProduct: MEAL_PRODUCT_ENABLED \?/)
    expect(meal).toContain('addProductFood(prev, food)')
  })
  it('W3 context=photo 질문·안내 · 기본 질문 불변', () => {
    expect(panel).toContain('드시기 전에 얼마나 있었나요?')
    expect(panel).toContain('실제로 드신 양은 저장한 뒤 다른 음식과 함께 정해요')
    expect(panel).toContain('얼마나 드셨나요?')
  })
  it('W4 가공식품 행: 배지 · 수정 숨김 · 정보 없음', () => {
    expect(result).toContain('📦 가공식품</span>')
    expect(result).toMatch(/!isProduct\(f\)\s*&&\s*\(\s*<button[^>]*이름 바꾸기/)
    expect(result).toContain("'정보 없음'")
  })
  it('W5 웹 영양 곱셈·나눗셈 없음', () => {
    for (const src of [result, panel]) {
      expect(src).not.toMatch(/(calories_kcal|protein_g|carbs_g|fat_g|sodium_mg|sugar_g|fiber_g)\)?\s*[*/]/)
      expect(src).not.toMatch(/[*/]\s*(factor|qty)\b/)
    }
    expect(foodEdit).toContain('export function addProductFood')
  })
})
