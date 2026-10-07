/** ★ 세션75j — 신호등 v3 읽기 · 원재료 검출분 · 화면 배선 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readSignal, SIGNAL_LABEL, SIGNAL_SECTION_NOTE, SIGNAL_V3_NOTICE, SIBLING_INGREDIENT_NOTE, SIBLING_NUTRITION_NOTE } from '../additiveSignal'
import { buildAdditiveList, readDerived, GRADE_HIDDEN_NOTICE } from '../additives'
import { assessProduct } from '../productCompleteness'

const SIG = { color: 'orange', emoji: '🟠', color_label: '조건부 주의', rule: 'R3b', reason: 'IARC 2B군(2023)',
  badges: [{ code: 'iarc_2b', text: 'IARC 2B — 일상 섭취 위험도를 뜻하지 않음' }, { code: 'warning_label_pku', text: '페닐케톤뇨증 환자 주의' }],
  iarc_note: 'IARC 분류는 발암 근거의 강도이며 일상 섭취 위험도를 뜻하지 않아요', domestic: { listed: true, text: '국내: 식약처 허용 첨가물 · 일반 사용기준' } }

describe('readSignal', () => {
  it('서버 signal → 뷰(색·이름·이유·배지·국내 기준·IARC 문구)', () => {
    const v = readSignal(SIG)!
    expect(v.color).toBe('orange'); expect(v.emoji).toBe('🟠'); expect(v.label).toBe('조건부 주의')
    expect(v.badges).toEqual(['IARC 2B — 일상 섭취 위험도를 뜻하지 않음', '페닐케톤뇨증 환자 주의'])
    expect(v.domestic).toContain('식약처 허용'); expect(v.iarcNote).toContain('일상 섭취 위험도')
  })
  it('모르는 색·모양이면 null — 색을 지어내지 않는다', () => {
    expect(readSignal({ color: 'purple' })).toBeNull(); expect(readSignal(null)).toBeNull(); expect(readSignal('red')).toBeNull()
  })
  it('6색 이름이 모두 있다(🔵 영양강화 포함)', () => {
    expect(Object.keys(SIGNAL_LABEL).sort()).toEqual(['blue', 'gray', 'green', 'orange', 'red', 'yellow'])
  })
  it('문구: 진단 아님 · 식약처 허용 · 예전 등급은 재검토 중', () => {
    expect(SIGNAL_SECTION_NOTE).toContain('진단이나 의학적 조언이 아니에요'); expect(SIGNAL_SECTION_NOTE).toContain('식약처가 허용한')
    expect(SIGNAL_V3_NOTICE).toContain('재검토 중'); expect(SIGNAL_V3_NOTICE).not.toMatch(/위험하|해롭/)
    expect(SIBLING_INGREDIENT_NOTE).toContain('용량만 다른 같은 제품'); expect(SIBLING_NUTRITION_NOTE).toContain('100g')
  })
})

describe('buildAdditiveList — signal · derived', () => {
  it('저장 첨가물 행의 signal 을 뷰에 싣는다', () => {
    const v = buildAdditiveList({ additives: [{ additive_id: 1, name_ko: '아스파탐', signal: SIG }], risk_summary: { total: 1 } })
    expect(v.items[0].signal?.color).toBe('orange'); expect(v.derived).toBeNull()
  })
  it('signal 없는 옛 응답은 null(그리지 않음)', () => {
    const v = buildAdditiveList({ additives: [{ additive_id: 1, name_ko: '구연산' }] })
    expect(v.items[0].signal).toBeNull()
  })
  it('derived_additives → derived(가나다순 · 출처) · total 은 0 그대로', () => {
    const v = buildAdditiveList({ additives: [], risk_summary: { total: 0 },
      derived_additives: { source: 'sibling', items: [{ name: '아스파탐', match_type: 'exact', signal: SIG }, { name: '구연산', match_type: 'exact', signal: { ...SIG, color: 'green' } }] } })
    expect(v.total).toBe(0); expect(v.derived?.source).toBe('sibling')
    expect(v.derived?.items.map((x) => x.name)).toEqual(['구연산', '아스파탐'])
  })
  it('readDerived: 비거나 모양이 다르면 null', () => {
    expect(readDerived({ derived_additives: null })).toBeNull(); expect(readDerived({ derived_additives: { items: [] } })).toBeNull()
  })
})

describe('원재료 결손 판정(서버가 키를 실으면 살아난다)', () => {
  it('키 없음 = unknown · null = missing · 문자열 = present', () => {
    expect(assessProduct({ nutrition: null }).ingredients.state).toBe('unknown')
    expect(assessProduct({ nutrition: null, ingredients_text: null }).ingredients.state).toBe('missing')
    expect(assessProduct({ nutrition: null, ingredients_text: '밀가루, 설탕' }).ingredients.state).toBe('present')
  })
})

const HERE = dirname(fileURLToPath(import.meta.url))
const scan = readFileSync(resolve(HERE, '../../../pages/Scan.tsx'), 'utf8')
const list = readFileSync(resolve(HERE, '../../../components/AdditiveList.tsx'), 'utf8')
describe('배선', () => {
  it('Scan: 원재료 카드(형제 출처 문구) · 영양 형제 문구 · v3 안내(없으면 종전 안내)', () => {
    expect(scan).toContain('data-testid="ingredients-card"'); expect(scan).toContain('SIBLING_INGREDIENT_NOTE')
    expect(scan).toMatch(/nutrition\.source === 'entity_profile'[\s\S]{0,200}SIBLING_NUTRITION_NOTE/)
    expect(scan).toMatch(/\? SIGNAL_V3_NOTICE : GRADE_HIDDEN_NOTICE/)
    expect(scan).toMatch(/total === 0 && additiveView\.unlisted === 0 && !additiveView\.derived/)
  })
  it('AdditiveList: 신호 한 줄 · 원재료 검출 목록 · 각주', () => {
    expect(list).toContain('data-testid="additive-signal"'); expect(list).toContain('data-testid="derived-additives"')
    expect(list).toContain('SIGNAL_SECTION_NOTE'); expect(list).toMatch(/item\.signal && <SignalLine/)
  })
  it('GRADE_HIDDEN_NOTICE 는 그대로(주간 화면이 씀)', () => {
    expect(GRADE_HIDDEN_NOTICE).toContain('표시하지 않습니다')
  })
})

describe('★ 세션75l — 제보(사진 인식) 화면', () => {
  it('검출기 v2 행 모양({name, match_type, raw, signal})도 신호가 읽힌다', () => {
    const v = buildAdditiveList({ additives: [
      { name: '아스파탐', match_type: 'exact', raw: '아스파탐(감미료)', signal: SIG },
      { name: '향료', match_type: 'class_only', raw: '향료', signal: { ...SIG, color: 'gray', emoji: '⚪', color_label: '성분 특정 불가', rule: 'R0', badges: [] } },
    ] })
    expect(v.items.map((i) => i.signal?.color).sort()).toEqual(['gray', 'orange'])
  })
  it('Scan 제보 상세: 신호가 있으면 v3 안내(상품 화면과 같은 규칙)', () => {
    expect(scan).toMatch(/reportAdditives\.items\.some\(\(it\) => it\.signal\) \? SIGNAL_V3_NOTICE : GRADE_HIDDEN_NOTICE/)
  })
})
