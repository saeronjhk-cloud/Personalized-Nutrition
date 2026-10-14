import { describe, it, expect } from 'vitest'
import { ingredientLabel, _parsePhotoIngredients } from '../meokseon'

// 세션79 — 롯데자일리톨 제보: 화면에 「감미료, 껌베이스」만 보이던 문제(괄호 안을 안 그림)
describe('원재료 화면 문자열 (세션79)', () => {
  it('괄호 안이 있으면 「이름(괄호 안)」', () => {
    const rows = _parsePhotoIngredients([
      { name: '감미료', detail: '자일리톨', origin: null, percentage: null },
      { name: '껌베이스', detail: '감미료(효소처리스테비아)', origin: null, percentage: null },
      { name: '감미료', detail: '이소말트, D-소비톨, D-말티톨', origin: null, percentage: null },
    ])
    expect(rows.map(ingredientLabel).join(', ')).toBe('감미료(자일리톨), 껌베이스(감미료(효소처리스테비아)), 감미료(이소말트, D-소비톨, D-말티톨)')
  })
  it('괄호 안이 없으면 종전 그대로(이름 · 원산지 · 함량)', () => {
    expect(ingredientLabel({ name: '정제수', origin: null, percentage: null })).toBe('정제수')
    expect(ingredientLabel({ name: '돼지고기', origin: '국산', percentage: 85.16, detail: null })).toBe('돼지고기 국산 85.16%')
  })
  it('원산지는 괄호 안에 이미 있으므로 두 번 쓰지 않는다 · 함량은 괄호 밖에 있을 때만 덧붙인다', () => {
    expect(ingredientLabel({ name: '밀가루', origin: '미국산', percentage: null, detail: '밀:미국산' })).toBe('밀가루(밀:미국산)')
    expect(ingredientLabel({ name: '돼지고기', origin: '국산', percentage: 85.16, detail: '국산' })).toBe('돼지고기(국산) 85.16%')
    expect(ingredientLabel({ name: '커피', origin: null, percentage: 30, detail: '브라질산 30%' })).toBe('커피(브라질산 30%)')
  })
  it('서버가 detail 을 안 보내던 응답(구버전)도 그대로 그린다', () => {
    expect(_parsePhotoIngredients([{ name: '감미료', origin: null, percentage: null }]).map(ingredientLabel)).toEqual(['감미료'])
    expect(_parsePhotoIngredients([{ name: '감미료', detail: '  ' }])[0].detail).toBeNull()
  })
})
