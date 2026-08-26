/**
 * 먹선 API 용 Supabase 액세스 토큰 조달. **부수효과가 있는 얇은 층**이다.
 *
 * ★★ 계약 (2026-08-24, 세션64c · 서버 담당과 «동일»)
 *   먹선 API 의 인증 필요 엔드포인트는 `Authorization: Bearer <supabase access token>` 을 받는다.
 *   토큰은 `supabase.auth.getSession()` 의 `session.access_token` 이다.
 *   선례: `lib/checkup_api.ts:56` — 같은 방식으로 세션을 읽는다. 새 인증 흐름을 만들지 않았다.
 *
 * ★ 왜 별도 파일인가 — `lib/supabase.ts` 는 **모듈 로드 시점에 던진다**
 *   (`VITE_SUPABASE_URL` 이 없으면 `throw`). `lib/meokseon.ts` 가 그걸 정적으로 import 하면
 *   먹선 API 테스트가 Supabase 환경변수를 세우지 않는 한 «전부» 죽는다.
 *   ⇒ 여기서 **동적 import** 로 가둔다. 부르지 않으면 로드되지 않는다.
 *
 * ⚠ 토큰을 «캐시하지 않는다». Supabase 클라이언트가 만료 30초 전에 스스로 갱신하는데
 *   (`autoRefreshToken: true`), 우리가 따로 들고 있으면 **낡은 토큰으로 401** 이 난다.
 *   매 호출마다 묻는 것이 맞다 — `getSession()` 은 로컬 저장소 조회라 네트워크가 아니다.
 *
 * ⚠ 이 값은 **먹선 API 로만** 나간다. 로그·계측(`track()`)에 절대 싣지 않는다
 *   (`lib/events.ts` 원칙 — 익명 계측에 자격증명이 섞이면 익명이 아니다).
 */

/**
 * 지금 쓸 수 있는 액세스 토큰. 없으면 **null**(던지지 않는다).
 *
 * ★ 「로그인 안 됨」과 「조회 실패」를 구분하지 «않는다» — 호출자가 할 일이 어느 쪽이든
 *   똑같이 「로그인」이기 때문이다. 다만 진단을 잃지 않도록 실패는 콘솔에 남긴다.
 */
export async function getMeokseonAccessToken(): Promise<string | null> {
  try {
    const { supabase } = await import('./supabase')
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      const msg = error.message ?? ''
      // 세션이 «없는» 것은 오류가 아니다 — 그냥 로그인 안 된 상태다.
      if (!/session missing|AuthSessionMissing/i.test(msg)) {
        console.error('[meokseonAuth] getSession failed:', msg)
      }
      return null
    }

    const token = data?.session?.access_token
    return (typeof token === 'string' && token.trim()) ? token.trim() : null
  } catch (e) {
    // `supabase.ts` 가 환경변수 미설정으로 던지는 경우도 여기로 온다.
    // ⚠ 여기서 던지면 제보 버튼이 «아무 말 없이» 죽는다. null 로 내려 게이트가 말하게 한다.
    console.error('[meokseonAuth] token unavailable:', e)
    return null
  }
}

/** 지금 로그인돼 있는가. 게이트 판정용 — 토큰 문자열을 화면까지 흘리지 않기 위한 좁은 문. */
export async function isMeokseonSignedIn(): Promise<boolean> {
  return (await getMeokseonAccessToken()) !== null
}
