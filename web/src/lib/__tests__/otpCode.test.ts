import { describe, it, expect } from 'vitest'
import {
  OTP_MIN_LENGTH, OTP_MAX_LENGTH, normalizeOtpCode, isCompleteOtpCode,
} from '../otpCode'

/**
 * 코드 입력 정규화 — 세션50 신설.
 *
 * ★ 이 파일이 잡은 실제 사고 (2026-08-31, 배포 «전»)
 *   초판은 `OTP_LENGTH = 6` 으로 못 박고 6자에서 잘랐다. 그런데 실제 발송 메일을
 *   열어 보니 **8자리**였다 — Supabase 의 「Email OTP Length」가 8로 설정돼 있었다.
 *   그대로 나갔으면 8자리 코드가 앞 6자로 «조용히» 잘려 100% 실패했을 것이다.
 *   사용자는 메일의 코드를 그대로 넣고 「코드가 틀렸습니다」를 봤을 것이고,
 *   화면에도 로그에도 「잘랐다」는 흔적은 없다.
 *   ⇒ 클라이언트는 그 설정을 알 수 없다. **길이를 가정하지 않고 범위로 받는다.**
 *
 * 이 함수가 존재하는 이유는 «사용자가 손으로 정확히 치지 않기» 때문이다.
 * 메일에서 통째로 복사하거나, 공백·하이픈이 섞인 채로 붙여넣는다.
 */
describe('normalizeOtpCode — 붙여넣기를 전제로 한다', () => {
  it('숫자만 남긴다', () => {
    expect(normalizeOtpCode('85630801')).toBe('85630801')
    expect(normalizeOtpCode('8563 0801')).toBe('85630801')
    expect(normalizeOtpCode('8563-0801')).toBe('85630801')
    expect(normalizeOtpCode(' 85630801 ')).toBe('85630801')
  })

  it('메일에서 통째로 복사한 문구도 통과한다', () => {
    expect(normalizeOtpCode('또는 아래 코드를 앱에 입력하세요: 85630801')).toBe('85630801')
    expect(normalizeOtpCode('Your code is 123456')).toBe('123456')
  })

  it('★ 8자리를 6자리로 «자르지 않는다» — 초판이 여기서 틀렸다', () => {
    expect(normalizeOtpCode('85630801')).toHaveLength(8)
    expect(normalizeOtpCode('85630801')).not.toBe('856308')
  })

  it('6~10자리를 모두 온전히 통과시킨다 (Supabase 설정 범위)', () => {
    for (const n of [6, 7, 8, 9, 10]) {
      const code = '1234567890'.slice(0, n)
      expect(normalizeOtpCode(code)).toBe(code)
      expect(normalizeOtpCode(code)).toHaveLength(n)
    }
  })

  it('앞자리 0 을 잃지 않는다 (number 로 다루면 사라진다)', () => {
    expect(normalizeOtpCode('000123')).toBe('000123')
    expect(normalizeOtpCode('01234567')).toBe('01234567')
  })

  it('상한(10자)을 넘으면 앞에서 자른다 — 그 위는 코드가 아니다', () => {
    expect(normalizeOtpCode('123456789012345')).toHaveLength(OTP_MAX_LENGTH)
    expect(normalizeOtpCode('123456789012345')).toBe('1234567890')
  })

  it('전각 숫자는 받지 않는다 — 서버가 거부하므로 화면에서 먼저 막는다', () => {
    expect(normalizeOtpCode('８５６３０８０１')).toBe('')
  })

  it('타입이 이상해도 던지지 않는다', () => {
    for (const bad of [null, undefined, 123456, {}, [], NaN]) {
      expect(normalizeOtpCode(bad)).toBe('')
    }
  })

  it('빈 값·숫자 없음', () => {
    expect(normalizeOtpCode('')).toBe('')
    expect(normalizeOtpCode('abcdef')).toBe('')
    expect(normalizeOtpCode('--------')).toBe('')
  })
})

describe('isCompleteOtpCode — 최소 길이로만 막는다', () => {
  it('최소 길이 이상이면 true', () => {
    expect(isCompleteOtpCode('123456')).toBe(true)
    expect(isCompleteOtpCode('85630801')).toBe(true)
    expect(isCompleteOtpCode('1234567890')).toBe(true)
    expect(isCompleteOtpCode('8563 0801')).toBe(true)
  })

  it('최소 길이 미만이면 false — 전송 자체를 하지 않는다', () => {
    expect(isCompleteOtpCode('12345')).toBe(false)
    expect(isCompleteOtpCode('1234')).toBe(false)
    expect(isCompleteOtpCode('')).toBe(false)
  })

  it('★ 정확한 길이를 «가정하지 않는다» — 설정이 6이든 8이든 통과해야 한다', () => {
    expect(OTP_MIN_LENGTH).toBe(6)
    expect(OTP_MAX_LENGTH).toBe(10)
    // 6자리 프로젝트와 8자리 프로젝트가 «둘 다» 동작해야 한다.
    expect(isCompleteOtpCode('123456')).toBe(true)
    expect(isCompleteOtpCode('12345678')).toBe(true)
  })

  it('타입이 이상해도 던지지 않는다', () => {
    for (const bad of [null, undefined, 123456, {}, []]) {
      expect(isCompleteOtpCode(bad)).toBe(false)
    }
  })
})
