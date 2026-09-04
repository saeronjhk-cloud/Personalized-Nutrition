import { describe, it, expect } from 'vitest'
import { applyAlternate, alternatesOf, recomputeSummary } from '../foodCorrection'
import type { AnalyzeResult } from '../nutrilens'

function food(name: string, kcal: number, extra: Record<string, unknown> = {}) {
  return {
    name_ko: name, calories_kcal: kcal, protein_g: 10, carbs_g: 20,
    fat_g: 5, sodium_mg: 900, sugar_g: 3, fiber_g: 2, ...extra,
  } as any
}

function result(): AnalyzeResult {
  const foods = [
    food('설렁탕', 275, {
      alternates: [{ name_ko: '곰탕', calories_kcal: 300, protein_g: 22, fiber_g: 1 }],
      alternates_reason: 'indistinguishable_pair',
      match_confidence: 'high',
    }),
    food('쌀밥', 335),
  ]
  return {
    foods,
    summary: {
      total_calories_kcal: 610, total_protein_g: 20, total_carbs_g: 40,
      total_fat_g: 10, total_sodium_mg: 1800, total_sugar_g: 6,
      total_fiber_g: 4,
    } as any,
  } as AnalyzeResult
}

describe('구별 불가 쌍 — 사용자 정정', () => {
  it('대안이 붙은 음식만 후보를 갖는다', () => {
    const r = result()
    expect(alternatesOf(r.foods[0]).map((a) => a.name_ko)).toEqual(['곰탕'])
    expect(alternatesOf(r.foods[1])).toEqual([])
  })

  it('이름과 영양이 함께 바뀐다 — 이름만 바꾸면 칼로리가 거짓이 된다', () => {
    const r = applyAlternate(result(), 0, '곰탕')
    expect(r.foods[0].name_ko).toBe('곰탕')
    expect(r.foods[0].calories_kcal).toBe(300)
    expect(r.foods[0].protein_g).toBe(22)
  })

  it('★ 합계가 따라 바뀐다 — 저장되는 값은 summary 다', () => {
    const r = applyAlternate(result(), 0, '곰탕')
    expect(r.summary.total_calories_kcal).toBe(300 + 335)
  })

  it('합계는 «다시 더해서» 낸다 — 서버 합계가 어긋나 있어도 표류하지 않는다', () => {
    const base = result()
    ;(base.summary as any).total_calories_kcal = 99999   // 일부러 어긋난 값
    const r = applyAlternate(base, 0, '곰탕')
    expect(r.summary.total_calories_kcal).toBe(635)
  })

  it('★ 되돌릴 수 있다 — 바꾼 뒤 후보에 원래 이름이 들어간다', () => {
    const once = applyAlternate(result(), 0, '곰탕')
    expect(alternatesOf(once.foods[0]).map((a) => a.name_ko)).toEqual(['설렁탕'])
    const back = applyAlternate(once, 0, '설렁탕')
    expect(back.foods[0].name_ko).toBe('설렁탕')
    expect(back.foods[0].calories_kcal).toBe(275)
    expect(back.summary.total_calories_kcal).toBe(610)
  })

  it('★ 원본을 변형하지 않는다 — 저장 경로가 옛 객체를 들고 있어도 안전해야 한다', () => {
    const r = result()
    const snapshot = JSON.stringify(r)
    applyAlternate(r, 0, '곰탕')
    expect(JSON.stringify(r)).toBe(snapshot)
  })

  it('사용자가 고른 이름은 DB 매칭 신뢰도로 표시하지 않는다', () => {
    const r = applyAlternate(result(), 0, '곰탕')
    expect(r.foods[0].match_confidence).toBe('user_selected')
    expect((r.foods[0] as any).name_source).toBe('user_correction')
  })

  it('다른 음식은 건드리지 않는다', () => {
    const r = applyAlternate(result(), 0, '곰탕')
    expect(r.foods[1]).toEqual(result().foods[1])
  })

  it('없는 후보·잘못된 index 는 원본을 그대로 돌려준다', () => {
    const r = result()
    expect(applyAlternate(r, 0, '갈비탕')).toBe(r)
    expect(applyAlternate(r, 1, '곰탕')).toBe(r)
    expect(applyAlternate(r, 9, '곰탕')).toBe(r)
    expect(applyAlternate(r, -1, '곰탕')).toBe(r)
  })

  it('recomputeSummary 는 summary 에 «있는» 키만 다시 센다', () => {
    const s = recomputeSummary([food('a', 100), food('b', 50)],
                               { total_calories_kcal: 0 } as any)
    expect(s.total_calories_kcal).toBe(150)
    expect((s as any).total_protein_g).toBeUndefined()
  })
})
