/**
 * 주간 리포트 누적 v1 — 화면 배선 (평가 V1·V4·V7 렌더 확인)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import WeeklyAccumulation from '../WeeklyAccumulation'
import type { Accumulation } from '../../lib/weeklyAccumulation_view'

const n = { week_total: 14000, daily_avg: 2340, ref: 2000, days_over: 3, days_logged: 5, unknown_foods: 0 }
const acc: Accumulation = {
  sodium: n, sugar: { ...n, daily_avg: 31.6, ref: 50, days_over: 0 },
  processed: { product_items: 2, distinct_products: 1, products: [{ barcode: '880', name: '새우깡', count: 2 }],
    sodium_share_pct: 18.4, sugar_share_pct: null, share_excluded_meals: 0 },
}

describe('WeeklyAccumulation 렌더', () => {
  it('누적·가공식품 섹션', () => {
    const html = renderToStaticMarkup(<WeeklyAccumulation accumulation={acc} />)
    expect(html).toContain('이번 주 나트륨·당류')
    expect(html).toContain('일평균 2,340mg · 기준 2,000mg')
    expect(html).toContain('가공식품에서 온 몫 18%')
    expect(html).toContain('📦 새우깡')
    for (const w of ['안전', '허용', '위해', '등급 미상']) expect(html).not.toContain(w)
  })
  it('V1 옛 엔진 → 아무것도 그리지 않음 · V4 가공식품 0 → 섹션 없음', () => {
    expect(renderToStaticMarkup(<WeeklyAccumulation accumulation={undefined} />)).toBe('')
    const none = { ...acc, processed: { ...acc.processed, product_items: 0, distinct_products: 0, products: [] } }
    expect(renderToStaticMarkup(<WeeklyAccumulation accumulation={none} />)).not.toContain('이번 주 가공식품')
  })
  it('페이지 배선', () => {
    const page = readFileSync(resolve(__dirname, '../../pages/WeeklyReport.tsx'), 'utf-8')
    expect(page).toContain('<WeeklyAccumulation accumulation={report.accumulation} />')
  })
})
