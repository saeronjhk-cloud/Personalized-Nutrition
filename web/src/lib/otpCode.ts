/**
 * 이메일 숫자 로그인 코드 — 입력 정규화. **순수 함수**(테스트 대상).
 * ⚠ 자릿수는 Supabase 프로젝트 설정(Email OTP Length, 6~10)이다. 여기서 못 박지 않는다.
 *
 * ★★ 왜 코드 로그인이 생겼나 (2026-08-30, 세션50)
 *
 *   설치된 안드로이드 앱에서 매직링크 로그인이 **구조적으로 완결될 수 없었습니다.**
 *
 *   1. Capacitor 는 `server.hostname` 이 없으면 `localhost` 를 씁니다.
 *      `capacitor.config.ts` 가 `androidScheme: 'https'` 만 두었으므로
 *      앱 WebView 의 origin 은 **`https://localhost`** 입니다 — 웹 도메인이 아닙니다.
 *   2. `LoginEmail` 이 `window.location.origin` 으로 `emailRedirectTo` 를 만드니
 *      앱에서는 `https://localhost/auth/callback?...` 이 나갑니다.
 *   3. 그 주소는 Supabase 허용목록에 없었고, 없으면 **Site URL 로 대체**됩니다.
 *      → 발송된 메일 실측: 08-28 `redirect_to=http://localhost:3000`,
 *        08-30 `redirect_to=https://www.nutriformula.co.kr` — 둘 다 «그때의 Site URL».
 *        경로도 쿼리도 통째로 사라졌습니다.
 *   4. 허용목록에 `https://localhost/**` 를 넣으면 대체는 멈추지만,
 *      **메일 링크는 폰 브라우저에서 열립니다.** 브라우저에게 `https://localhost` 는
 *      폰 자기 자신이고 거기엔 아무것도 없습니다 → 「연결할 수 없음」.
 *   5. 브라우저에서 앱으로 돌아올 통로도 없습니다 — 실측:
 *      AndroidManifest 의 intent-filter 는 MAIN/LAUNCHER 하나뿐(VIEW·BROWSABLE 없음),
 *      `@capacitor/app` 은 backButton 에만 쓰입니다(`appUrlOpen` 리스너 없음).
 *
 *   ⇒ **리다이렉트를 없애는 것이 답입니다.** 코드를 입력받아 `verifyOtp` 하면
 *     origin 도, 허용목록도, 딥링크도 관여하지 않습니다. 웹과 앱이 같은 코드로 돕니다.
 *
 * ⚠ 매직링크는 «그대로 둡니다». 웹 사용자 경험을 바꾸지 않기 위해서입니다.
 *   이메일 템플릿에 `{{ .Token }}` 을 추가하면 한 통에 링크와 코드가 함께 갑니다.
 *
 * ⏳ 딥링크(App Links)는 폐기가 아니라 «출시 전»으로 미룬 것입니다.
 *   `IP/OUTSTANDING_출시전_체크리스트.md` 참조.
 */

/**
 * ⛔ **길이를 6으로 못 박지 않는다.** 초판이 `OTP_LENGTH = 6` 이었고, 배포 직전
 *    실제 발송 메일을 열어 보니 **8자리**였다(2026-08-31 실측: `85630801`).
 *
 *    Supabase 의 「Email OTP Length」는 프로젝트 설정이고 **6~10 사이에서 바뀐다.**
 *    6으로 자르면 8자리 코드가 조용히 앞 6자로 잘려 나가 **반드시 실패**한다 —
 *    사용자는 메일에 있는 코드를 그대로 넣었는데 「코드가 틀렸습니다」를 본다.
 *    화면에도 로그에도 「잘랐다」는 말은 어디에도 안 남는다.
 *
 *    ⇒ 클라이언트는 그 설정을 알 수 없다. **알 수 없는 것을 가정하지 말고 범위를 받는다.**
 *      설정이 바뀌어도 이 코드는 안 깨진다.
 */
export const OTP_MIN_LENGTH = 6
export const OTP_MAX_LENGTH = 10

/**
 * 사용자가 실제로 넣는 것: `85630801` · `8563 0801` · `856-308-01` ·
 * `코드: 85630801` · 메일에서 통째로 복사한 한 줄.
 * **숫자만 남기고 최대 `OTP_MAX_LENGTH` 자까지 취한다.**
 *
 * 붙여넣기를 전제로 만든다 — 손으로 여덟 칸을 정확히 채우게 하면
 * 「코드가 틀렸습니다」의 대부분이 공백·하이픈이 된다.
 */
export function normalizeOtpCode(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  let out = ''
  for (let i = 0; i < raw.length && out.length < OTP_MAX_LENGTH; i++) {
    const c = raw.charCodeAt(i)
    if (c >= 0x30 && c <= 0x39) out += raw[i]   // '0'~'9' — 전각 숫자는 받지 않는다
  }
  return out
}

/**
 * 서버에 보낼 준비가 됐는가. 이 값이 false 면 «전송 자체를 하지 않는다».
 *
 * ⚠ 정확한 길이를 모르므로 «최소 길이»로만 막는다. 6자만 넣고 눌러도 전송은 되고,
 *   서버가 거부하면 그 메시지를 그대로 보여준다. **조용히 자르는 것보다 낫다** —
 *   자르면 사용자는 자기가 맞게 넣었는데 왜 틀렸는지 알 방법이 없다.
 */
export function isCompleteOtpCode(raw: unknown): boolean {
  return normalizeOtpCode(raw).length >= OTP_MIN_LENGTH
}
