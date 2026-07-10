import { describe, it, expect } from 'vitest'
import {
  clampRatio, isValidRatio, buildSliderBody, friendlyLeftoverError,
  parseLeftoverEnvelope, genIdemKey, LEFTOVER_ERR_MSG,
} from '../leftover_math'

describe('clampRatio', () => {
  it('1. 정상값 유지', () => { expect(clampRatio(0.75)).toBe(0.75) })
  it('2. 1 초과 → 1', () => { expect(clampRatio(1.2)).toBe(1) })
  it('3. 음수 → 0', () => { expect(clampRatio(-0.5)).toBe(0) })
  it('4. NaN/비수치 → 1(안전)', () => { expect(clampRatio(NaN)).toBe(1); expect(clampRatio(Infinity)).toBe(1) })
  it('5. 0.01 단위 반올림', () => { expect(clampRatio(0.756)).toBe(0.76) })
})

describe('isValidRatio', () => {
  it('6. 0~1 유효', () => { expect(isValidRatio(0)).toBe(true); expect(isValidRatio(1)).toBe(true); expect(isValidRatio(0.5)).toBe(true) })
  it('7. 범위 밖/비수치 무효', () => {
    expect(isValidRatio(-0.1)).toBe(false)
    expect(isValidRatio(1.1)).toBe(false)
    expect(isValidRatio(NaN)).toBe(false)
    expect(isValidRatio('x' as unknown as number)).toBe(false)
  })
})

describe('buildSliderBody', () => {
  it('8. 계약 형태(pre_summary 미포함) + 비율 클램프', () => {
    expect(buildSliderBody('m1', 0.7)).toEqual({ pre_meal_log_id: 'm1', leftover_method: 'slider', eaten_ratio: 0.7 })
    expect(buildSliderBody('m1', 1.5).eaten_ratio).toBe(1)
  })
  it('9. pre_summary/pre_result 키 없음', () => {
    const b = buildSliderBody('m1', 0.5) as Record<string, unknown>
    expect('pre_summary' in b).toBe(false)
    expect('pre_result' in b).toBe(false)
  })
})

describe('friendlyLeftoverError', () => {
  it('10. 알려진 코드 매핑', () => {
    expect(friendlyLeftoverError('SESSION_STILL_OPEN')).toBe(LEFTOVER_ERR_MSG.SESSION_STILL_OPEN)
    expect(friendlyLeftoverError('AI_ESTIMATE_FAILED')).toBe(LEFTOVER_ERR_MSG.AI_ESTIMATE_FAILED)
  })
  it('11. 미지의 코드 → UNKNOWN 문구', () => {
    expect(friendlyLeftoverError('WHATEVER')).toBe(LEFTOVER_ERR_MSG.UNKNOWN)
    expect(friendlyLeftoverError(undefined)).toBe(LEFTOVER_ERR_MSG.UNKNOWN)
  })
})

describe('parseLeftoverEnvelope', () => {
  it('12. 성공 envelope', () => {
    const p = parseLeftoverEnvelope({ ok: true, data: { adjusted_summary: { total_calories_kcal: 300 } } }, 200)
    expect(p.ok).toBe(true)
    expect(p.data.adjusted_summary.total_calories_kcal).toBe(300)
  })
  it('13. VALIDATION_ERROR 매핑', () => {
    const p = parseLeftoverEnvelope({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'x' } }, 400)
    expect(p.ok).toBe(false); expect(p.errorCode).toBe('VALIDATION_ERROR')
  })
  it('14. SESSION_STILL_OPEN(409) 매핑', () => {
    const p = parseLeftoverEnvelope({ ok: false, error: { code: 'SESSION_STILL_OPEN' } }, 409)
    expect(p.errorCode).toBe('SESSION_STILL_OPEN')
    expect(p.errorMessage).toBe(LEFTOVER_ERR_MSG.SESSION_STILL_OPEN)
  })
  it('15. 멱등 충돌(409) 매핑', () => {
    const p = parseLeftoverEnvelope({ ok: false, error: { code: 'IDEMPOTENCY_KEY_REUSE_MISMATCH' } }, 409)
    expect(p.errorCode).toBe('IDEMPOTENCY_KEY_REUSE_MISMATCH')
  })
  it('16. 미지 코드 → UNKNOWN', () => {
    const p = parseLeftoverEnvelope({ ok: false, error: { code: 'WEIRD' } }, 500)
    expect(p.errorCode).toBe('UNKNOWN')
  })
  it('17. 에러 없고 401 → VALIDATION_ERROR', () => {
    expect(parseLeftoverEnvelope({}, 401).errorCode).toBe('VALIDATION_ERROR')
  })
  it('18. 에러 없고 500 → UNKNOWN', () => {
    expect(parseLeftoverEnvelope({}, 500).errorCode).toBe('UNKNOWN')
  })
})

describe('genIdemKey', () => {
  it('19. 비어있지 않은 문자열, 매번 다름', () => {
    const a = genIdemKey(), b = genIdemKey()
    expect(typeof a).toBe('string'); expect(a.length).toBeGreaterThan(0); expect(a).not.toBe(b)
  })
})
