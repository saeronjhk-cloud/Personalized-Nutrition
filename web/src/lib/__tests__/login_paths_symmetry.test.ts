import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * ★★★ 2026-08-30 세션50 — 로그인 «경로 두 개»가 갈라지지 않게 고정한다.
 *
 * 실제로 일어난 일:
 *   설치된 안드로이드 앱은 `/auth/callback` 에 **한 번도 도달한 적이 없었다.**
 *   Capacitor 앱의 origin 이 `https://localhost` 라 `emailRedirectTo` 가 Supabase
 *   허용목록에 안 걸렸고, 안 걸리면 Site URL 로 «대체»된다. 발송된 메일 실측:
 *     2026-08-28  redirect_to=http://localhost:3000
 *     2026-08-30  redirect_to=https://www.nutriformula.co.kr
 *   둘 다 그때의 Site URL 그대로 — 경로(`/auth/callback`)도 쿼리도 통째로 사라졌다.
 *
 *   그 결과 «AuthCallback 안에만» 있던 로그인 직후 작업이 앱에서 전부 안 돌았다:
 *     · anon_sessions 연결 (로그인 직후가 «유일한» 시점)
 *     · 비로그인 스캔 승격 (IP/146)
 *   화면에는 아무 표시도 없었다. 조용히 안 됐다.
 *
 * ⇒ 코드 로그인을 붙이면서 같은 사고가 반복될 자리를 없앤다:
 *   **두 경로가 «같은 함수»(runPostLogin)를 부른다.** 아래 검사는 그것을 고정한다.
 *
 * 소스 문자열 검사인 이유: 이 파일들은 supabase 클라이언트를 모듈 로드 시점에 만들어
 * 단위 테스트에서 그대로 import 하기 어렵다(meal_consent_gate.test.ts 와 같은 사정).
 * 동작은 tsc + 실기기로 보고, 여기서는 «되돌려지면 잡히게» 하는 것이 목적이다.
 */

const SRC = resolve(__dirname, '../..')
const read = (p: string) => readFileSync(resolve(SRC, p), 'utf-8')

/** 주석을 걷어낸 «실제 코드»만 남긴다. 이 파일들의 주석에는 옛 코드가 인용돼 있다. */
function codeOf(src: string): string {
  return src
    .split('\n')
    .filter((l) => {
      const t = l.trim()
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
    })
    .join('\n')
}

/**
 * ⚠ import 줄을 걷어낸다. 초판은 이걸 안 해서 «약한 테스트»가 됐다 —
 *   호출부에서 `runPostLogin` 을 통째로 지워도 import 줄에 이름이 남아 있어
 *   `toContain('runPostLogin')` 이 그대로 통과했다. 세션50 반증 확인에서 잡혔다.
 *   ★ 「이름이 파일에 있는가」가 아니라 「실제로 부르는가」를 봐야 한다.
 */
function withoutImports(src: string): string {
  return src
    .split('\n')
    .filter((l) => !/^\s*import\s/.test(l))
    .join('\n')
}

const LOGIN = withoutImports(codeOf(read('components/auth/LoginEmail.tsx')))
const CALLBACK = withoutImports(codeOf(read('pages/AuthCallback.tsx')))
const POST = withoutImports(codeOf(read('lib/postLogin.ts')))

describe('두 로그인 경로가 같은 «로그인 직후» 작업을 한다', () => {
  it('매직링크 경로(AuthCallback)가 runPostLogin 을 «부른다»', () => {
    expect(CALLBACK).toMatch(/await\s+runPostLogin\s*\(/)
  })

  it('코드 경로(LoginEmail)가 runPostLogin 을 «부른다»', () => {
    expect(LOGIN).toMatch(/await\s+runPostLogin\s*\(/)
  })

  it('두 경로가 서로 다른 진입 태그를 남긴다 — 어느 쪽이 도는지 사후에 알 수 있게', () => {
    expect(CALLBACK).toContain('"auth_callback"')
    expect(LOGIN).toContain('"otp_code"')
  })

  it('AuthCallback 이 세션 연결·스캔 승격을 «자기 안에서» 다시 구현하지 않는다', () => {
    // 여기에 다시 생기면 두 경로가 갈라진다. postLogin 만 이 두 가지를 안다.
    expect(CALLBACK).not.toContain('anon_sessions')
    expect(CALLBACK).not.toContain('promoteLocalScans')
  })

  it('LoginEmail 도 마찬가지로 다시 구현하지 않는다', () => {
    expect(LOGIN).not.toContain('anon_sessions')
    expect(LOGIN).not.toContain('promoteLocalScans')
  })

  it('postLogin 이 그 두 가지를 «실제로» 한다 — 껍데기만 남지 않게', () => {
    expect(POST).toContain('anon_sessions')
    expect(POST).toContain('linked_user_id')
    expect(POST).toContain('promoteLocalScans')
  })
})

describe('코드 경로가 리다이렉트에 의존하지 않는다 — 이게 앱을 살리는 지점', () => {
  it('verifyOtp 를 type:"email" 로 부른다', () => {
    expect(LOGIN).toContain('verifyOtp')
    expect(LOGIN).toMatch(/type:\s*["']email["']/)
  })

  it('코드 검증 경로에 emailRedirectTo 가 «끼어들지» 않는다', () => {
    const verify = LOGIN.slice(LOGIN.indexOf('handleVerify'))
    expect(verify).not.toContain('emailRedirectTo')
    expect(verify).not.toContain('window.location.origin')
  })

  it('입력값을 normalizeOtpCode 로 정규화한 뒤 보낸다 (공백·하이픈 붙여넣기)', () => {
    expect(LOGIN).toMatch(/normalizeOtpCode\s*\(/)
    expect(LOGIN).toMatch(/isCompleteOtpCode\s*\(/)
  })
})

describe('매직링크는 그대로 둔다 — 웹 경험을 바꾸지 않는다', () => {
  it('발송 경로는 여전히 emailRedirectTo 를 싣는다', () => {
    expect(LOGIN).toContain('emailRedirectTo')
    expect(LOGIN).toContain('signInWithOtp')
  })

  it('복귀 경로 검증은 계속 returnTo.ts 가 한다 (열린 리다이렉트 방지)', () => {
    expect(LOGIN).toContain('readReturnPath')
    expect(CALLBACK).toContain('readReturnPath')
  })

  it('LoginEmail 이 복귀 경로를 «검증 없이» navigate 하지 않는다', () => {
    // readReturnPath 를 거치지 않은 값이 navigate 로 가면 열린 리다이렉트가 된다.
    const navCalls = LOGIN.match(/navigate\([^)]*\)/g) ?? []
    expect(navCalls.length).toBeGreaterThan(0)
    for (const c of navCalls) {
      expect(c).toContain('returnPath')
    }
  })
})

describe('실패를 삼키지 않는다 (규칙60)', () => {
  it('postLogin 은 결과를 «반환»한다 — 호출자가 화면에 알릴 수 있게', () => {
    expect(POST).toContain('linked')
    // 대입(`result.linked = 'failed'`)이든 리터럴(`linked: 'failed'`)이든 잡는다 —
    // 표현 방식이 아니라 «실패를 표현할 수 있는가»가 지킬 것이다.
    expect(POST).toMatch(/linked\s*[:=]\s*['"]failed['"]/)
  })

  it('두 경로 모두 연결 실패를 사용자에게 보여준다', () => {
    expect(CALLBACK).toMatch(/linked\s*===\s*["']failed["']/)
    expect(LOGIN).toMatch(/linked\s*===\s*["']failed["']/)
  })

  it('postLogin 은 던지지 않는다 — 부가 작업 실패가 로그인을 막으면 안 된다', () => {
    expect(POST).toContain('try {')
    expect(POST).toContain('catch')
  })
})

describe('세션 id 해석이 코드 경로에서도 동작한다', () => {
  it('readPendingSessionId 가 URL 없이도 로컬을 본다', () => {
    expect(POST).toContain('last_session_id')
    // 코드 경로에는 URL 쿼리가 없다. 인자 없이 불러도 동작해야 한다.
    expect(POST).toMatch(/readPendingSessionId\s*\(\s*search\?\s*:/)
  })

  it('두 경로 모두 readPendingSessionId 를 «부른다» (각자 파싱하지 않는다)', () => {
    expect(CALLBACK).toMatch(/readPendingSessionId\s*\(/)
    expect(LOGIN).toMatch(/readPendingSessionId\s*\(/)
    expect(CALLBACK).not.toContain('getItem("last_session_id")')
    expect(LOGIN).not.toContain('getItem("last_session_id")')
  })
})
