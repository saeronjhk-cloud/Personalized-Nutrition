/**
 * 알레르기 카드 — **불완전성 고지가 «모든» 상태에서 나오는지** 단정한다.
 *
 * ★ 이 테스트가 지키는 것은 「고지가 있다」가 아니라 **「가장 위험한 상태에서 고지가 사라지지 않는다」** 이다.
 *
 *   고지를 `uncollected` 안에만 넣으면, **알레르겐이 실제로 표시된 제품에서는 고지가 사라진다.**
 *   그런데 우리 판별기의 실측 결함(메밀·땅콩 소실, 고등어·잣 미검출)은 정확히
 *   **목록이 «비어 있지 않은데 불완전한»** 경우에 나타난다.
 *   즉 고지가 가장 필요한 상태에서 침묵하게 된다. 이 테스트는 그 배치 실수를 잡는다.
 *
 * ★ 픽스처 다양성부터 단정한다 (외부검증 회신 쟁점6 권고).
 *   세 `kind` 가 모두 실제로 만들어졌는지 먼저 확인하고, 그다음 고지를 본다.
 *   한 kind 만 만들어진 픽스처로 「전부 통과」라고 말하는 것이 세션50 의 빈 단정이었다.
 *
 * ⚠ jsdom·RTL 을 새로 넣지 않는다. `react-dom/server` 는 이미 의존성에 있고
 *   렌더 결과 문자열을 그대로 볼 수 있다. 새 네이티브 모듈을 들이지 않는 쪽을 택했다.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import AllergenCard from '../AllergenCard'
import { describeAllergens } from '../../domain/meokseon/allergens'
import type { MsProductResult } from '../../lib/meokseon'

const NOTICE_MARK = 'data-testid="allergen-incomplete-notice"'

type P = Parameters<typeof describeAllergens>[0]

const FIXTURES: { name: string; input: P }[] = [
  { name: '미수집 — available=false', input: { allergens_available: false, allergens: null, allergens_v2: null } as P },
  { name: '미수집 — null 결과', input: null },
  {
    name: '미수집 — available=true 인데 목록이 빔 (「없음」이라 말할 근거 없음)',
    input: { allergens_available: true, allergens: [], allergens_v2: { contains: [], inferred: [], mayContain: [] } } as P,
  },
  {
    name: 'grouped — 직접 함유만',
    input: { allergens_available: true, allergens: ['밀'], allergens_v2: { contains: ['밀'], inferred: [], mayContain: [] } } as P,
  },
  {
    name: 'grouped — 세 구획 전부',
    input: {
      allergens_available: true,
      allergens: ['밀', '대두'],
      allergens_v2: { contains: ['밀'], inferred: ['대두'], mayContain: ['땅콩'] },
    } as P,
  },
  {
    name: 'grouped — 혼입 가능만',
    input: { allergens_available: true, allergens: [], allergens_v2: { contains: [], inferred: [], mayContain: ['메밀'] } } as P,
  },
  {
    name: 'flat — 근거 구분 없는 목록',
    input: { allergens_available: true, allergens: ['우유', '대두'], allergens_v2: null } as P,
  },
]

describe('AllergenCard 불완전성 고지', () => {
  it('★ 픽스처가 세 kind 를 모두 만든다 (한쪽만 보고 통과하지 않도록)', () => {
    const kinds = new Set(FIXTURES.map((f) => describeAllergens(f.input).kind))
    expect(kinds.has('uncollected')).toBe(true)
    expect(kinds.has('grouped')).toBe(true)
    expect(kinds.has('flat')).toBe(true)
  })

  for (const f of FIXTURES) {
    it(`고지가 나온다 — ${f.name}`, () => {
      const html = renderToStaticMarkup(<AllergenCard result={f.input as MsProductResult | null} />)
      expect(html).toContain(NOTICE_MARK)
      expect(html).toContain('아직 검증 중인 기능')
      expect(html).toContain('반드시 포장의 알레르기 표기를 직접 확인')
    })
  }

  it('★ 알레르겐이 «표시된» 상태에서도 고지가 남는다 (가장 위험한 경우)', () => {
    const shown = FIXTURES.filter((f) => describeAllergens(f.input).kind !== 'uncollected')
    // 픽스처 자체가 이 경우를 담고 있는지 먼저 단정한다 — 0건이면 아래 루프가 빈 단정이 된다.
    expect(shown.length).toBeGreaterThan(0)
    for (const f of shown) {
      const html = renderToStaticMarkup(<AllergenCard result={f.input as MsProductResult | null} />)
      expect(html, f.name).toContain(NOTICE_MARK)
    }
  })

  it('고지가 「미수집」 문구를 대체하지 않는다 — 둘은 서로 다른 사실이다', () => {
    const html = renderToStaticMarkup(
      <AllergenCard result={{ allergens_available: false, allergens: null, allergens_v2: null } as unknown as MsProductResult} />,
    )
    expect(html).toContain('알레르겐이 없다는 뜻은 아니에요')
    expect(html).toContain(NOTICE_MARK)
  })
})
