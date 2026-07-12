import { describe, it, expect } from 'vitest'
import {
  buildPanels, scanPanel, mealPanel, reportPanel, mealHealth,
  type ScanMetrics,
} from '../scanMetrics_view'

const M: ScanMetrics = {
  generated_at: '2026-07-12T00:00:00Z',
  window_days: 30,
  k_min: 5,
  by_event: { scan_page_view: 10, meal_saved: 2, weekly_report_view: 4 },
  by_surface: { scan: 16, meal: 19, report: 4 },
  visits: 10,
  lookup_success: 8,
  lookup_not_found: 1,
  survey_cta_clicks: 2,
  top_categories: [{ name: '면류', n: 6 }],
  meal: {
    visits: 4, consent_shown: 4, consent_accepted: 3, capture_start: 3,
    analyze_success: 2, analyze_error: 1, saved: 2,
    session_start: 1, session_close: 1, leftover_open: 1, leftover_apply: 1,
  },
  report: { weekly_views: 4 },
}

describe('scanMetrics_view — buildPanels/전환율', () => {
  it('1. metrics 없음 → 빈 패널 배열', () => {
    expect(buildPanels(null)).toEqual([])
    expect(buildPanels(undefined)).toEqual([])
  })
  it('2. buildPanels = scan/meal/report 3패널 순서', () => {
    const p = buildPanels(M)
    expect(p.map(x => x.surface)).toEqual(['scan', 'meal', 'report'])
  })

  it('3. scanPanel: total=by_surface.scan, 첫 스텝 100%, 전환율', () => {
    const p = scanPanel(M)
    expect(p.total).toBe(16); expect(p.empty).toBe(false)
    expect(p.steps[0]).toEqual({ label: '방문(페이지뷰)', n: 10, pct: 100 })
    expect(p.steps[1]).toEqual({ label: '조회 성공', n: 8, pct: 80 })   // 8/10
    expect(p.steps[3]).toEqual({ label: '설문 CTA 클릭', n: 2, pct: 20 })
  })

  it('4. mealPanel: 방문 기준 전환율(반올림)', () => {
    const p = mealPanel(M)
    expect(p.total).toBe(19)
    expect(p.steps[0]).toEqual({ label: '방문', n: 4, pct: 100 })
    expect(p.steps[1]).toEqual({ label: '동의 수락', n: 3, pct: 75 })      // 3/4
    expect(p.steps[3]).toEqual({ label: '분석 성공', n: 2, pct: 50 })      // 2/4
    expect(p.steps[4]).toEqual({ label: '저장', n: 2, pct: 50 })
  })

  it('5. reportPanel: 단일 스텝', () => {
    const p = reportPanel(M)
    expect(p.total).toBe(4); expect(p.steps).toHaveLength(1)
    expect(p.steps[0]).toEqual({ label: '주간 리포트 열람', n: 4, pct: 100 })
  })

  it('6. 빈 surface(이벤트 0) → empty=true, 첫 스텝 pct=null', () => {
    const empty: ScanMetrics = {
      ...M, by_surface: { scan: 0, meal: 0, report: 0 }, visits: 0,
      lookup_success: 0, lookup_not_found: 0, survey_cta_clicks: 0,
      meal: { ...M.meal, visits: 0, consent_accepted: 0, capture_start: 0, analyze_success: 0, analyze_error: 0, saved: 0 },
      report: { weekly_views: 0 },
    }
    const [scan, meal, report] = buildPanels(empty)
    expect(scan.empty).toBe(true); expect(scan.steps[0].pct).toBe(null)
    expect(meal.empty).toBe(true);  expect(meal.steps[1].pct).toBe(null)
    expect(report.empty).toBe(true)
  })

  it('7. 누락 키 안전(부분 metrics) → 0 처리, 크래시 없음', () => {
    const partial = { by_surface: {}, meal: undefined } as unknown as ScanMetrics
    const p = buildPanels(partial)
    expect(p[0].total).toBe(0); expect(p[0].steps[0].n).toBe(0)
    expect(p[1].total).toBe(0); expect(p[1].steps[0].n).toBe(0)
  })

  it('8. mealHealth: 분석 성공률·저장 전환', () => {
    const h = mealHealth(M)
    expect(h.analyzeSuccessRate).toBe(67)  // 2/(2+1)=66.7→67
    expect(h.saveConversion).toBe(50)      // 2/4
  })
  it('9. mealHealth: 시도 0 → null(0나눗셈 방지)', () => {
    const zero = { ...M, meal: { ...M.meal, analyze_success: 0, analyze_error: 0, visits: 0, saved: 0 } }
    const h = mealHealth(zero)
    expect(h.analyzeSuccessRate).toBe(null); expect(h.saveConversion).toBe(null)
  })
})
