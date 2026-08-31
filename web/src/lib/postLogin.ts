/**
 * 로그인 «직후» 반드시 일어나야 하는 일 — 한 군데로 모은다.
 *
 * ★★ 왜 생겼나 (2026-08-30, 세션50)
 *
 *   이 작업들은 `pages/AuthCallback.tsx` 안에만 있었다. 그런데 세션50 실측에서
 *   **설치된 앱은 `/auth/callback` 에 «한 번도» 도달한 적이 없다**는 것이 드러났다
 *   (원인은 `lib/otpCode.ts` 상단 참조). 즉 앱 사용자에게는 아래가 전부 안 돌았다:
 *
 *     · 비로그인 세션(anon_sessions)을 계정에 연결  ← **로그인 직후가 유일한 시점**
 *     · 비로그인 스캔 승격(IP/146)                  ← Scan 진입 시 재시도되므로 지연될 뿐
 *
 *   화면에는 아무 표시도 없었다. 조용히 안 됐다.
 *
 * ⇒ 그래서 «경로»가 아니라 «함수»에 둔다. 매직링크로 들어오든 6자리 코드로 들어오든
 *   같은 함수를 부른다. **「링크로는 되는데 코드로는 안 되는」 비대칭이 생길 자리를 없앤다.**
 *   로그인 경로가 하나 더 생길 때도 여기만 부르면 된다.
 *
 * ⚠ 이 함수는 «절대 던지지 않는다». 부가 작업이 실패해도 로그인 자체는 성공이다.
 *   대신 무엇이 실패했는지 «반환»한다 — 호출자가 화면에 알릴 수 있게(규칙60:
 *   실패를 삼키지 않는다).
 */
import { supabase } from './supabase'
import { promoteLocalScans } from './scanHistory'
import { track } from './events'

export type LinkStatus = 'ok' | 'failed' | 'skipped'

export interface PostLoginResult {
  /** anon_sessions 연결 결과. 'skipped' = 연결할 세션이 애초에 없었다. */
  linked: LinkStatus
  /** 연결 실패 사유(있으면). 화면에 띄울 수 있다. */
  linkError?: string
  /** promoteLocalScans 의 status. 'noop' 이면 승격할 게 없었다. */
  promote: string
}

/**
 * 연결할 비로그인 세션 id 를 찾는다.
 *
 * 매직링크 경로는 URL 쿼리로 실려 오지만(`?session_id=...`), **코드 경로에는 URL 이 없다.**
 * 그래서 로컬 저장분을 «항상» 대안으로 본다. 둘 다 없으면 연결할 게 없는 것이다.
 */
export function readPendingSessionId(search?: string | null): string | null {
  if (typeof search === 'string' && search) {
    try {
      const fromUrl = new URLSearchParams(search).get('session_id')
      if (fromUrl) return fromUrl
    } catch {
      /* 파싱 실패는 «없음»으로 본다 — 로그인 흐름을 막지 않는다 */
    }
  }
  try {
    return localStorage.getItem('last_session_id')
  } catch {
    return null
  }
}

/**
 * @param userId  방금 로그인한 사용자 id
 * @param sessionId  연결할 비로그인 세션 id (없으면 null)
 * @param at  텔레메트리에 남길 진입 경로. 'auth_callback' | 'otp_code'
 */
export async function runPostLogin(
  userId: string,
  sessionId: string | null,
  at: string,
): Promise<PostLoginResult> {
  const result: PostLoginResult = { linked: 'skipped', promote: 'noop' }

  if (sessionId) {
    try {
      const { error } = await supabase
        .from('anon_sessions')
        .update({ linked_user_id: userId })
        .eq('session_id', sessionId)
        .is('linked_user_id', null)
      if (error) {
        result.linked = 'failed'
        result.linkError = error.message
        console.error('[postLogin] link failed:', error.message)
      } else {
        result.linked = 'ok'
        console.log('[postLogin] linked', sessionId, 'to user', userId)
      }
    } catch (e) {
      result.linked = 'failed'
      result.linkError = e instanceof Error ? e.message : String(e)
      console.error('[postLogin] link threw:', result.linkError)
    }
  }

  // 비로그인 스캔 승격(IP/146). 실패해도 로그인 흐름을 막지 않는다 —
  // 멱등이므로 Scan 진입 시 재시도된다.
  try {
    const p = await promoteLocalScans()
    result.promote = p.status
    if (p.status !== 'noop') {
      console.log('[postLogin] scan promote:', p)
      track('scan_promote', {
        status: p.status, attempted: p.attempted, promoted: p.promoted, at,
      })
    }
  } catch (e) {
    console.debug('[postLogin] promote skipped:', e)
  }

  return result
}
