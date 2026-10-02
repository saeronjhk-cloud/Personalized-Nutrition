/** ★ 세션73 U71-3 — 라벨 인쇄 % 병기 (describeLabelDv) */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describeLabelDv, basisPhrase } from '../labelDv'

// 운영 호두정과(306264) 서버 응답 형태
const HODU = { basis: 'per_total', items: {
  total_fat: { label_pct: 83, our_pct: 80, agree: false }, saturated_fat: { label_pct: 29, our_pct: 29, agree: true },
  sodium: { label_pct: 3, our_pct: 3, agree: true }, total_carbs: { label_pct: 7, our_pct: 7, agree: true },
  protein: { label_pct: 20, our_pct: 20, agree: true } } }

describe('describeLabelDv', () => {
  it('호두정과 — 기준(총 내용량 80g) · 순서 · 지방만 불일치', () => {
    const v = describeLabelDv(HODU, { total_content: 80, content_unit: 'g' })!
    expect(v.caption).toBe('라벨에 인쇄된 1일 영양성분 기준치 비율 · 총 내용량 80g 기준')
    expect(v.rows.map((r) => r.key)).toEqual(['sodium', 'total_carbs', 'total_fat', 'saturated_fat', 'protein'])
    expect(v.rows.find((r) => r.key === 'total_fat')).toEqual({ key: 'total_fat', label: '지방', labelPct: 83, ourPct: 80, differs: true })
    expect(v.differCount).toBe(1)
  })
  it('agree=null(계산 불가)은 «다르다»로 말하지 않는다', () => {
    const v = describeLabelDv({ basis: null, items: { sodium: { label_pct: 3, our_pct: null, agree: null } } })!
    expect(v.rows[0].differs).toBe(false); expect(v.differCount).toBe(0)
    expect(v.caption).toContain('라벨 표기 기준')
  })
  it('없음·빈 items·잘못된 값 → null', () => {
    expect(describeLabelDv(null)).toBeNull()
    expect(describeLabelDv({ basis: 'per_100g', items: {} })).toBeNull()
    expect(describeLabelDv({ items: { sodium: { label_pct: 'x' } } })).toBeNull()
  })
  it('basisPhrase — 내용량 모르면 숫자를 지어내지 않는다', () => {
    expect(basisPhrase('per_total', null)).toBe('총 내용량 기준')
    expect(basisPhrase('per_100ml')).toBe('100ml 기준')
  })
  it('배선 — Scan 이 영양 카드 안에서 describeLabelDv 를 쓴다(표에 섞지 않음)', () => {
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../pages/Scan.tsx'), 'utf8')
    expect(src).toMatch(/describeLabelDv\(result\.nutrition\?\.label_dv, result\.product\)/)
    expect(src).toMatch(/data-testid="label-dv"/)
  })
})
