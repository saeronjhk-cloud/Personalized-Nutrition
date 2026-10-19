/** ★ 세션82 — 웹 «먹선 영양 신호등» 카드. 정답 fixtures/traffic_card_v1.json (= IP/meokseon/eval_traffic_card_v1/cases_v1.json · 구현 전 고정). */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import fx from './fixtures/traffic_card_v1.json'
import { trafficCardView, TC_TITLE, TC_FOOTER, TC_MISSING_NOTE, TC_EXCLUDED, TC_WITHHELD_DEFAULT } from '../trafficCard'

const F = fx as any
const HERE = dirname(fileURLToPath(import.meta.url))
describe('trafficCardView (정답 v1)', () => {
  it('문구 = 정답', () => {
    expect(TC_TITLE).toBe(F.wording.title); expect(TC_FOOTER).toBe(F.wording.footer); expect(TC_MISSING_NOTE).toBe(F.wording.missing_note)
    expect(TC_EXCLUDED).toEqual(F.wording.excluded); expect(TC_WITHHELD_DEFAULT).toBe(F.wording.withheld_default)
  })
  it('케이스 16건', () => { expect(F.cases.length).toBe(16) })
  for (const c of F.cases) {
    it(`${c.id} ${c.why}`, () => {
      const v = trafficCardView(c.traffic_light)
      if (c.expect.mode === null) { expect(v).toBeNull(); return }
      expect(v!.mode).toBe(c.expect.mode)
      expect(v!.rows.map((r) => `${r.label}|${r.text}|${r.shape}|${r.detail}`)).toEqual(c.expect.rows)
      expect(v!.notes).toEqual(c.expect.notes)
      for (const n of v!.notes) { expect(n).not.toContain('건강한 지방'); expect(n).not.toContain('건강 유익') }
      for (const r of v!.rows) expect(r.text).not.toBe('—')
    })
  }
  it('화면 배선 — Scan 이 trafficCardView(result.traffic_light) 로 그리고 testid 를 단다', () => {
    const scan = readFileSync(resolve(HERE, '../../../pages/Scan.tsx'), 'utf8')
    expect(scan).toMatch(/trafficCardView\(result\.traffic_light/)
    expect(scan).toContain('data-testid="traffic-card"')
  })
})
