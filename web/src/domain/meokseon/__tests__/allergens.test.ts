import { describe, it, expect } from 'vitest'
import { describeAllergens } from '../allergens'

/**
 * 먹선 알레르기 표시 판정.
 *
 * 이 테스트가 지키는 것은 «보여주는 것»이 아니라 **«단정하지 않는 것»** 이다.
 * 먹선 서버가 세션44~51 동안 반복해서 다친 두 결함을 화면에서 재현하지 않기 위한 것:
 *   ① 미수집 → 「알레르겐 없음」으로 읽히면 과소경고 (서버 세션46 치명1)
 *   ② 혼입 가능 → 직접 함유와 뭉치면 과잉경고 (서버 세션44, 캡처 032·060 실측)
 */

describe('★ ① 미수집을 「없음」이라고 말하지 않는다', () => {
  it('allergens_available=false 면 uncollected — 목록이 뭐가 오든 상관없다', () => {
    expect(describeAllergens({
      allergens_available: false,
      allergens: null,
      allergens_v2: null,
    })).toEqual({ kind: 'uncollected' })
  })

  it('available=false 인데 목록이 실려 와도 uncollected 다 (available 이 권위)', () => {
    expect(describeAllergens({
      allergens_available: false,
      allergens: ['밀'],
      allergens_v2: { contains: ['밀'] },
    })).toEqual({ kind: 'uncollected' })
  })

  it('결과 자체가 없으면 uncollected', () => {
    expect(describeAllergens(null)).toEqual({ kind: 'uncollected' })
    expect(describeAllergens(undefined)).toEqual({ kind: 'uncollected' })
  })

  it('★ available=true 인데 목록이 전부 비면 «없음»이 아니라 uncollected 다', () => {
    // 서버 계약상 「확인했고 알레르겐 없음」 상태는 아직 존재하지 않는다.
    // 근거 없이 안심시키느니 「모른다」가 안전하다.
    expect(describeAllergens({
      allergens_available: true,
      allergens: [],
      allergens_v2: { contains: [], inferred: [], mayContain: [] },
    })).toEqual({ kind: 'uncollected' })
  })

  it('필드가 아예 없어도(구버전 서버) uncollected', () => {
    expect(describeAllergens({})).toEqual({ kind: 'uncollected' })
  })
})

describe('★ ② 혼입 가능을 직접 함유와 뭉치지 않는다', () => {
  it('세 구획을 각각 분리해 돌려준다', () => {
    expect(describeAllergens({
      allergens_available: true,
      allergens: ['밀', '우유'],
      allergens_v2: { contains: ['밀'], inferred: ['우유'], mayContain: ['대두', '메밀'] },
    })).toEqual({
      kind: 'grouped', contains: ['밀'], inferred: ['우유'], mayContain: ['대두', '메밀'],
    })
  })

  it('★ 혼입만 있는 제품 — flat 이 비어도 카드를 내지 않는다 (혼입 경고 소실 방지)', () => {
    // 서버 계약: flat = contains + inferred 이므로 혼입만 있으면 flat 은 []
    const v = describeAllergens({
      allergens_available: true,
      allergens: [],
      allergens_v2: { contains: [], inferred: [], mayContain: ['대두'] },
    })
    expect(v.kind).toBe('grouped')
    expect(v.kind === 'grouped' && v.mayContain).toEqual(['대두'])
  })

  it('직접 함유만 있으면 나머지 구획은 빈 배열이다', () => {
    const v = describeAllergens({
      allergens_available: true,
      allergens: ['게'],
      allergens_v2: { contains: ['게'] },
    })
    expect(v).toEqual({ kind: 'grouped', contains: ['게'], inferred: [], mayContain: [] })
  })
})

describe('폴백 — 근거 구분이 없는 평탄 목록', () => {
  it('v2 가 없으면 flat 으로 내되 「직접 함유」로 단정하지 않는다', () => {
    expect(describeAllergens({
      allergens_available: true,
      allergens: ['밀', '대두'],
      allergens_v2: null,
    })).toEqual({ kind: 'flat', items: ['밀', '대두'] })
  })

  it('v2 가 빈 껍데기여도 flat 이 있으면 flat', () => {
    expect(describeAllergens({
      allergens_available: true,
      allergens: ['우유'],
      allergens_v2: { contains: [], inferred: [], mayContain: [] },
    })).toEqual({ kind: 'flat', items: ['우유'] })
  })
})

describe('입력 방어 — 서버/사용자 입력이 지저분해도 죽지 않는다', () => {
  it('배열이 아닌 값은 빈 목록으로 본다', () => {
    expect(describeAllergens({
      allergens_available: true,
      allergens: 'X' as unknown as string[],
      allergens_v2: { contains: 'Y' as unknown as string[] },
    })).toEqual({ kind: 'uncollected' })
  })

  it('빈 문자열·공백·비문자열을 걸러낸다', () => {
    const v = describeAllergens({
      allergens_available: true,
      allergens_v2: { contains: ['밀', '', '   ', null as unknown as string, 3 as unknown as string] },
    })
    expect(v).toEqual({ kind: 'grouped', contains: ['밀'], inferred: [], mayContain: [] })
  })

  it('중복을 제거하되 순서는 유지한다', () => {
    const v = describeAllergens({
      allergens_available: true,
      allergens_v2: { contains: ['밀', '대두', '밀'] },
    })
    expect(v.kind === 'grouped' && v.contains).toEqual(['밀', '대두'])
  })

  it('앞뒤 공백을 다듬는다', () => {
    const v = describeAllergens({
      allergens_available: true,
      allergens_v2: { mayContain: ['  게  '] },
    })
    expect(v.kind === 'grouped' && v.mayContain).toEqual(['게'])
  })
})
