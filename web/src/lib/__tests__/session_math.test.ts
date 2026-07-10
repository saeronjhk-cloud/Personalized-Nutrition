import { describe, it, expect } from 'vitest'
import { friendlySessionError, firstRow, sessionBadgeText, SESSION_ERR_MSG } from '../session_math'
import { buildSessionSliderBody } from '../leftover_math'

describe('friendlySessionError', () => {
  it('1. 각 코드 매핑(메시지 프리픽스 포함해도 인식)', () => {
    expect(friendlySessionError('SESSION_NOT_OPEN')).toBe(SESSION_ERR_MSG.SESSION_NOT_OPEN)
    expect(friendlySessionError('ERROR: SESSION_NOT_FOUND at ...')).toBe(SESSION_ERR_MSG.SESSION_NOT_FOUND)
    expect(friendlySessionError('SESSION_OWNER_MISMATCH')).toBe(SESSION_ERR_MSG.SESSION_OWNER_MISMATCH)
    expect(friendlySessionError('UNAUTHENTICATED')).toBe(SESSION_ERR_MSG.UNAUTHENTICATED)
  })
  it('2. 미지 메시지 → UNKNOWN', () => {
    expect(friendlySessionError('some random pg error')).toBe(SESSION_ERR_MSG.UNKNOWN)
    expect(friendlySessionError(undefined)).toBe(SESSION_ERR_MSG.UNKNOWN)
  })
})

describe('firstRow', () => {
  it('3. 배열 → 첫 행', () => { expect(firstRow<number>([1, 2])).toBe(1) })
  it('4. 빈 배열 → null', () => { expect(firstRow([])).toBeNull() })
  it('5. 단일 객체 → 그대로', () => { expect(firstRow<{ a: number }>({ a: 1 })?.a).toBe(1) })
  it('6. null/undefined → null', () => { expect(firstRow(null)).toBeNull(); expect(firstRow(undefined)).toBeNull() })
})

describe('sessionBadgeText', () => {
  it('7. 정상 문구', () => { expect(sessionBadgeText(3, 610.4)).toBe('정찬 진행중 · 3개 접시 · 합계 610 kcal') })
  it('8. NaN 방어', () => { expect(sessionBadgeText(NaN, NaN)).toBe('정찬 진행중 · 0개 접시 · 합계 0 kcal') })
})

describe('buildSessionSliderBody', () => {
  it('9. 세션 바디 형태 + 클램프 + pre_summary 미포함', () => {
    expect(buildSessionSliderBody('s1', 0.8)).toEqual({ pre_meal_session_id: 's1', leftover_method: 'slider', session_eaten_ratio: 0.8 })
    expect(buildSessionSliderBody('s1', 1.4).session_eaten_ratio).toBe(1)
    const b = buildSessionSliderBody('s1', 0.5) as Record<string, unknown>
    expect('pre_summary' in b).toBe(false)
    expect('pre_meal_log_id' in b).toBe(false)
  })
})
