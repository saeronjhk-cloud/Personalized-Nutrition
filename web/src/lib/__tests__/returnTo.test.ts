/**
 * 복귀 경로 검증 — **열린 리다이렉트를 만들지 않는다.**
 *
 * 이 값은 로그인 링크의 쿼리스트링을 타고 «이메일을 거쳐» 돌아온다.
 * 검증 없이 `navigate()` 에 넘기면 우리 도메인의 로그인 링크로 사용자를
 * 외부 사이트에 떨어뜨릴 수 있다(피싱). 그래서 «같은 출처의 경로»만 통과시킨다.
 */
import { describe, it, expect } from 'vitest'
import { safeReturnPath, loginPathWithReturn, readReturnPath, RETURN_PARAM } from '../returnTo'

describe('safeReturnPath — 같은 출처 경로만 통과', () => {
  it('내부 경로는 그대로 통과한다', () => {
    expect(safeReturnPath('/scan')).toBe('/scan')
    expect(safeReturnPath('/scan?barcode=8801043032155&report=1'))
      .toBe('/scan?barcode=8801043032155&report=1')
    expect(safeReturnPath('/scan/reports')).toBe('/scan/reports')
  })

  it('앞뒤 공백은 정리한다', () => {
    expect(safeReturnPath('  /scan  ')).toBe('/scan')
  })

  it('★★ 절대 URL 은 막는다', () => {
    expect(safeReturnPath('https://evil.example/steal')).toBeNull()
    expect(safeReturnPath('http://evil.example')).toBeNull()
    expect(safeReturnPath('javascript:alert(1)')).toBeNull()
    expect(safeReturnPath('data:text/html,<script>')).toBeNull()
  })

  it('★★★ 프로토콜 상대 URL — 「경로처럼 생겼지만 외부로 나간다」', () => {
    expect(safeReturnPath('//evil.example/steal')).toBeNull()
    // 일부 브라우저가 역슬래시를 `//` 로 취급한다.
    expect(safeReturnPath('/\\evil.example')).toBeNull()
  })

  it('경로가 아닌 값·빈 값·비문자열은 null', () => {
    expect(safeReturnPath('scan')).toBeNull()
    expect(safeReturnPath('')).toBeNull()
    expect(safeReturnPath('   ')).toBeNull()
    expect(safeReturnPath(null)).toBeNull()
    expect(safeReturnPath(undefined)).toBeNull()
    expect(safeReturnPath(42)).toBeNull()
    expect(safeReturnPath({ toString: () => '/scan' })).toBeNull()
  })

  it('제어문자가 섞이면 막는다 (URL 파싱을 흔든다)', () => {
    expect(safeReturnPath('/scan\nSet-Cookie: x')).toBeNull()
    expect(safeReturnPath('/scan\u007f')).toBeNull()
    expect(safeReturnPath('/scan\t/x')).toBeNull()
  })

  it('지나치게 긴 값은 막는다 (링크 자체가 깨진다)', () => {
    expect(safeReturnPath('/' + 'a'.repeat(600))).toBeNull()
  })
})

describe('loginPathWithReturn', () => {
  it('쓸 수 있는 경로면 쿼리로 싣는다', () => {
    const url = loginPathWithReturn('/scan?barcode=123&report=1')
    expect(url.startsWith('/login?')).toBe(true)
    const got = new URLSearchParams(url.slice(url.indexOf('?') + 1)).get(RETURN_PARAM)
    expect(got).toBe('/scan?barcode=123&report=1')
  })

  it('★ 쓸 수 없는 값이면 «붙이지 않는다» — 지어내지 않는다', () => {
    expect(loginPathWithReturn('https://evil.example')).toBe('/login')
    expect(loginPathWithReturn(null)).toBe('/login')
  })
})

describe('readReturnPath', () => {
  it('search 문자열에서 읽어 «다시» 검증한다', () => {
    expect(readReturnPath('?redirect=%2Fscan%3Freport%3D1')).toBe('/scan?report=1')
  })

  it('★★ 읽는 쪽에서도 외부 URL 을 막는다 (이메일을 거쳐 온 값이다)', () => {
    expect(readReturnPath('?redirect=https%3A%2F%2Fevil.example')).toBeNull()
    expect(readReturnPath('?redirect=%2F%2Fevil.example')).toBeNull()
  })

  it('없거나 이상하면 null — 던지지 않는다(로그인 흐름을 막지 않는다)', () => {
    expect(readReturnPath('')).toBeNull()
    expect(readReturnPath('?a=1')).toBeNull()
    expect(readReturnPath(null)).toBeNull()
    expect(readReturnPath(undefined)).toBeNull()
  })
})
