/**
 * 끼니를 빠뜨린 날 보완 v1 — 화면 V1~V5 (IP/integration/weekly_missed_meal_eval_v1.md §V)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { weeklyRenderModel, type WeeklyReportData, type Completeness, type MacroFlag } from '../weeklyReport_view'

const rep = (flags: MacroFlag[], completeness?: Completeness): WeeklyReportData => ({
  top_food_groups: [], macro_balance: { avg: {}, flags },
  next_action: { source: 'rule', message: 'x', guardrail_passed: true },
  p2_teaser: { show: false }, coverage: { days_logged: 3, meals: 4 },
  ...(completeness ? { completeness } : {}),
})
const vm = (r: WeeklyReportData) => weeklyRenderModel({
  loading: false, error: null,
  data: { report_id: 'r', period: { start: '2026-09-28', end: '2026-10-04' }, report: r, cached: false, first_viewed_at: null },
})
const C = (o: Partial<Completeness> = {}): Completeness => ({ complete_days: 0, incomplete_days: 3, withheld: [], rechecked: [], ...o })
const sodium: MacroFlag = { nutrient: 'sodium', direction: 'over', severity: 'medium' }

describe('끼니 빠뜨린 날 보완 — 화면', () => {
  it('V1 flags 0 · 보류 0 → 성공 배너', () => {
    const v = vm(rep([], C()))
    expect(v.showFlagsSuccess).toBe(true); expect(v.withheldNote).toBeNull()
  })
  it('V2 flags 0 · 보류 [protein] → 배너 숨김 + 보류 안내', () => {
    const v = vm(rep([], C({ withheld: ['protein'] })))
    expect(v.showFlagsSuccess).toBe(false)
    expect(v.withheldNote).toBe('단백질 부족 여부는 판단하지 않았어요. 하루 식사를 모두 기록한 날이 없어요.')
  })
  it('V3 flags 있음 + 보류 2개', () => {
    const v = vm(rep([sodium], C({ withheld: ['calories', 'protein'] })))
    expect(v.flagCount).toBe(1)
    expect(v.withheldNote).toBe('열량·단백질 부족 여부는 판단하지 않았어요. 하루 식사를 모두 기록한 날이 없어요.')
  })
  it('V4 재확인 각주', () => {
    const v = vm(rep([], C({ complete_days: 2, incomplete_days: 2, rechecked: ['protein'] })))
    expect(v.recheckNote).toBe('기록이 적은 날 2일은 부족 판정에서 뺐어요.')
    expect(vm(rep([], C({ incomplete_days: 2, rechecked: [] }))).recheckNote).toBeNull()
  })
  it('V5 옛 엔진(completeness 없음) → v1 동작', () => {
    const v = vm(rep([]))
    expect(v.showFlagsSuccess).toBe(true); expect(v.withheldNote).toBeNull(); expect(v.recheckNote).toBeNull()
  })
  it('W 페이지 배선', () => {
    const page = readFileSync(resolve(__dirname, '../../pages/WeeklyReport.tsx'), 'utf-8')
    expect(page).toContain('vm.flagCount === 0 ? null')
    expect(page).toContain('{vm.withheldNote && <div>ⓘ {vm.withheldNote}</div>}')
    expect(page).toContain('{vm.recheckNote && <div>ⓘ {vm.recheckNote}</div>}')
  })
})
