/**
 * 식사 흐름 v2 — 함께 먹은 인원 P01~P05 (IP/integration/meal_flow_v2_eval_v1.md §P)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { perFoodShares, splitRatio } from '../leftover_math'

const panel = readFileSync(resolve(__dirname, '../../components/LeftoverPanel.tsx'), 'utf-8')

describe('함께 먹은 인원', () => {
  it('P01 음식별: 각 비율 ÷ 인원', () => {
    const r = perFoodShares([{ name_ko: 'a' }, { name_ko: 'b', food_item_id: 'food_07' }], [100, 50], 2)
    expect(r).toEqual([{ food_item_id: 'food_01', eaten_ratio: 0.5 }, { food_item_id: 'food_07', eaten_ratio: 0.25 }])
    expect(perFoodShares([{}], [100], 1)[0].eaten_ratio).toBe(1)
    expect(perFoodShares([{}], [], 0)[0].eaten_ratio).toBe(1) // 인원 이상값 → 1명, % 없음 → 100
  })
  it('P02 식후 사진 확정 = splitRatio(%/100, 인원)', () => {
    expect(splitRatio(0.6, 2)).toBeCloseTo(0.3)
    expect(panel).toContain('confirmPhotoAi(mealId, splitRatio(pct / 100, sharePeople))')
  })
  it('P03 전체 % (기존과 동일)', () => {
    expect(splitRatio(0.7, 3)).toBe(0.23) // clampRatio 가 소수 2자리로 반올림(기존 규칙)
    expect(panel).toContain('adjustSliderSingle(mealId, splitRatio(p / 100, people))')
    expect(panel).toContain('adjustPerFood(mealId, perFoodShares(foods, pcts, sharePeople))')
  })
  it('P04 v2 는 탭 위 1곳 · v1 은 «전체» 탭 안 1곳 · v1 음식별/사진은 1명(불변)', () => {
    expect(panel).toContain("const sharePeople = order === 'v2' ? people : 1")
    expect(panel.indexOf("{order === 'v2' && peopleRow('몇 명이 함께 드셨나요?')}")).toBeLessThan(panel.indexOf('role="tablist"'))
    expect(panel).toContain("{order !== 'v2' && peopleRow('함께 먹은 인원')}")
    expect(panel.match(/peopleRow\('/g)?.length).toBe(2)
  })
  it('P05 미리보기 kcal 은 서버값 그대로(나눗셈 없음) + 안내', () => {
    expect(panel).toContain('미리보기: 약 {previewKcal} kcal')
    expect(panel).not.toMatch(/previewKcal\s*\/|\/\s*sharePeople|\/\s*people/)
    expect(panel).toContain('반영할 때 ${sharePeople}명으로 나눠요')
  })
  it('되돌리기는 인원과 무관하게 100%(=1)', () => {
    expect(panel).toContain('adjustSliderSingle(mealId, 1)')
    expect(panel).toContain('onClick={revert}')
  })
})
