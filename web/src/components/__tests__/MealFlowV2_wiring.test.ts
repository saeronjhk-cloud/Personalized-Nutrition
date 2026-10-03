/**
 * 식사 기록 흐름 v2 — 배선 W1~W5 (IP/integration/meal_flow_v2_eval_v1.md §W, 소스 검사)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf-8')
const flags = read('../../lib/flags.ts')
const meal = read('../../pages/Meal.tsx')
const result = read('../MealResult.tsx')
const history = read('../MealHistory.tsx')
const panel = read('../LeftoverPanel.tsx')
const after = read('../AfterSaveLeftover.tsx')
const detail = read('../MealDetail.tsx')
const detailLib = read('../../lib/mealDetail.ts')

describe('식사 흐름 v2 — 배선', () => {
  it('W1 플래그 기본 OFF · v2 UI 는 플래그 아래', () => {
    expect(flags).toContain("export const MEAL_FLOW_V2_ENABLED = import.meta.env.VITE_MEAL_FLOW_V2 === 'true'")
    expect(meal).toContain('flowV2={MEAL_FLOW_V2_ENABLED}')
    expect(meal).toContain('afterSave={MEAL_FLOW_V2_ENABLED && savedId')
    expect(result).toContain("{flowV2 ? '① 사진 속 음식이 맞나요?' : '분석 결과'}")
    expect(history).toContain('const isDetail = MEAL_FLOW_V2_ENABLED && detailId === r.id')
    expect(history.match(/<MealDetail /g)?.length).toBe(1)
  })
  it('W2 탭 순서 v2 = 식후 사진→전체→음식별 · v1 불변', () => {
    const st = panel.indexOf('= [', panel.indexOf('export const MODES_V2'))
    const v2 = panel.slice(st, panel.indexOf('\n]', st))
    expect(v2.indexOf("'photo'")).toBeLessThan(v2.indexOf("'all'"))
    expect(v2.indexOf("'all'")).toBeLessThan(v2.indexOf("'perfood'"))
    expect(panel).toContain("{ key: 'all', label: '전체' }, { key: 'perfood', label: '음식별' }, { key: 'photo', label: '사진 추정' }")
    expect(history).toContain("order={MEAL_FLOW_V2_ENABLED ? 'v2' : 'v1'}")
  })
  it('W3 저장 id 있을 때만 · 식후 사진은 suggest → confirm 2단계', () => {
    expect(meal).toMatch(/MEAL_FLOW_V2_ENABLED && savedId\s*\n\s*\? <AfterSaveLeftover mealId=\{savedId\}/)
    // confirmPhotoAi 는 미리보기(photoPreview) 화면의 버튼에서만 호출
    expect(panel.match(/confirmPhotoAi\(/g)?.length).toBe(1)
    expect(panel).toContain('onClick={confirmPhoto}')
    const preview = panel.slice(panel.indexOf('photoPreview ? ('), panel.indexOf(') : (', panel.indexOf('photoPreview ? (')))
    expect(preview).toContain('onClick={confirmPhoto}')
    expect(after).not.toContain('confirmPhotoAi')
  })
  it('W4 먹은 양 패널은 LeftoverPanel 하나', () => {
    expect(history).toContain('<LeftoverPanel ')
    for (const fn of ['adjustSliderSingle', 'adjustPerFood', 'suggestPhotoAi', 'confirmPhotoAi']) expect(history).not.toContain(fn)
    for (const fn of ['adjustPerFood', 'suggestPhotoAi', 'confirmPhotoAi']) expect(after).not.toContain(fn)
    // 저장후 카드의 직접 호출은 «다 먹었어요 ÷ N» 한 곳뿐(평가 P07)
    expect(after.match(/adjustSliderSingle\(/g)?.length).toBe(1)
    expect(after).toContain('adjustSliderSingle(mealId, splitRatio(1, people))')
  })
  it('W5 상세·저장후 카드에 영양 산식 없음', () => {
    for (const src of [detail, detailLib, after]) {
      expect(src).not.toMatch(/calories_kcal\s*\)?\s*[*/]/)
      expect(src).not.toMatch(/fetch\(/)
    }
  })
})
