// 개인화 v2 회귀 — CI 연결(`npm test` = vitest run). 색+basis+null 기반 EVAL_CASES 전수 통과 보증.
// IP 정본: 64_먹선개인화_규칙셋_v2.md / 64_먹선개인화_Eval셋_v2.jsonl. 규칙 개정 시 여기서 회귀 차단.
import { describe, it, expect } from 'vitest'
import { runEval, EVAL_CASES, personalizeProduct } from '../personalize'
import type { SurveyAnswers } from '../../../types'

describe('먹선 개인화 v2 (traffic_light 소비)', () => {
  it('EVAL_CASES 전수 통과(회귀 기준)', () => {
    const r = runEval()
    expect(r.failures).toEqual([])
    expect(r.fail).toBe(0)
    expect(r.pass).toBe(EVAL_CASES.length)
  })

  it('null/회색은 안전이 아니다 — 경고 미발화 + hasUnknown=true', () => {
    const ans = { 기저질환: ['고혈압'], 목표: [] } as unknown as SurveyAnswers
    const r = personalizeProduct(null, { nutrients: { sodium: { color: null } } }, ans)
    expect(r.warnings).toHaveLength(0)
    expect(r.hasUnknown).toBe(true)
    expect(r.judgedCount).toBe(0)
  })

  it('traffic_light 누락 시 fail-open 금지(판정 없음)', () => {
    const ans = { 기저질환: ['고혈압'], 목표: [] } as unknown as SurveyAnswers
    const r = personalizeProduct(null, null, ans)
    expect(r.applicable).toBe(true)
    expect(r.warnings).toHaveLength(0)
    expect(r.hasUnknown).toBe(true)
  })

  it('encourage(protein/fiber)·neutral(carbs/calories)는 경고 대상 아님', () => {
    const ans = { 기저질환: ['고혈압', '당뇨'], 목표: [] } as unknown as SurveyAnswers
    const r = personalizeProduct(
      { total_carbs: 90, calories: 600 },
      { nutrients: { sodium: { color: 'green' }, sugars: { color: 'green' }, protein: { color: 'red' }, fiber: { color: 'red' } } },
      ans,
    )
    expect(r.warnings).toHaveLength(0)
    // 탄수/열량은 items에 neutral로만 존재(경고 아님)
    expect(r.items.some((i) => i.key === 'total_carbs' && i.status === 'neutral')).toBe(true)
  })

  it('다중 질환 사유 보존 — 대표는 condition, matched_reasons에 전체', () => {
    const ans = { 기저질환: ['고혈압', '비만_대사증후군'], 목표: ['심혈관건강'] } as unknown as SurveyAnswers
    const r = personalizeProduct(null, { nutrients: { sodium: { color: 'red' } } }, ans)
    const sodium = r.warnings.find((w) => w.key === 'sodium')!
    expect(sodium).toBeTruthy()
    expect(sodium.matched_reasons.length).toBeGreaterThan(1)
    expect(sodium.matched_reasons).toContain('고혈압 관리 중')
  })
})
