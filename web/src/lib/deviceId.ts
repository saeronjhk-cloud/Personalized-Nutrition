/**
 * 제보자 식별자(`device_id`) — 생성·보관·검증.
 *
 * ★★ 왜 생겼나 (2026-08-23, 세션64b)
 *   제보를 보낸 사람이 **자기 제보를 다시 볼 방법이 없었다.**
 *   서버 `contributions` 에는 `user_id`·`device_id` 두 칸이 있는데 웹 제보는 **둘 다 null** 이다.
 *     · 앱에는 `device_id` 개념이 아예 없었다(2026-08-23 grep 0건)
 *     · 앱은 Supabase Auth, 먹선 서버는 Firebase Auth — **두 계정 체계가 연결돼 있지 않다**
 *   ⇒ 「내 제보」를 만들려면 앱이 «스스로» 식별자를 만들어 보내는 수밖에 없다.
 *
 * ★ 무엇이 아닌가 — **이건 계측용 식별자가 아니다.**
 *   `lib/events.ts` 는 「영속 식별자를 만들지 않는다」를 원칙으로 두고 `visit_id` 를 메모리에만
 *   둔다. 그 원칙은 그대로다. 이 값은 **먹선 제보 API 로만** 나가고,
 *   `track()` props 에 **절대 싣지 않는다.** (싣는 순간 익명 계측이 기기 단위 추적이 된다.)
 *
 * ★ 한계 — 화면에서 «정직하게» 말한다(아래 `DEVICE_ID_LIMIT_NOTICE`).
 *   저장소를 지우거나 다른 기기·브라우저로 가면 이 값이 달라져 **지난 제보가 안 보인다.**
 *   제보 자체는 서버에 남아 있다 — 「사라졌다」가 아니라 「연결이 끊겼다」이므로 그렇게 말한다.
 *
 * ⚠ 형식은 **UUID v4** 다. 서버가 형식을 검사해 틀리면 400 을 준다(계약).
 *   ⇒ 폴백 생성기도 반드시 v4 «모양»을 만들어야 한다. `Date.now()` 기반 임의 문자열을 쓰면
 *     `crypto` 가 없는 환경에서만 조용히 400 이 나고, 그 환경에서만 이력이 영영 비게 된다.
 */

/** localStorage 키. ⚠ 바꾸면 기존 사용자의 이력 연결이 끊긴다. */
export const DEVICE_ID_KEY = 'ms_device_id'

/** UUID v4 형식(서버 검증과 같은 모양). 대소문자는 가리지 않는다. */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * 사용자에게 보이는 한계 고지. **정본은 여기 한 곳이다.**
 * ⚠ 「기기를 바꾸면 이력이 사라져요」라고 쓰지 말 것 — 제보는 서버에 그대로 남아 있다.
 *   사라지는 것은 «이 화면과의 연결»이다. 사실과 다른 말을 하면 사용자가 다시 제보한다.
 */
export const DEVICE_ID_LIMIT_NOTICE =
  '제보 이력은 이 기기의 브라우저에만 연결돼 있어요. 저장소를 지우거나 다른 기기·브라우저에서 열면 지난 제보가 보이지 않아요. (보내주신 제보는 그대로 남아 있어요.)'

export function isDeviceId(v: unknown): v is string {
  return typeof v === 'string' && UUID_V4.test(v.trim())
}

/**
 * UUID v4 생성. 세 단계로 내려간다 — **어느 단계에서도 v4 «모양»을 지킨다.**
 *   ① `crypto.randomUUID()`        표준. 대부분의 브라우저.
 *   ② `crypto.getRandomValues()`   구형 사파리·비-보안 컨텍스트에서 ①이 없을 때.
 *   ③ `Math.random()`              암호학적으로 약하지만, 이 값은 «비밀»이 아니라 «칸막이»다.
 *                                  없는 것보다 낫다(이력이 아예 안 묶이는 것보다).
 */
export function randomDeviceId(): string {
  const c: any = typeof crypto !== 'undefined' ? crypto : undefined

  if (c && typeof c.randomUUID === 'function') {
    const v = c.randomUUID()
    if (isDeviceId(v)) return v
  }

  const bytes = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  // v4 표식 — 버전 니블 4, variant 니블 10xx.
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** localStorage 만큼만 요구한다. 테스트에서 가짜 저장소를 넣기 위해 좁혀 둔 인터페이스. */
export interface DeviceIdStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/**
 * 저장된 값이 있으면 그대로, 없거나 «형식이 깨졌으면» 새로 만들어 저장한다.
 *
 * ⚠ 형식이 깨진 값을 그대로 쓰지 않는다 — 서버가 400 을 주므로 제보가 통째로 실패한다.
 *   덮어쓰면 그 기기의 지난 제보와 연결이 끊기지만, 애초에 그 값으로는 조회도 안 됐다.
 * ⚠ 저장 실패(사파리 프라이빗·용량 초과)를 삼킨다. **제보를 막지 않는다** —
 *   그 세션에서는 이력이 안 묶이지만, 제보 자체는 성공해야 한다.
 */
export function ensureDeviceId(
  store: DeviceIdStore | null | undefined,
  gen: () => string = randomDeviceId,
): string {
  let existing: string | null = null
  try { existing = store ? store.getItem(DEVICE_ID_KEY) : null } catch { existing = null }
  if (isDeviceId(existing)) return existing.trim()

  const fresh = gen()
  try { store?.setItem(DEVICE_ID_KEY, fresh) } catch { /* 저장 실패가 제보를 막아선 안 된다 */ }
  return fresh
}

function browserStore(): DeviceIdStore | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch { return null }
}

/**
 * ★ 메모리 캐시 — **저장소를 못 쓰는 환경에서도 한 세션 안에서는 «같은» 값을 쓴다.**
 *   캐시가 없으면 호출마다 새 UUID 가 나와서, 1단계(analyze)와 2단계(confirm)가
 *   **서로 다른 기기로 기록**된다. 그러면 방금 보낸 제보조차 이력에 안 뜬다.
 */
let cached: string | null = null

/** 제보에 실어 보낼 값. 없으면 만든다. */
export function getDeviceId(): string {
  if (cached) return cached
  cached = ensureDeviceId(browserStore())
  return cached
}

/** 이미 만들어져 있는가만 본다. **없어도 만들지 않는다**(조회 화면의 빈 상태 판정용). */
export function peekDeviceId(): string | null {
  if (cached) return cached
  let v: string | null = null
  try { v = browserStore()?.getItem(DEVICE_ID_KEY) ?? null } catch { v = null }
  return isDeviceId(v) ? v.trim() : null
}

/** 테스트 전용 — 모듈 캐시를 비운다. 화면 코드에서 부르지 말 것. */
export function __resetDeviceIdCache(): void {
  cached = null
}
