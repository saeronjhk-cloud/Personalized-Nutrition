/**
 * ★ 세션75b — 「내 기준으로 보기」 사유 뒤 서술격 조사(이라/라). 운영 실물(10-04): «혈당 관리 목표이라» 오문.
 *   받침 있으면 «이라», 없으면 «라». 한글이 아니면 «(이)라»(지어내지 않는다).
 */
import { describe, it, expect } from 'vitest'
import { withIra } from '../koreanParticle'

describe('withIra', () => {
  it('받침 있음 → 이라', () => {
    expect(withIra('고지혈증 관리 중')).toBe('고지혈증 관리 중이라')
    expect(withIra('고혈압 관리 중')).toBe('고혈압 관리 중이라')
  })
  it('받침 없음 → 라 (운영 실물 «목표이라» 재현 방지)', () => {
    expect(withIra('혈당 관리 목표')).toBe('혈당 관리 목표라')
    expect(withIra('심혈관 목표')).toBe('심혈관 목표라')
    expect(withIra('간 건강 목표')).toBe('간 건강 목표라')
  })
  it('끝 공백은 무시하고 판단', () => {
    expect(withIra('체중 관리 목표 ')).toBe('체중 관리 목표라')
  })
  it('한글이 아니면 (이)라', () => {
    expect(withIra('BMI 25')).toBe('BMI 25(이)라')
    expect(withIra('')).toBe('')
  })
})
