/**
 * ★ 세션72 — 제보 폼 «보내기 전» 전체 미리보기 + 버튼 줄바꿈 (제이 실물 2026-09-29)
 *   ① 읽기 직후: 고지(PREVIEW_DISCLAIMER) → 알레르기 → 원재료·첨가물·영양(buildPreviewNutrition)
 *   ② 보낸 뒤: 같은 렌더러(renderReadbackDetails) + 종전 규칙(buildReportNutrition · 저장된 경우에만)
 *   ③ 「읽는 중…」「보내는 중…」 버튼은 줄바꿈 금지
 * ⚠ Scan.tsx 는 렌더 테스트가 어려워(카메라·Supabase) Scan_allergen_wiring 과 같은 «소스 배선» 검사를 쓴다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildPreviewNutrition, PREVIEW_DISCLAIMER, PREVIEW_SANITY_NOTE,
} from '../../domain/meokseon/reportNutrition'

const HERE = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(resolve(HERE, '../Scan.tsx'), 'utf8')

describe('Scan — 세션72 미리보기 배선', () => {
  it('① 미리보기 블록에 고지 → 알레르기 → 상세(buildPreviewNutrition) 순서', () => {
    const i = src.indexOf('사진에서 읽어낸 내용')
    const block = src.slice(i, src.indexOf('{reportError &&', i))
    const a = block.indexOf('PREVIEW_DISCLAIMER'), b = block.indexOf('<AllergenCard'), c = block.indexOf('renderReadbackDetails(')
    expect(a).toBeGreaterThan(0); expect(b).toBeGreaterThan(a); expect(c).toBeGreaterThan(b)
    expect(block).toContain('buildPreviewNutrition(')
    expect(block).not.toContain('buildReportNutrition(')
  })
  it('② 보낸 뒤 화면은 같은 렌더러 + buildReportNutrition(저장된 경우에만) 유지', () => {
    const i = src.indexOf('if (confirmed && analysis)')
    const block = src.slice(i, src.indexOf('CONTRIBUTIONS_TITLE} 보기', i))
    expect(block).toContain('buildReportNutrition({')
    expect(block).toContain('renderReadbackDetails(analysis, reportNutrition, reportAdditives)')
  })
  it('②-b 원재료·첨가물·영양 블록 정의는 한 곳뿐', () => {
    expect(src.split('data-testid="report-ingredients"').length - 1).toBe(1)
    expect(src.split('data-testid="report-nutrition"').length - 1).toBe(1)
  })
  it('③ 주/취소 버튼 줄바꿈 금지 스타일이 배선됐다', () => {
    expect(src).toMatch(/REPORT_BTN_MAIN[^=]*=\s*\{[^}]*whiteSpace: 'nowrap'/)
    expect(src).toMatch(/REPORT_BTN_CANCEL[^=]*=\s*\{[^}]*width: 'auto'/)
    expect(src.split('style={REPORT_BTN_MAIN}').length - 1).toBe(2)
  })
})

describe('buildPreviewNutrition', () => {
  const nut = { calories: 155, sodium: 70, total_fat: 8 } as any
  it('기준을 알면 숫자를 낸다', () => {
    const v = buildPreviewNutrition({ nutrition: nut, basis: 'per_total', trafficLight: null })
    expect(v.show).toBe(true); expect(v.basisLabel).toBe('총 내용량당')
  })
  it('기준을 모르면 숫자·색 없음(②는 미리보기에서도 유지)', () => {
    const v = buildPreviewNutrition({ nutrition: nut, basis: 'unknown', trafficLight: null })
    expect(v.show).toBe(false); expect(v.rows).toEqual([])
  })
  it('엔진 이상치 경고가 있으면 색은 접고 사유를 말한다', () => {
    const tl = { nutrients: { sodium: { color: 'red' } }, sanity_warnings: [{ type: 'per_100g_exceeded' }] } as any
    const v = buildPreviewNutrition({ nutrition: nut, basis: 'per_total', trafficLight: tl })
    expect(v.show).toBe(true); expect(v.showLights).toBe(false); expect(v.note).toBe(PREVIEW_SANITY_NOTE)
  })
  it('고지 문구는 「완전하지 않을 수 있음」+「관리자 확인 후 확정 정보」를 말한다', () => {
    expect(PREVIEW_DISCLAIMER).toContain('완전하지 않을 수')
    expect(PREVIEW_DISCLAIMER).toContain('관리자가 확인한 뒤 확정된 정보')
  })
})
