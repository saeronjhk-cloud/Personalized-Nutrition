/**
 * ★ 먹선 서버 세션72 — 제보 «자동 반영» 알레르기의 화면 표시.
 *   정본: meokseon-server `IP/결정_알레르기자동반영_2026-09-29.md`
 *   지키는 것:
 *     ① 자동 반영 이름이 있으면 배지 「제보 기반 · 포장 확인」 — 확정처럼 보이지 않게
 *     ② `allergens_may_unconfirmed === true` 면 「혼입 정보 미확인」 — 「혼입 없음」이라고 말하지 않는다
 *     ③ 신호가 없는 입력(구버전 서버·사진 제보·사람 확인 제품)은 종전과 «똑같이» 그린다
 *     ④ 미수집이면 배지·고지 둘 다 없다(출처를 말할 목록 자체가 없다) — 불완전성 고지는 그대로
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import AllergenCard from '../AllergenCard'
import { describeAllergenProvenance } from '../../domain/meokseon/allergens'

const BADGE = 'data-testid="allergen-crowd-auto-badge"'
const MAYU = 'data-testid="allergen-may-unconfirmed"'
const NOTICE = 'data-testid="allergen-incomplete-notice"'
const V2 = { contains: ['밀', '대두'], inferred: [], mayContain: ['우유'] }
type In = Parameters<typeof AllergenCard>[0]['result']
const html = (r: In) => renderToStaticMarkup(<AllergenCard result={r} />)

describe('AllergenCard — 세션72 자동 반영 표시', () => {
  it('① 자동 반영 → 배지 · 혼입 읽었으면 미확인 고지 없음', () => {
    const h = html({ allergens_available: true, allergens: ['밀', '대두'], allergens_v2: V2,
      allergens_crowd_auto: ['밀', '대두', '우유'], allergens_may_unconfirmed: false })
    expect(h).toContain(BADGE)
    expect(h).toContain('제보 기반 · 포장 확인')
    expect(h).not.toContain(MAYU)
    expect(h).toContain(NOTICE)
  })
  it('② 혼입 미확인 → 고지 · 「혼입 없음」 문구 없음', () => {
    const h = html({ allergens_available: true, allergens: ['밀'], allergens_v2: { contains: ['밀'], inferred: [], mayContain: [] },
      allergens_crowd_auto: ['밀'], allergens_may_unconfirmed: true })
    expect(h).toContain(MAYU)
    expect(h).toContain('혼입 정보 미확인')
    expect(h).not.toMatch(/혼입(\s|가능\s)?없음/)
  })
  it('③ 신호 없는 입력(구버전 서버) → 배지·고지 없음 · 불완전성 고지는 그대로', () => {
    const h = html({ allergens_available: true, allergens: ['밀'], allergens_v2: V2 })
    expect(h).not.toContain(BADGE); expect(h).not.toContain(MAYU); expect(h).toContain(NOTICE)
  })
  it('③-b 사람 확인 제품(crowd_auto []) → 배지 없음', () => {
    const h = html({ allergens_available: true, allergens: ['밀'], allergens_v2: V2, allergens_crowd_auto: [], allergens_may_unconfirmed: false })
    expect(h).not.toContain(BADGE)
  })
  it('④ 미수집 → 배지·미확인 고지 없음(서버가 null 을 주는 경우 포함)', () => {
    const h = html({ allergens_available: false, allergens: null, allergens_v2: null,
      allergens_crowd_auto: null, allergens_may_unconfirmed: null })
    expect(h).not.toContain(BADGE); expect(h).not.toContain(MAYU); expect(h).toContain(NOTICE)
  })
  it('describeAllergenProvenance — may_unconfirmed 는 === true 일 때만', () => {
    expect(describeAllergenProvenance({ allergens_available: true, allergens_may_unconfirmed: null }).mayUnconfirmed).toBe(false)
    expect(describeAllergenProvenance({ allergens_available: true, allergens_crowd_auto: [' 밀', '밀', 3 as unknown as string] }).crowdAuto).toEqual(['밀'])
    expect(describeAllergenProvenance(null)).toEqual({ crowdAuto: [], mayUnconfirmed: false })
  })
})
