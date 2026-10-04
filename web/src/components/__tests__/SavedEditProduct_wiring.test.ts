/**
 * 저장된 식사에 가공식품 추가 v1 — 배선 W1~W4 (IP/integration/meal_saved_edit_product_eval_v1.md)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const panel = readFileSync(resolve(__dirname, '../MealSavedEditPanel.tsx'), 'utf-8')
const lib = readFileSync(resolve(__dirname, '../../lib/mealSavedEdit.ts'), 'utf-8')

describe('저장된 식사 가공식품 — 배선', () => {
  it('W1 탭 · 플래그', () => {
    expect(panel).toContain("from '../lib/flags'")
    expect(panel).toContain('MEAL_PRODUCT_ENABLED')
    expect(panel).toContain('🍽️ 음식')
    expect(panel).toContain('📦 가공식품')
    expect(panel).toContain('<ProductAddPanel')
  })
  it('W2 context = source 기준', () => {
    expect(panel).toMatch(/record\.source === 'barcode' \? 'product' : 'photo'/)
  })
  it('W3 가공식품 행 수정 숨김 · 표시', () => {
    expect(panel).toMatch(/!isProductFood\(f\) && \(\s*<button[^>]*이름 바꾸기/)
    expect(panel).toContain('📦 가공식품')
  })
  it('W4 영양 산식 없음', () => {
    for (const src of [panel, lib]) {
      expect(src).not.toMatch(/(calories_kcal|protein_g|carbs_g|fat_g|sodium_mg|sugar_g|fiber_g)\)?\s*[*/]/)
    }
    expect(lib).toContain('export function draftAddProduct')
  })
})
