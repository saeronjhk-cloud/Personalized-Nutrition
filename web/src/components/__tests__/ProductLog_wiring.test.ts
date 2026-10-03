/**
 * 가공식품 섭취 기록 v1 — 배선 W1~W3 (IP/integration/meal_product_log_eval_v1.md §W)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf-8')
const flags = read('../../lib/flags.ts')
const meal = read('../../pages/Meal.tsx')
const panel = read('../ProductAddPanel.tsx')
const card = read('../ProductMealCard.tsx')
const lib = read('../../lib/productLog.ts')

describe('가공식품 기록 — 배선', () => {
  it('W1 플래그 기본 OFF · 카드는 플래그 아래 1곳', () => {
    expect(flags).toContain("export const MEAL_PRODUCT_ENABLED = import.meta.env.VITE_MEAL_PRODUCT_ENABLED === 'true'")
    expect(meal).toContain('{!result && MEAL_PRODUCT_ENABLED && <ProductMealCard')
    expect(meal.match(/<ProductMealCard/g)?.length).toBe(1)
  })
  it('W2 웹에 영양 곱셈·나눗셈 없음 — 서버 portion 값만', () => {
    for (const src of [panel, card, lib]) {
      expect(src).not.toMatch(/(calories_kcal|protein_g|carbs_g|fat_g|sodium_mg|sugar_g|fiber_g)\)?\s*[*/]/)
      expect(src).not.toMatch(/[*/]\s*(factor|qty)\b/)
    }
    expect(lib).toContain('/portion')
  })
  it('W3 먹은 양 칩 = ¼·½·1·2개 + 1회 제공량 + 직접 입력 · 비활성 이유 표시', () => {
    expect(panel).toContain('export const PACK_CHIPS = [0.25, 0.5, 1, 2]')
    expect(panel).toContain('>1회 제공량</button>')
    expect(panel).toContain("placeholder={`직접 입력 (${unit})`}")
    expect(panel).toContain('data-testid="unavailable-reasons"')
    expect(panel).toContain("opt('pack')?.available && PACK_CHIPS.map")
  })
})
