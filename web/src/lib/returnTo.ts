/**
 * 「로그인하고 원래 하던 일로 돌아오기」 — 복귀 경로 검증. **순수 함수**(테스트 대상).
 *
 * ★★ 왜 생겼나 (2026-08-24, 세션64c)
 *   제보에 로그인 게이트가 붙으면서, 로그인 뒤에 사용자를 «원래 있던 화면»으로 돌려보내야 한다.
 *   그런데 이 앱의 로그인은 **이메일 매직링크**다(`components/auth/LoginEmail.tsx`).
 *   즉 사용자는 앱을 «떠났다가» 새 페이지 로드로 돌아온다 — React 상태는 전부 사라진다.
 *   ⇒ 복귀 지점을 «URL 로» 넘기는 수밖에 없다.
 *
 * ★★★ 이 파일이 지키는 것 — 딱 하나: **열린 리다이렉트를 만들지 않는다.**
 *   복귀 경로는 로그인 링크의 쿼리스트링을 타고 «이메일을 거쳐» 돌아온다.
 *   그 값을 검증 없이 `navigate()` 에 넘기면, 누구든 우리 도메인의 로그인 링크로
 *   사용자를 외부 사이트에 떨어뜨릴 수 있다(피싱).
 *   ⇒ **같은 출처의 «경로»만** 통과시킨다. 스킴·호스트가 들어올 자리를 아예 남기지 않는다.
 *
 * ⚠ `//evil.com` 은 «경로처럼 생겼지만» 프로토콜 상대 URL 이라 외부로 나간다. 반드시 막는다.
 * ⚠ `/\evil.com` 은 일부 브라우저가 `//` 로 취급한다. 같이 막는다.
 */

/** 로그인 URL 에 복귀 경로를 싣는 쿼리 키. ⚠ 바꾸면 발송된 기존 로그인 링크가 복귀를 잃는다. */
export const RETURN_PARAM = 'redirect'

/** 너무 긴 값은 받지 않는다(URL 길이 제한에 걸려 링크 자체가 깨진다). */
const MAX_LEN = 512

/**
 * 통과시킬 값: **`/` 로 시작하는 같은 출처 경로 하나뿐**.
 * 그 밖에는 전부 null — 「모르는 곳으로는 보내지 않는다」.
 */
export function safeReturnPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim()
  if (!v || v.length > MAX_LEN) return null
  // 제어문자(개행·NUL·탭)가 섞이면 URL 파싱이 흔들린다. 코드포인트로 «명시»한다 —
  // 리터럴 제어문자를 소스에 박으면 편집기가 조용히 지워 검사가 무력화된다.
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i)
    if (c <= 0x1f || c === 0x7f) return null
  }
  if (!v.startsWith('/')) return null
  // 프로토콜 상대 URL — 경로처럼 생겼지만 «외부»로 나간다.
  if (v.startsWith('//') || v.startsWith('/\\')) return null
  return v
}

/** 로그인 화면 URL. 복귀 경로가 쓸 수 없는 값이면 «붙이지 않는다»(지어내지 않는다). */
export function loginPathWithReturn(returnPath: unknown, loginPath = '/login'): string {
  const safe = safeReturnPath(returnPath)
  return safe ? `${loginPath}?${RETURN_PARAM}=${encodeURIComponent(safe)}` : loginPath
}

/** `location.search` → 복귀 경로. 파싱이 실패해도 던지지 않는다(로그인 흐름을 막지 않는다). */
export function readReturnPath(search: unknown): string | null {
  if (typeof search !== 'string') return null
  try {
    return safeReturnPath(new URLSearchParams(search).get(RETURN_PARAM))
  } catch {
    return null
  }
}
