/**
 * 음식 편집 v1 — 렌더 스모크 (서버 렌더로 JSX 런타임 오류·조건부 노출 확인)
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('../../lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }))
import MealResult from '../MealResult'

const result = {
  foods: [{ name_ko: '매운탕', calories_kcal: 300, protein_g: 20, carbs_g: 10, fat_g: 15, sodium_mg: 2000, sugar_g: 3, fiber_g: 1, estimated_serving_g: 500 }],
  summary: { total_calories_kcal: 300, total_protein_g: 20, total_carbs_g: 10, total_fat_g: 15, total_sodium_mg: 2000, total_sugar_g: 3, total_fiber_g: 1 },
} as any
const base = { result, previewUrl: null, slot: 'lunch' as const, onSlot: () => {}, busy: false, onSave: () => {}, onReset: () => {} }
const edit = { onRename: () => {}, onRemove: () => {}, onAdd: () => {} }

describe('MealResult 편집 렌더', () => {
  it('edit 있음 + 저장 전 → 수정·삭제·추가 버튼', () => {
    const html = renderToStaticMarkup(createElement(MealResult, { ...base, saved: false, edit }))
    expect(html).toContain('매운탕 이름 바꾸기')
    expect(html).toContain('매운탕 삭제')
    expect(html).toContain('+ 빠진 음식 추가')
  })
  it('edit 없음(플래그 OFF) → 편집 UI 없음', () => {
    const html = renderToStaticMarkup(createElement(MealResult, { ...base, saved: false }))
    expect(html).not.toContain('빠진 음식 추가')
    expect(html).not.toContain('이름 바꾸기')
  })
  it('저장 후 → 편집 UI 없음', () => {
    const html = renderToStaticMarkup(createElement(MealResult, { ...base, saved: true, edit }))
    expect(html).not.toContain('빠진 음식 추가')
  })
  it('음식 0개 → 안내 + 저장 버튼 disabled', () => {
    const empty = { ...result, foods: [], summary: { ...result.summary, total_calories_kcal: 0 } }
    const html = renderToStaticMarkup(createElement(MealResult, { ...base, result: empty, saved: false, edit }))
    expect(html).toContain('음식을 하나 이상 남겨 주세요')
    expect(html).toMatch(/<button[^>]*disabled[^>]*>기록에 저장/)
  })
  it('직접 수정 표식', () => {
    const r2 = { ...result, foods: [{ ...result.foods[0], name_ko: '소고기국밥', user_edit: 'renamed', ai_name: '매운탕' }] }
    const html = renderToStaticMarkup(createElement(MealResult, { ...base, result: r2, saved: false, edit }))
    expect(html).toContain('직접 수정')
  })
})
