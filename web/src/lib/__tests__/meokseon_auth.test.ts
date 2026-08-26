/**
 * 먹선 API 인증 배선 — 세션64c (2026-08-24 제이 확정 「제보도 로그인 필수」).
 *
 * ★ 계약(서버 담당과 «동일»)
 *   인증 필수 : POST /api/ocr/multi-photo · POST /api/ocr/confirm · GET /api/contributions/mine
 *   무인증    : GET /api/products/* · /search      ← **스캔은 종전대로 로그인 없이 된다**
 *   헤더      : `Authorization: Bearer <supabase access token>`
 *   401 본문  : `{ success:false, error:{ code:'AUTH_REQUIRED'|'AUTH_INVALID', message } }`
 *
 * ★★ 이 파일이 지키는 것 — 넷이다.
 *   ① 토큰이 «실제로» 헤더에 실린다. (안 실리면 서버는 전부 401 을 준다)
 *   ② 토큰이 없으면 **요청을 보내지 않는다.** 사진 두 장을 올려놓고 401 을 받으면
 *      사용자의 데이터 요금만 쓰고 결과는 같다.
 *   ③ 401 이 다른 오류로 «뭉개지지» 않는다. 뭉개지면 화면이 「잠시 후 다시 시도해 주세요」를
 *      띄우고, 사용자는 로그인하면 될 일을 영영 모른다.
 *   ④ **스캔 경로에는 Authorization 이 붙지 않는다.** 붙이는 순간 무료 후킹이 죽는다.
 *
 * ⚠ 2026-08-24 기준 서버의 이 배선은 **구현 중**이다. 전부 목(mock) 기반이고
 *   실제 왕복은 확인하지 못했다.
 *
 * BASE 는 모듈 로드 시점에 `import.meta.env` 로 확정되므로 각 케이스에서 동적 import 한다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const API = 'https://api.example.test'

/** `lib/meokseonAuth` 를 통째로 목킹한다 — Supabase 클라이언트를 테스트에 끌어들이지 않는다. */
const auth = vi.hoisted(() => ({ token: 'tok_abc123' as string | null }))
vi.mock('../meokseonAuth', () => ({
  getMeokseonAccessToken: async () => auth.token,
  isMeokseonSignedIn: async () => auth.token !== null,
}))

async function loadModule() {
  vi.stubEnv('VITE_MEOKSEON_API_URL', API)
  vi.resetModules()
  return await import('../meokseon')
}

function file(name: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' })
}

function okResponse(data: unknown) {
  return { ok: true, status: 200, json: async () => ({ success: true, data }) } as unknown as Response
}

function unauthorized(code?: string, message?: string) {
  return {
    ok: false,
    status: 401,
    json: async () => ({ success: false, error: { code, message } }),
  } as unknown as Response
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  auth.token = 'tok_abc123'
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

/** 마지막 fetch 호출의 헤더를 평평한 객체로. (Headers 객체·plain object 둘 다 견딘다) */
function lastHeaders(): Record<string, string> {
  const init = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][1] as RequestInit | undefined
  const h = init?.headers
  if (!h) return {}
  if (h instanceof Headers) return Object.fromEntries(h.entries())
  return { ...(h as Record<string, string>) }
}

/* ══════════════════════════════════════════════════════════════════════════
 * ① 토큰이 헤더에 실린다
 * ════════════════════════════════════════════════════════════════════════ */

describe('Authorization 헤더 — 인증 필수 엔드포인트', () => {
  it('★ analyzePhotoReport 가 Bearer 토큰을 싣는다', async () => {
    const { analyzePhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({ analysis: {}, analysis_token: 't' }))
    await analyzePhotoReport({ barcode: '8801', labelImage: file('a.jpg', 10) })
    expect(lastHeaders().Authorization).toBe('Bearer tok_abc123')
  })

  it('★ multipart 요청에 Content-Type 을 «직접 넣지 않는다» (boundary 가 깨진다)', async () => {
    const { analyzePhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({ analysis: {}, analysis_token: 't' }))
    await analyzePhotoReport({ barcode: '8801', labelImage: file('a.jpg', 10) })
    const keys = Object.keys(lastHeaders()).map((k) => k.toLowerCase())
    expect(keys).not.toContain('content-type')
  })

  it('★ confirmPhotoReport 가 Bearer 토큰을 싣는다 (JSON Content-Type 과 «함께»)', async () => {
    const { confirmPhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({ save_result: { saved: true } }))
    await confirmPhotoReport({ analysisToken: 't', productName: '신라면' })
    const h = lastHeaders()
    expect(h.Authorization).toBe('Bearer tok_abc123')
    expect(h['Content-Type']).toBe('application/json')
  })

  it('★ listMyContributions 가 Bearer 토큰을 싣는다', async () => {
    const { listMyContributions } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({ items: [], total: 0 }))
    await listMyContributions()
    expect(lastHeaders().Authorization).toBe('Bearer tok_abc123')
  })

  it('★★ listMyContributions 는 device_id 를 «보내지 않는다» — 식별자는 계정이다', async () => {
    const { listMyContributions } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({ items: [], total: 0 }))
    await listMyContributions({ limit: 20, offset: 0 })
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('/api/contributions/mine?')
    expect(url).toContain('limit=20')
    expect(url).toContain('offset=0')
    expect(url).not.toContain('device_id')
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * ② 토큰이 없으면 요청 자체를 보내지 않는다
 * ════════════════════════════════════════════════════════════════════════ */

describe('비로그인 — 요청을 «보내기 전»에 막는다', () => {
  it('★★★ analyzePhotoReport: 사진을 업로드하지 않는다', async () => {
    auth.token = null
    const { analyzePhotoReport, MeokseonAuthError } = await loadModule()
    await expect(
      analyzePhotoReport({ barcode: '8801', labelImage: file('a.jpg', 10) }),
    ).rejects.toBeInstanceOf(MeokseonAuthError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('★★★ confirmPhotoReport: 저장을 시도하지 않는다', async () => {
    auth.token = null
    const { confirmPhotoReport, MeokseonAuthError } = await loadModule()
    await expect(
      confirmPhotoReport({ analysisToken: 't', productName: '신라면' }),
    ).rejects.toBeInstanceOf(MeokseonAuthError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('★★★ listMyContributions: 조회하지 않는다', async () => {
    auth.token = null
    const { listMyContributions, MeokseonAuthError } = await loadModule()
    await expect(listMyContributions()).rejects.toBeInstanceOf(MeokseonAuthError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('던지는 오류의 코드는 AUTH_REQUIRED 이고 문구가 비어 있지 않다', async () => {
    auth.token = null
    const { analyzePhotoReport, MeokseonAuthError } = await loadModule()
    try {
      await analyzePhotoReport({ barcode: '8801', labelImage: file('a.jpg', 10) })
      expect.unreachable('던져야 한다')
    } catch (e) {
      expect(e).toBeInstanceOf(MeokseonAuthError)
      expect((e as InstanceType<typeof MeokseonAuthError>).code).toBe('AUTH_REQUIRED')
      expect((e as Error).message.length).toBeGreaterThan(0)
    }
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * ③ 서버 401 — 다른 오류로 뭉개지지 않는다
 * ════════════════════════════════════════════════════════════════════════ */

describe('서버 401 처리', () => {
  it('★ analyzePhotoReport 의 401 은 MeokseonAuthError 다', async () => {
    const { analyzePhotoReport, MeokseonAuthError } = await loadModule()
    fetchMock.mockResolvedValue(unauthorized('AUTH_INVALID', '토큰이 만료되었습니다'))
    try {
      await analyzePhotoReport({ barcode: '8801', labelImage: file('a.jpg', 10) })
      expect.unreachable('던져야 한다')
    } catch (e) {
      expect(e).toBeInstanceOf(MeokseonAuthError)
      expect((e as InstanceType<typeof MeokseonAuthError>).code).toBe('AUTH_INVALID')
      expect((e as InstanceType<typeof MeokseonAuthError>).serverMessage).toBe('토큰이 만료되었습니다')
    }
  })

  it('★★★ confirmPhotoReport 의 401 이 MeokseonConfirmError 로 «뭉개지지» 않는다', async () => {
    const { confirmPhotoReport, MeokseonAuthError, MeokseonConfirmError } = await loadModule()
    fetchMock.mockResolvedValue(unauthorized('AUTH_REQUIRED', '로그인이 필요합니다'))
    try {
      await confirmPhotoReport({ analysisToken: 't', productName: '신라면' })
      expect.unreachable('던져야 한다')
    } catch (e) {
      expect(e).toBeInstanceOf(MeokseonAuthError)
      expect(e).not.toBeInstanceOf(MeokseonConfirmError)
    }
  })

  it('★★★ listMyContributions 의 401 이 MeokseonContributionsError 로 «뭉개지지» 않는다', async () => {
    const { listMyContributions, MeokseonAuthError, MeokseonContributionsError } = await loadModule()
    fetchMock.mockResolvedValue(unauthorized('AUTH_REQUIRED'))
    try {
      await listMyContributions()
      expect.unreachable('던져야 한다')
    } catch (e) {
      expect(e).toBeInstanceOf(MeokseonAuthError)
      expect(e).not.toBeInstanceOf(MeokseonContributionsError)
    }
  })

  it('★ 401 인데 코드를 안 주면 AUTH_REQUIRED 로 읽는다 — 침묵하지 않는다', async () => {
    const { listMyContributions, MeokseonAuthError } = await loadModule()
    fetchMock.mockResolvedValue({
      ok: false, status: 401, json: async () => ({ success: false }),
    } as unknown as Response)
    try {
      await listMyContributions()
      expect.unreachable('던져야 한다')
    } catch (e) {
      expect((e as InstanceType<typeof MeokseonAuthError>).code).toBe('AUTH_REQUIRED')
    }
  })

  it('401 이 «아닌» 실패는 종전 오류 그대로다 (401 처리가 다른 분기를 삼키지 않았다)', async () => {
    const { confirmPhotoReport, MeokseonConfirmError } = await loadModule()
    fetchMock.mockResolvedValue({
      ok: false, status: 410, json: async () => ({ success: false, message: '만료' }),
    } as unknown as Response)
    await expect(
      confirmPhotoReport({ analysisToken: 't', productName: '신라면' }),
    ).rejects.toBeInstanceOf(MeokseonConfirmError)
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * ④ 스캔은 무인증 — 로그인 벽을 세우지 않는다
 * ════════════════════════════════════════════════════════════════════════ */

describe('★★★★ 제품 조회는 무인증 유지', () => {
  it('getProduct 는 로그인 안 돼 있어도 «동작»한다', async () => {
    auth.token = null
    const { getProduct } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({ product: { product_id: 1, barcode: '8801', product_name: '신라면' }, nutrition: null }))
    const r = await getProduct('8801')
    expect(r.product.product_name).toBe('신라면')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('★ getProduct 요청에 Authorization 을 «붙이지 않는다»', async () => {
    const { getProduct } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({ product: { product_id: 1, barcode: '8801', product_name: '신라면' }, nutrition: null }))
    await getProduct('8801')
    // 두 번째 인자가 아예 없거나, 있어도 Authorization 이 없다.
    expect(lastHeaders().Authorization).toBeUndefined()
  })

  it('searchProducts 도 로그인 없이 동작하고 헤더가 붙지 않는다', async () => {
    auth.token = null
    const { searchProducts } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({ products: [{ product_id: 1, product_name: '신라면' }] }))
    const r = await searchProducts('신라면')
    expect(r).toHaveLength(1)
    expect(lastHeaders().Authorization).toBeUndefined()
  })

  it('getAdditiveSummary 도 마찬가지다', async () => {
    auth.token = null
    const { getAdditiveSummary } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({ product_id: 1, product_name: '신라면', additives: [], risk_summary: { total: 0 } }))
    await getAdditiveSummary('8801')
    expect(lastHeaders().Authorization).toBeUndefined()
  })
})
