/**
 * 제보 로그인 게이트 — 판정과 문구. **순수 함수**(렌더 비의존, 테스트 대상).
 *
 * ★★ 왜 생겼나 (2026-08-24, 세션64c · 제이 확정)
 *   「제보에 대한 결과를 당장이든 검증 후든 소비자에게 제공해야 해.」
 *   결과를 «누구에게» 돌려줄지 알려면 계정이 필요하다. 그래서 제보에 로그인이 붙었다.
 *
 *   종전 식별자는 `lib/deviceId.ts` 의 `device_id`(브라우저 저장소 UUID)였다.
 *   그건 「이 브라우저」를 가리킬 뿐이라 저장소를 지우면 연결이 끊겼고,
 *   무엇보다 **검토 결과를 알려줄 «연락 수단»이 없었다.**
 *
 * ★★★ 이 파일이 지키는 것 — 딱 셋이다.
 *
 *   ① **스캔은 막지 않는다.** 제품 조회(`GET /api/products/*` · `/search`)는 무인증 그대로다.
 *      로그인 벽을 스캔 앞에 세우면 무료 후킹이 통째로 죽는다. 게이트는 «제보»에만 붙는다.
 *
 *   ② **사진을 고르기 «전»에 막는다.** 이 앱의 로그인은 이메일 매직링크라
 *      사용자가 앱을 떠났다가 «새 페이지 로드»로 돌아온다 — 고른 사진(File)은 그때 사라진다.
 *      사진을 다 찍게 해 놓고 「보내기」에서 막으면 **사진을 두 번 찍게 만든다.**
 *      ⇒ 게이트는 「제보하기」 버튼에 붙고, 폼은 로그인된 사람에게만 열린다.
 *
 *   ③ **흐름 도중의 401 은 «자동으로» 로그인으로 보내지 않는다.**
 *      폼이 열린 뒤 세션이 만료되는 경우가 있다. 그때 우리가 마음대로 화면을 옮기면
 *      사용자가 방금 찍은 사진이 «말없이» 사라진다. 사실을 말하고 «선택»을 준다.
 *
 * ⚠ 서버가 401 에 담아 주는 한국어 문구를 그대로 쓰지 «않는다».
 *   400(거부)은 사유가 매번 다르므로 서버 문구를 그대로 쓰는 게 맞지만
 *   (`photoReport.ts:classifyConfirmFailure`), 401 은 사유가 둘뿐이고
 *   **사용자가 할 일은 언제나 「로그인」 하나**다. 다음 행동을 우리가 더 정확히 안다.
 *   ⇒ 서버 문구는 `serverMessage` 로 «보존»만 하고 화면에는 우리 문구를 쓴다.
 */

/** 서버 401 계약(`{ success:false, error:{ code, message } }`)의 코드 2종. */
export type MeokseonAuthCode = 'AUTH_REQUIRED' | 'AUTH_INVALID'

/* ──────────────────────────────────────────────────────────────────────────
 * 1. 문구 — ★★ 안전 계약이다. 정본은 여기 «한 곳». 화면에 다시 적지 말 것.
 * ────────────────────────────────────────────────────────────────────────── */

/** 게이트 제목. 「막혔다」가 아니라 「무엇이 필요하다」를 말한다. */
export const REPORT_LOGIN_HEADLINE = '제보하려면 로그인이 필요해요'

/**
 * 왜 필요한지 «한 줄». 제이 지시 — 이유를 말하라.
 * ⚠ 「보안을 위해」처럼 우리 사정을 말하지 않는다. 사용자가 얻는 것을 말한다.
 */
export const REPORT_LOGIN_WHY =
  '보내주신 제보를 검토한 결과를 알려드리려면 계정이 필요해요.'

/**
 * ★ 스캔은 그대로 된다는 사실을 «반드시» 함께 말한다.
 *   이 줄이 없으면 사용자는 「이제 로그인해야 스캔도 되는구나」로 읽고 떠난다.
 */
export const REPORT_LOGIN_SCAN_OK =
  '제품 스캔과 조회는 로그인 없이 지금처럼 쓰실 수 있어요.'

export const REPORT_LOGIN_CTA = '로그인하고 제보하기'

/** 게이트를 닫는 버튼. 「강제」가 아니라 「선택」임을 남긴다. */
export const REPORT_LOGIN_DISMISS = '나중에 할게요'

/** 로그인 뒤 어디로 돌아오는지 미리 말한다. 매직링크라 앱을 한 번 떠나야 한다. */
export const REPORT_LOGIN_RETURN_NOTICE =
  '이메일로 받은 링크를 열면 이 제품 화면으로 다시 돌아와요.'

/**
 * 401 `AUTH_REQUIRED` — 토큰이 아예 없다(로그인 안 됨/로그아웃됨).
 * ⚠ 「권한이 없습니다」로 쓰지 말 것. 사용자는 자기가 뭘 잘못했는지 모른다.
 */
export const AUTH_REQUIRED_MESSAGE =
  '로그인이 되어 있지 않아 보내지 못했어요. 로그인한 뒤에 다시 보내주세요.'

/** 401 `AUTH_INVALID` — 토큰이 있는데 서버가 거절했다(만료·폐기). */
export const AUTH_INVALID_MESSAGE =
  '로그인 정보가 만료돼 보내지 못했어요. 다시 로그인한 뒤에 보내주세요.'

/**
 * ★★★ 흐름 도중에 로그인으로 «옮겨 갈 때» 반드시 함께 나가는 한 줄.
 *   사진을 잃는다는 사실을 «미리» 말한다. 말없이 잃게 하면 사용자는 앱이 고장 났다고 읽는다.
 *   ⚠ 「사진이 유지됩니다」로 바꾸지 말 것 — 매직링크는 페이지를 새로 연다. 사실이 아니다.
 */
export const AUTH_PHOTO_LOST_NOTICE =
  '지금 로그인하러 가면 고르신 사진은 지워져요. 로그인한 뒤 사진을 다시 골라 주세요.'

/** 흐름 도중 401 에서 내는 버튼. 우리가 «대신» 옮기지 않고 사용자가 누르게 한다. */
export const AUTH_RELOGIN_CTA = '로그인하러 가기'

/** 「내 제보」 화면을 비로그인으로 열었을 때. */
export const CONTRIBUTIONS_LOGIN_REQUIRED =
  '로그인하면 보내주신 제보와 검토 결과를 여기서 볼 수 있어요.'

export const CONTRIBUTIONS_LOGIN_CTA = '로그인'

/* ──────────────────────────────────────────────────────────────────────────
 * 2. 판정
 * ────────────────────────────────────────────────────────────────────────── */

export interface AuthFailure {
  code: MeokseonAuthCode
  /** 사용자에게 그대로 보여줄 문구. **항상 비어 있지 않다.** */
  message: string
  /** 서버가 준 한국어 원문. 화면에 쓰지 않고 «보존»만 한다(진단용). */
  serverMessage: string | null
}

/**
 * 서버 401 본문 → 사용자에게 할 말.
 *
 * ★ **모르는 코드는 `AUTH_REQUIRED` 로 읽는다.** 「다시 로그인해 보라」는 두 경우 모두
 *   맞는 행동이고, 반대로 침묵하면 사용자는 왜 안 보내졌는지 영영 모른다.
 *   (`photoReport.ts` 의 「모르는 코드도 말은 한다」와 같은 규칙.)
 */
export function classifyAuthFailure(rawCode: unknown, rawMessage?: unknown): AuthFailure {
  const code: MeokseonAuthCode =
    (typeof rawCode === 'string' && rawCode.trim().toUpperCase() === 'AUTH_INVALID')
      ? 'AUTH_INVALID'
      : 'AUTH_REQUIRED'
  const serverMessage =
    (typeof rawMessage === 'string' && rawMessage.trim()) ? rawMessage.trim() : null
  return {
    code,
    message: code === 'AUTH_INVALID' ? AUTH_INVALID_MESSAGE : AUTH_REQUIRED_MESSAGE,
    serverMessage,
  }
}

/**
 * 제보 폼을 열어도 되는가.
 * ⚠ `signedIn === null`(아직 모름)은 **연다고 하지 않는다.** 모르는 것을 「된다」로 승격시키면
 *   비로그인 사용자가 사진을 다 찍고 나서야 막힌다 — 이 파일이 막으려는 바로 그 실패다.
 */
export function canOpenReportForm(signedIn: boolean | null): boolean {
  return signedIn === true
}
