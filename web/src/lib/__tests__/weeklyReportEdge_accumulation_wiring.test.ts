/**
 * 주간 리포트 누적 v1 — Edge 배선 G1~G6 (IP/integration/weekly_accumulation_eval_v1.md §G)
 * 대상: NutriLens supabase/functions/weekly-report/index.ts (= IP/통합앱_P1/95 live각색본, 규칙 61)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { transformSync } from 'esbuild'

const NL = resolve(__dirname, '../../../../backends/NutriLens')
const edge = readFileSync(resolve(NL, 'supabase/functions/weekly-report/index.ts'), 'utf-8')
const live = readFileSync(resolve(NL, 'IP/통합앱_P1/95_weekly-report_live각색본_index.ts'), 'utf-8')
const engine = readFileSync(resolve(NL, 'tools/report_weekly.py'), 'utf-8')

describe('weekly-report Edge 누적 배선', () => {
  it('G1 저장소 파일 = 운영 각색본(바이트 동일)', () => { expect(edge).toBe(live) })
  it('G2 can_process 호출 없음', () => { expect(edge).not.toMatch(/rpc\(\s*["']can_process/) })
  it('G3 실섭취 우선', () => {
    expect(edge).toMatch(/\.select\("eaten_at,meal_slot,foods,summary,original_summary,adjusted_summary,eaten_ratio"\)/)
    expect(edge).toContain('(r.adjusted_summary ?? r.summary)')
    expect(edge).toContain('adjusted: r.adjusted_summary != null')
  })
  it('G4 전달 필드', () => {
    expect(edge).toMatch(/FOOD_FIELDS = \[[^\]]*"barcode", "missing_nutrients"\]/)
    expect(edge).toContain('foods, summary, original_summary,')
    expect(edge).toContain('eaten_ratio: r.eaten_ratio ?? null')
  })
  it('G5 캐시 재사용 3조건 · 엔진 버전 일치', () => {
    expect(edge).toMatch(/calc_version === CALC_VERSION/)
    expect(edge).toMatch(/\.select\("updated_at"\)/)
    expect(edge).toMatch(/cachedMeals === stamps\.length/)
    const v = edge.match(/const CALC_VERSION = "([^"]+)"/)?.[1]
    expect(engine).toContain(`CALC_VERSION = "${v}"`)
  })
  it('G6 문법(esbuild)', () => {
    expect(() => transformSync(edge, { loader: 'ts' })).not.toThrow()
  })
})
