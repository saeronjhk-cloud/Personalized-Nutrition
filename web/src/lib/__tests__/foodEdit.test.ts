/**
 * 식사 결과 «음식 편집» v1 — 평가 E01~E11 (IP/integration/meal_food_edit_eval_v1.md)
 * 순수 로직만: 영양 숫자는 엔진(resolve)이 준 값을 쓰기만 한다.
 */
import { describe, it, expect } from 'vitest'
import type { AnalyzeResult } from '../nutrilens'
import { applyAlternate } from '../foodCorrection'
import {
  renameFood, removeFood, addFood, canSaveFoods, renameRequestServing, type ResolvedFood,
} from '../foodEdit'

function base(): AnalyzeResult {
  return {
    foods: [
      { name_ko: '매운탕', calories_kcal: 300, protein_g: 20, carbs_g: 10, fat_g: 15, sodium_mg: 2000, sugar_g: 3, fiber_g: 1,
        estimated_serving_g: 500, match_confidence: 'low', quality_flags: ['low_confidence'] } as any,
      { name_ko: '흰밥', calories_kcal: 300, protein_g: 5, carbs_g: 65, fat_g: 1, sodium_mg: 0, sugar_g: 0, fiber_g: 0.5 } as any,
    ],
    summary: { total_calories_kcal: 600, total_protein_g: 25, total_carbs_g: 75, total_fat_g: 16,
      total_sodium_mg: 2000, total_sugar_g: 3, total_fiber_g: 1.5 },
  }
}

const gukbap: ResolvedFood = {
  name_ko: '소고기국밥', db_name: '소고기국밥', db_matched: true, source: 'GOLD_REF', estimated_serving_g: 500, shape: 'volume',
  calories_kcal: 237, protein_g: 11.4, carbs_g: 39.2, fat_g: 3.4, sugar_g: 0, sodium_mg: 1152.5, fiber_g: 0,
}
const egg: ResolvedFood = { ...gukbap, name_ko: '계란찜', db_name: '계란찜', estimated_serving_g: 150, shape: 'volume',
  calories_kcal: 109.5, protein_g: 9, carbs_g: 1.5, fat_g: 7.5, sugar_g: 0.5, sodium_mg: 400, fiber_g: 0 }

describe('식사 결과 음식 편집 — 순수 로직', () => {
  it('E01 이름 바꾸기: 영양 교체 · 합계 재합산 · 정정 표식 · 후보칩 제거', () => {
    const src = base()
    ;(src.foods[0] as any).alternates = [{ name_ko: '해물탕', calories_kcal: 280 }]
    const r = renameFood(src, 0, gukbap)
    const f = r.foods[0] as any
    expect(f.name_ko).toBe('소고기국밥')
    expect(f.calories_kcal).toBe(237)
    expect(f.sodium_mg).toBe(1152.5)
    expect(f.user_edit).toBe('renamed')
    expect(f.ai_name).toBe('매운탕')
    expect(f.match_confidence).toBe('user_selected')
    expect(f.name_source).toBe('user_correction')
    expect(f.alternates).toBeUndefined()
    expect(f.quality_flags ?? []).not.toContain('low_confidence')
    expect(r.summary.total_calories_kcal).toBeCloseTo(537)
    expect(r.summary.total_sodium_mg).toBeCloseTo(1152.5)
    expect((r.summary as any).total_fiber_g).toBeCloseTo(0.5)
  })

  it('E02 두 번 바꿔도 ai_name 은 최초 AI 이름', () => {
    const r = renameFood(renameFood(base(), 0, gukbap), 0, egg)
    expect((r.foods[0] as any).ai_name).toBe('매운탕')
    expect(r.foods[0].name_ko).toBe('계란찜')
  })

  it('E03 추가한 음식의 이름 바꾸기 → user_edit=added 유지 · ai_name 없음', () => {
    const r = renameFood(addFood(base(), egg), 2, gukbap)
    expect((r.foods[2] as any).user_edit).toBe('added')
    expect((r.foods[2] as any).ai_name).toBeUndefined()
  })

  it('E04 삭제: 제거 · 합계 재계산 · 원본 불변', () => {
    const src = base()
    const snap = JSON.stringify(src)
    const r = removeFood(src, 0)
    expect(r.foods.map((f) => f.name_ko)).toEqual(['흰밥'])
    expect(r.summary.total_calories_kcal).toBe(300)
    expect(r.summary.total_sodium_mg).toBe(0)
    expect(JSON.stringify(src)).toBe(snap)
  })

  it('E05 마지막 음식 삭제 → 0개 · 저장 불가', () => {
    const r = removeFood(removeFood(base(), 0), 0)
    expect(r.foods).toHaveLength(0)
    expect(r.summary.total_calories_kcal).toBe(0)
    expect(canSaveFoods(r)).toBe(false)
    expect(canSaveFoods(base())).toBe(true)
    expect(canSaveFoods(null)).toBe(false)
  })

  it('E06 추가: 끝에 붙음 · added · 합계 재계산', () => {
    const r = addFood(base(), egg)
    expect(r.foods).toHaveLength(3)
    expect((r.foods[2] as any).user_edit).toBe('added')
    expect((r.foods[2] as any).name_source).toBe('user_added')
    expect(r.summary.total_calories_kcal).toBeCloseTo(709.5)
  })

  it('E07 범위 밖 index → 같은 객체', () => {
    const src = base()
    expect(renameFood(src, 5, gukbap)).toBe(src)
    expect(renameFood(src, -1, gukbap)).toBe(src)
    expect(removeFood(src, 2)).toBe(src)
  })

  it('E08 resolve 실패(null) → 원본 그대로', () => {
    const src = base()
    expect(renameFood(src, 0, null)).toBe(src)
    expect(addFood(src, null)).toBe(src)
  })

  it('E09 base summary 에 없는 키는 재계산 후에도 없음', () => {
    const src = base()
    delete (src.summary as any).total_fiber_g
    const r = renameFood(src, 0, gukbap)
    expect('total_fiber_g' in r.summary).toBe(false)
  })

  it('E10 후보칩(applyAlternate) 뒤 이름 바꾸기 → ai_name 은 칩 이전 AI 이름', () => {
    const src = base()
    ;(src.foods[0] as any).name_ko = '설렁탕'
    ;(src.foods[0] as any).alternates = [{ name_ko: '곰탕', calories_kcal: 350 }]
    const chip = applyAlternate(src, 0, '곰탕')
    const back = applyAlternate(chip, 0, '설렁탕') // 칩을 되돌려도 원래 AI 이름은 설렁탕
    expect((back.foods[0] as any).ai_name).toBe('설렁탕')
    const r = renameFood(chip, 0, gukbap)
    expect((r.foods[0] as any).ai_name).toBe('설렁탕')
  })

  it('E11 이름 바꾸기 요청 양 = 사진 추정량(유효할 때만)', () => {
    expect(renameRequestServing(base().foods[0])).toBe(500)
    expect(renameRequestServing(base().foods[1])).toBeNull()
    expect(renameRequestServing({ ...base().foods[0], estimated_serving_g: 0 } as any)).toBeNull()
    expect(renameRequestServing({ ...base().foods[0], estimated_serving_g: 5000 } as any)).toBeNull()
  })
})
