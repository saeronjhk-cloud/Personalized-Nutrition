/**
 * 저장된 식사 «음식 편집» v1 — 배선 가드 W1~W3 (소스 검사)
 * IP/integration/meal_saved_edit_eval_v1.md §W  (W4 = git diff 로 확인 — 인수인계 기록)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf-8')
const flags = read('../../lib/flags.ts')
const history = read('../MealHistory.tsx')
const panel = read('../MealSavedEditPanel.tsx')
const logic = read('../../lib/mealSavedEdit.ts')

describe('저장 후 편집 v1 — 배선', () => {
  it('W1 플래그 기본 OFF · 진입점(v1·v2)과 패널 모두 플래그 아래', () => {
    expect(flags).toContain("export const MEAL_SAVED_EDIT_ENABLED = import.meta.env.VITE_MEAL_SAVED_EDIT_ENABLED === 'true'")
    expect(history).toContain('{MEAL_SAVED_EDIT_ENABLED && (\n                        <button type="button" aria-label="음식 고치기"')
    expect(history).toContain('{MEAL_SAVED_EDIT_ENABLED && (\n                      <button type="button" aria-label="음식 수정"')
    expect(history).toContain('const editPanel = MEAL_SAVED_EDIT_ENABLED && editId === r.id && (')
    expect(history.match(/<MealSavedEditPanel/g)?.length).toBe(1)
  })
  it('W2 영양 출처는 FoodEditPanel(→ foodLookup.resolveFood) 하나 · 산식 없음', () => {
    expect(panel).toContain("import FoodEditPanel from './FoodEditPanel'")
    for (const src of [panel, logic]) {
      expect(src).not.toMatch(/calories_kcal\s*[*/+]\s*\d/)
      expect(src).not.toMatch(/fetch\(/)
    }
    expect(logic).not.toContain('food-lookup')
  })
  it('W3 보정된 기록은 확인 없이 저장 경로에 못 간다', () => {
    // 저장 버튼 → onSaveClick: 보정이면 confirming 만 켜고 return
    expect(panel).toMatch(/if \(draft\.dirty && needsLeftoverResetConfirm\(record\)\) \{ setConfirming\(true\); return \}\n    void doSave\(\)/)
    // doSave 를 부르는 곳은 onSaveClick 과 확인 박스(«초기화하고 저장») 두 곳뿐
    expect(panel.match(/void doSave\(\)/g)?.length).toBe(2)
    expect(panel).toContain("onClick={() => void doSave()}>{busy ? '저장 중…' : '초기화하고 저장'}")
    expect(panel.match(/saveSavedEdit\(/g)?.length).toBe(1)
  })
})
