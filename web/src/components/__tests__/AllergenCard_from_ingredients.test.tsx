/**
 * ★ 먹선 서버 세션77 — DB 경로 «원재료명 알레르기» 표시(제이 결정 2026-10-12: DB 기반 추론에 한해 변경 · OCR 파싱은 그대로).
 *   ① 표시란 미수집 + 원재료 알레르기 → 칩 + «표시란 아님 · 빠질 수 있음» 고지 · 불완전성 고지 유지
 *   ② 표시란이 있으면 원재료 알레르기를 그리지 않는다(섞지 않는다)
 *   ③ 원재료 알레르기가 비었거나 없으면 종전 미수집 문구 그대로(«없다는 뜻은 아니에요»)
 *   ④ 사진 제보(OCR) 결과처럼 필드가 없는 입력은 종전과 똑같다
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import AllergenCard from '../AllergenCard'
import { describeIngredientAllergens, ingredientAllergensMissingLikely } from '../../domain/meokseon/allergens'

const FROM = 'data-testid="allergen-from-ingredients"'
const NOTICE = 'data-testid="allergen-incomplete-notice"'
const LIKELY = 'data-testid="allergen-missing-likely"'
type In = Parameters<typeof AllergenCard>[0]['result']
const html = (r: In) => renderToStaticMarkup(<AllergenCard result={r} />)

describe('AllergenCard — 세션77 원재료명 알레르기(DB 경로)', () => {
  it('① 미수집 + 원재료 알레르기 → 칩 · 표시란 아님 고지 · 포장 확인 고지', () => {
    const h = html({ allergens_available: false, allergens: null, allergens_v2: null,
      allergens_from_ingredients: { names: ['밀', '대두'], rules_version: 'allergen_ing_rules_v1' } })
    expect(h).toContain(FROM)
    expect(h).toContain('원재료명에서 확인된 알레르기')
    expect(h).toContain('밀'); expect(h).toContain('대두')
    expect(h).toContain('제조사 알레르기 표시란이 아니라')
    expect(h).toContain('빠져 있을 수 있어요')
    expect(h).toContain(NOTICE)
    expect(h).not.toMatch(/알레르기\s*없음|알레르겐이\s*없/)
  })
  it('② 표시란이 있으면 원재료 알레르기를 그리지 않는다', () => {
    const h = html({ allergens_available: true, allergens: ['우유'], allergens_v2: { contains: ['우유'], inferred: [], mayContain: [] },
      allergens_from_ingredients: { names: ['밀'] } })
    expect(h).not.toContain(FROM); expect(h).toContain('우유')
  })
  it('③ 원재료 알레르기 빈 배열 → 종전 미수집 문구', () => {
    const h = html({ allergens_available: false, allergens: null, allergens_v2: null, allergens_from_ingredients: { names: [] } })
    expect(h).not.toContain(FROM); expect(h).toContain('알레르겐이 없다는 뜻은 아니에요')
  })
  it('④ 필드 없는 입력(사진 제보·구버전 서버) → 종전과 같다', () => {
    const h = html({ allergens_available: false, allergens: null, allergens_v2: null })
    expect(h).not.toContain(FROM); expect(h).toContain('아직 수집되지 않았어요')
  })
  it('⑤ v2 missing_likely → «빠진 알레르기가 있을 가능성이 높아요» · 원재료 알레르기가 비어도 표시', () => {
    const h1 = html({ allergens_available: false, allergens: null, allergens_v2: null,
      allergens_from_ingredients: { names: ['밀'], composite: ['복합조미'], missing_likely: true } })
    expect(h1).toContain(LIKELY); expect(h1).toContain('빠진 알레르기가 있을 가능성이 높아요'); expect(h1).toContain(FROM)
    const h2 = html({ allergens_available: false, allergens: null, allergens_v2: null,
      allergens_from_ingredients: { names: [], composite: ['스프'], missing_likely: true } })
    expect(h2).toContain(LIKELY); expect(h2).toContain('아직 수집되지 않았어요')
  })
  it('⑥ missing_likely false·표시란 있음 → 고지 없음', () => {
    expect(html({ allergens_available: false, allergens: null, allergens_v2: null, allergens_from_ingredients: { names: ['밀'], missing_likely: false } })).not.toContain(LIKELY)
    expect(html({ allergens_available: true, allergens: ['밀'], allergens_v2: { contains: ['밀'], inferred: [], mayContain: [] }, allergens_from_ingredients: { names: ['밀'], missing_likely: true } })).not.toContain(LIKELY)
    expect(ingredientAllergensMissingLikely(null)).toBe(false)
  })
  it('describeIngredientAllergens — 표시란 있으면 [] · 공백·중복 제거 · null 안전', () => {
    expect(describeIngredientAllergens({ allergens_available: true, allergens_from_ingredients: { names: ['밀'] } })).toEqual([])
    expect(describeIngredientAllergens({ allergens_available: false, allergens_from_ingredients: { names: [' 밀', '밀', ''] } })).toEqual(['밀'])
    expect(describeIngredientAllergens(null)).toEqual([])
    expect(describeIngredientAllergens({ allergens_from_ingredients: null })).toEqual([])
  })
})
