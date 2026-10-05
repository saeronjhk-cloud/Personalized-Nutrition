/**
 * 주간 리포트 누적 v1 — 화면 순수 로직 V1~V7 (IP/integration/weekly_accumulation_eval_v1.md §V)
 */
import { describe, it, expect } from 'vitest'
import { accumulationView, aggregateWeeklyAdditives, WEEKLY_GRADE_NOTICE, type Accumulation } from '../weeklyAccumulation_view'

const nut = (o: Partial<Accumulation['sodium']> = {}) => ({
  week_total: 14000, daily_avg: 2340, ref: 2000, days_over: 3, days_logged: 5, unknown_foods: 0, ...o,
})
const acc = (o: Partial<Accumulation> = {}): Accumulation => ({
  sodium: nut(), sugar: nut({ daily_avg: 31.6, ref: 50, days_over: 0 }),
  processed: { product_items: 2, distinct_products: 1, products: [{ barcode: '880', name: '새우깡', count: 2 }],
    sodium_share_pct: 18.4, sugar_share_pct: 40, share_excluded_meals: 0 },
  ...o,
})
const add = (names: string[], unlisted = 0) => ({
  additives: names.map((n, i) => ({ additive_id: i + 1, name_ko: n, mfras_grade: 'red' })),
  risk_summary: { total: names.length, unlisted },
})

describe('주간 누적 화면', () => {
  it('V1 옛 엔진(accumulation 없음) → 숨김', () => {
    expect(accumulationView({})).toBeNull()
    expect(accumulationView({ accumulation: null })).toBeNull()
  })
  it('V1b 기본 문구', () => {
    const v = accumulationView({ accumulation: acc() })!
    expect(v.rows.map((r) => r.label)).toEqual(['나트륨', '당류'])
    expect(v.rows[0].avgText).toBe('일평균 2,340mg · 기준 2,000mg')
    expect(v.rows[0].overText).toBe('기준을 넘은 날 3일 (기록 5일 중)')
    expect(v.rows[0].shareText).toBe('가공식품에서 온 몫 18%')
    expect(v.rows[1].avgText).toBe('일평균 32g · 기준 50g')
  })
  it('V2 share null → 몫 줄 없음', () => {
    const a = acc(); a.processed.sodium_share_pct = null
    expect(accumulationView({ accumulation: a })!.rows[0].shareText).toBeNull()
  })
  it('V3 값 모르는 음식 각주', () => {
    const v = accumulationView({ accumulation: acc({ sugar: nut({ unknown_foods: 3 }) }) })!
    expect(v.rows[1].unknownNote).toBe('영양 정보가 없는 음식 3개는 합계에서 빠졌어요. 실제로는 이보다 많을 수 있어요.')
    expect(v.rows[0].unknownNote).toBeNull()
  })
  it('V4 가공식품 0 → 섹션 숨김 · 제외 끼니 각주', () => {
    const a = acc(); a.processed = { ...a.processed, product_items: 0, distinct_products: 0, products: [] }
    expect(accumulationView({ accumulation: a })!.products.show).toBe(false)
    const b = acc(); b.processed.share_excluded_meals = 2
    expect(accumulationView({ accumulation: b })!.excludedNote).toContain('끼니 2개')
    const c = acc(); c.processed.distinct_products = 12
    expect(accumulationView({ accumulation: c })!.products.moreText).toBe('외 11개 제품')
  })
  it('V5 첨가물 이름 모으기(가나다·제품 수)', () => {
    const v = aggregateWeeklyAdditives([
      { barcode: '1', summary: add(['구연산', '아스파탐']) },
      { barcode: '2', summary: add(['아스파탐', '카라멜색소']) },
    ])
    expect(v.names).toEqual([
      { name: '구연산', productCount: 1 }, { name: '아스파탐', productCount: 2 }, { name: '카라멜색소', productCount: 1 },
    ])
    expect(v.failedNote).toBeNull(); expect(v.unlistedNote).toBeNull()
  })
  it('V6 조회 실패·목록에 못 오른 첨가물', () => {
    const v = aggregateWeeklyAdditives([{ barcode: '1', summary: null }, { barcode: '2', summary: add(['구연산'], 4) }])
    expect(v.failedNote).toBe('1개 제품은 첨가물 정보를 불러오지 못했어요.')
    expect(v.unlistedNote).toContain('4개 더')
  })
  it('V7 등급 단어가 결과에 새지 않음', () => {
    const v = aggregateWeeklyAdditives([{ barcode: '1', summary: add(['구연산']) }])
    const text = JSON.stringify(v)
    for (const w of ['안전', '허용', '주의', '위해', '등급 미상', 'red']) expect(text).not.toContain(w)
  })
  it('V8 등급 안내는 첫 문장만(용도 언급 없음)', () => {
    expect(WEEKLY_GRADE_NOTICE).toBe('첨가물 위험 등급은 현재 평가 체계를 재검토하고 있어 표시하지 않습니다.')
  })
})
