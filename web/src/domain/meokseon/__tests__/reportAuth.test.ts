/**
 * 제보 로그인 게이트 — 판정·문구.
 *
 * 이 파일이 지키는 것:
 *   ① 401 을 침묵으로 만들지 않는다 — 모르는 코드가 와도 「로그인하라」고 말한다.
 *   ② 문구가 «다음 행동»을 담는다. 「권한이 없습니다」로 끝내지 않는다.
 *   ③ 「아직 모름」을 「된다」로 승격시키지 않는다 — 그 승격이 곧 사진 두 번 찍기다.
 */
import { describe, it, expect } from 'vitest'
import {
  classifyAuthFailure, canOpenReportForm,
  AUTH_REQUIRED_MESSAGE, AUTH_INVALID_MESSAGE,
  REPORT_LOGIN_HEADLINE, REPORT_LOGIN_WHY, REPORT_LOGIN_SCAN_OK, REPORT_LOGIN_CTA,
  REPORT_LOGIN_DISMISS, REPORT_LOGIN_RETURN_NOTICE,
  AUTH_PHOTO_LOST_NOTICE, AUTH_RELOGIN_CTA,
  CONTRIBUTIONS_LOGIN_REQUIRED, CONTRIBUTIONS_LOGIN_CTA,
} from '../reportAuth'

describe('classifyAuthFailure — 401 계약', () => {
  it('AUTH_REQUIRED 를 그대로 읽는다', () => {
    const f = classifyAuthFailure('AUTH_REQUIRED', '로그인이 필요합니다')
    expect(f.code).toBe('AUTH_REQUIRED')
    expect(f.message).toBe(AUTH_REQUIRED_MESSAGE)
  })

  it('AUTH_INVALID 를 그대로 읽는다 — 만료는 문구가 다르다', () => {
    const f = classifyAuthFailure('AUTH_INVALID', '토큰이 유효하지 않습니다')
    expect(f.code).toBe('AUTH_INVALID')
    expect(f.message).toBe(AUTH_INVALID_MESSAGE)
    expect(f.message).not.toBe(AUTH_REQUIRED_MESSAGE)
  })

  it('대소문자·공백을 가리지 않는다', () => {
    expect(classifyAuthFailure(' auth_invalid ').code).toBe('AUTH_INVALID')
  })

  it('★★ 모르는 코드·없는 코드는 AUTH_REQUIRED 로 읽는다 — 침묵하지 않는다', () => {
    for (const raw of [null, undefined, '', '   ', 'SOMETHING_NEW', 42, {}]) {
      const f = classifyAuthFailure(raw)
      expect(f.code).toBe('AUTH_REQUIRED')
      expect(f.message.length).toBeGreaterThan(0)
    }
  })

  it('★ 서버 문구는 «보존»하되 화면 문구로 쓰지 않는다', () => {
    const f = classifyAuthFailure('AUTH_INVALID', '  Unauthorized  ')
    expect(f.serverMessage).toBe('Unauthorized')
    expect(f.message).toBe(AUTH_INVALID_MESSAGE)
  })

  it('서버가 말이 없으면 serverMessage 는 null — 「말이 없었다」를 지어내지 않는다', () => {
    expect(classifyAuthFailure('AUTH_REQUIRED').serverMessage).toBeNull()
    expect(classifyAuthFailure('AUTH_REQUIRED', '   ').serverMessage).toBeNull()
    expect(classifyAuthFailure('AUTH_REQUIRED', 42).serverMessage).toBeNull()
  })
})

describe('canOpenReportForm — 사진을 고르기 «전»에 막는다', () => {
  it('로그인돼 있을 때만 연다', () => {
    expect(canOpenReportForm(true)).toBe(true)
  })
  it('비로그인이면 열지 않는다', () => {
    expect(canOpenReportForm(false)).toBe(false)
  })
  it('★★ 「아직 모름」(null)을 「된다」로 승격시키지 않는다', () => {
    expect(canOpenReportForm(null)).toBe(false)
  })
})

describe('문구 — 안전 계약', () => {
  it('전부 비어 있지 않다', () => {
    const all = [
      REPORT_LOGIN_HEADLINE, REPORT_LOGIN_WHY, REPORT_LOGIN_SCAN_OK, REPORT_LOGIN_CTA,
      REPORT_LOGIN_DISMISS, REPORT_LOGIN_RETURN_NOTICE,
      AUTH_REQUIRED_MESSAGE, AUTH_INVALID_MESSAGE, AUTH_PHOTO_LOST_NOTICE, AUTH_RELOGIN_CTA,
      CONTRIBUTIONS_LOGIN_REQUIRED, CONTRIBUTIONS_LOGIN_CTA,
    ]
    for (const s of all) expect(s.trim().length).toBeGreaterThan(0)
  })

  it('★★★ 「스캔은 로그인 없이 된다」를 말한다 — 이 줄이 없으면 사용자는 스캔도 막힌 줄 안다', () => {
    expect(REPORT_LOGIN_SCAN_OK).toMatch(/로그인 없이/)
    expect(REPORT_LOGIN_SCAN_OK).toMatch(/스캔|조회/)
  })

  it('★★ 왜 로그인이 필요한지 «이유»를 말한다 (제보 결과를 알려주려면)', () => {
    expect(REPORT_LOGIN_WHY).toMatch(/제보/)
    expect(REPORT_LOGIN_WHY).toMatch(/결과|알려/)
  })

  it('★★★ 사진이 사라진다는 사실을 «미리» 말한다 — 매직링크는 페이지를 새로 연다', () => {
    expect(AUTH_PHOTO_LOST_NOTICE).toMatch(/사진/)
    expect(AUTH_PHOTO_LOST_NOTICE).toMatch(/지워|다시/)
    // ⚠ 「유지됩니다」는 사실이 아니다. 그렇게 바뀌면 이 단정이 잡는다.
    expect(AUTH_PHOTO_LOST_NOTICE).not.toMatch(/유지/)
  })

  it('★ 401 문구가 «다음 행동»을 담는다', () => {
    expect(AUTH_REQUIRED_MESSAGE).toMatch(/로그인/)
    expect(AUTH_INVALID_MESSAGE).toMatch(/로그인/)
  })
})
