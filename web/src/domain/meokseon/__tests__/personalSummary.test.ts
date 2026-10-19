/** ★ 세션82 F1 — «내 기준으로 보기» 요약 문구 · 목표 밖 빨강. 정답 fixtures/personal_summary_v1.json (= IP/meokseon/eval_personal_summary_v1/cases_v1.json). */
import { describe, it, expect } from 'vitest'
import fx from './fixtures/personal_summary_v1.json'
import { personalSummary, PS_WORDING } from '../personalize'

const F = fx as any
describe('personalSummary (정답 v1)', () => {
  it('문구 = 정답', () => {
    for (const k of ['head_warn', 'head_ok', 'head_unknown', 'red_outside', 'red_plain'] as const) expect((PS_WORDING as any)[k]).toBe(F.wording[k])
  })
  for (const c of F.cases) {
    it(`${c.id} ${c.why}`, () => {
      const r = personalSummary(null, c.trafficLight, c.answers)
      expect({ mode: r.mode, headline: r.headline, otherRedKeys: r.otherRedKeys, otherRedLine: r.otherRedLine, thumbs: r.thumbs }).toEqual(c.expect)
      expect(JSON.stringify(r)).not.toContain(F.wording.banned)
    })
  }
})
