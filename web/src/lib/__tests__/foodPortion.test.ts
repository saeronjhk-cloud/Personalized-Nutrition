/**
 * 분량 조절 v1 (2026-10-13) — 저장 전 음식별 «적게·보통·많게» 평가 P01~P06
 * 제이 결정: 사진 추정 양이 틀리면 ①단계에서 음식별 칩으로 고친다.
 * 배율·영양 계산은 엔진(/v1/food/resolve portion_choice) 단일 소스 — 여기서는 받은 값을 «쓰기만» 한다.
 * 엔진 테스트: backends/NutriLens/tools/tests/test_portion_choice_v1.py
 */
import { describe, it, expect } from 'vitest'
import type { AnalyzeResult } from '../nutrilens'
import { portionRequest, applyPortion, currentPortion, PORTION_CHOICES, type ResolvedFood } from '../foodEdit'

function meal(): AnalyzeResult {
  return {
    foods: [
      { name_ko: '갈비탕', db_name: '갈비탕', calories_kcal: 628, protein_g: 40, carbs_g: 16, fat_g: 40, sodium_mg: 2000, sugar_g: 2, fiber_g: 0,
        estimated_serving_g: 800, portion_base_g: 785, source: 'GOLD_REF' } as any,
      { name_ko: '돼지국밥', db_name: '돼지국밥', calories_kcal: 260, protein_g: 20, carbs_g: 0, fat_g: 10, sodium_mg: 1500, sugar_g: 0, fiber_g: 0,
        portion_base_g: 640, rice_separated: true, user_edit: 'renamed', ai_name: '순대국', name_source: 'user_correction' } as any,
      { name_ko: '콜라', barcode: '880', match_confidence: 'product_label', calories_kcal: 100, protein_g: 0, carbs_g: 25, fat_g: 0, sodium_mg: 10, sugar_g: 25, fiber_g: 0,
        portion_base_g: 250 } as any,
      { name_ko: '알 수 없는 음식', calories_kcal: 200, protein_g: 5, carbs_g: 30, fat_g: 5, sodium_mg: 300, sugar_g: 1, fiber_g: 1 } as any,
    ],
    summary: { total_calories_kcal: 1188, total_protein_g: 65, total_carbs_g: 71, total_fat_g: 55,
      total_sodium_mg: 3810, total_sugar_g: 28, total_fiber_g: 1 },
  }
}
const galbiMore: ResolvedFood = {
  name_ko: '갈비탕', db_name: '갈비탕', db_matched: true, source: 'GOLD_REF', estimated_serving_g: 1099, shape: 'volume',
  calories_kcal: 879.2, protein_g: 56, carbs_g: 22.4, fat_g: 56, sugar_g: 2.8, sodium_mg: 2800, fiber_g: 0,
  portion_base_g: 785, portion_choice: '많게',
}

describe('분량 조절 v1', () => {
  it('P01 칩 순서 고정 · 기본은 보통', () => {
    expect(PORTION_CHOICES).toEqual(['적게', '보통', '많게'])
    expect(currentPortion(meal().foods[0])).toBe('보통')
    expect(currentPortion({ ...meal().foods[0], portion_choice: '많게' } as any)).toBe('많게')
  })

  it('P02 요청 — db_name·기준 g·밥 분리 여부를 그대로 넘긴다', () => {
    const f = meal().foods
    expect(portionRequest(f[0])).toEqual({ name: '갈비탕', baseG: 785, riceSeparated: false })
    expect(portionRequest(f[1])).toEqual({ name: '돼지국밥', baseG: 640, riceSeparated: true })
  })

  it('P03 칩 없음 — 가공식품 · 기준 g 없음(엔진이 못 맞춘 음식) · 범위 밖', () => {
    const f = meal().foods
    expect(portionRequest(f[2])).toBeNull()
    expect(portionRequest(f[3])).toBeNull()
    expect(portionRequest({ ...f[0], portion_base_g: 0 } as any)).toBeNull()
    expect(portionRequest({ ...f[0], portion_base_g: 2001 } as any)).toBeNull()
  })

  it('P04 적용 — 영양·양만 엔진 값으로, 이름·정정 기록은 유지, 합계 재합산', () => {
    const r = applyPortion(meal(), 0, galbiMore, '많게')
    const g = r.foods[0] as any
    expect(g.calories_kcal).toBe(879.2)
    expect(g.estimated_serving_g).toBe(1099)
    expect(g.portion_choice).toBe('많게')
    expect(g.portion_base_g).toBe(785)
    expect(g.name_ko).toBe('갈비탕')
    expect(r.summary.total_calories_kcal).toBeCloseTo(1188 - 628 + 879.2, 5)
    const r2 = applyPortion(meal(), 1, { ...galbiMore, name_ko: '돼지국밥', db_name: '돼지국밥', portion_base_g: 640 }, '적게')
    const p = r2.foods[1] as any
    expect([p.user_edit, p.ai_name, p.name_source, p.rice_separated]).toEqual(['renamed', '순대국', 'user_correction', true])
  })

  it('P05 반복 탭해도 기준 g 누적 없음 — 기준은 엔진이 돌려준 portion_base_g', () => {
    const once = applyPortion(meal(), 0, galbiMore, '많게')
    expect(portionRequest(once.foods[0])).toEqual({ name: '갈비탕', baseG: 785, riceSeparated: false })
  })

  it('P06 resolved=null · 범위 밖 index → 원본 그대로', () => {
    const m = meal()
    expect(applyPortion(m, 0, null, '많게')).toBe(m)
    expect(applyPortion(m, 9, galbiMore, '많게')).toBe(m)
  })
})
