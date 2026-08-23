import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * 사진 제보 — **2단계** 클라이언트
 *   1단계 `analyzePhotoReport`  POST /api/ocr/multi-photo  (save='false', 저장 «안 함»)
 *   2단계 `confirmPhotoReport`  POST /api/ocr/confirm      (JSON, 저장)
 *
 * 왜 이 테스트가 있나 (2026-08-06):
 *   이 기능은 «없어서» 생긴 게 아니라 **거짓으로 있었다.**
 *   미등록 바코드 화면의 「이 제품 제보하기」 버튼이 `setReported(true)` 로 로컬 상태만
 *   바꾸고 서버에 아무것도 보내지 않은 채 「제보 감사합니다!」를 띄웠다.
 *   사용자는 제보했다고 믿고 떠났고, 서버에는 아무 기록도 없었다.
 *
 *   그래서 이 테스트의 핵심은 「보내지는가」가 아니라 **「보내지 «않았을» 때 성공이라고
 *   말하지 않는가」** 다. §3 이 그것을 본다. 그 단정이 없으면 같은 사고가 그대로 재발한다.
 *
 * ★★ 2026-08-21 세션64 — 이 파일은 **`submitPhotoReport` 를 검증하던 것을 «이전»한 것**이다.
 *   지운 게 아니다. 함수가 둘로 갈라졌으므로 각 단정이 어느 쪽으로 갔는지 명시한다.
 *
 *     입력 검증(사진 0장·10MB·API URL 미설정)   → 1단계 `analyzePhotoReport` 로 이전(그대로)
 *     요청 형태(multipart 필드)                 → 1단계로 이전. ★ `save` 단정이 **뒤집혔다**:
 *                                                 종전 `'true'`(즉시 저장) → 이제 `'false'`.
 *                                                 종전 주석은 「없으면 저장되지 않는다」였는데,
 *                                                 이제는 «저장되면 안 된다»가 지켜야 할 것이다.
 *                                                 제품명이 확정되기 전에 저장되면
 *                                                 서버가 첫 원재료명(「정제수」)을 이름으로 넣는다.
 *     실패를 성공이라 하지 않는다(§3)           → **양쪽 모두**에 둔다. 저장은 2단계에서만
 *                                                 일어나므로 `saved` 단정은 2단계로 옮겼다.
 *     응답 요약(제품명·영양소 수·알레르기)      → 1단계로 이전 + `analysis_token`·개수 단정 추가
 *     알레르기 3키를 버리지 않는다(세션61)      → 1단계로 이전(문구까지 그대로)
 *
 * ⚠ 서버에 `/api/ocr/confirm` · `analysis_token` 은 2026-08-21 기준 **아직 없다**(구현 중).
 *   이 파일은 전부 목(mock) 기반이고, 실기기 통합 확인은 남아 있다.
 *
 * BASE 는 모듈 로드 시점에 `import.meta.env` 로 확정되므로, 각 케이스에서
 * env 를 먼저 세우고 **동적 import** 로 모듈을 새로 읽는다.
 */

const API = 'https://api.example.test'

async function loadModule() {
  vi.stubEnv('VITE_MEOKSEON_API_URL', API)
  vi.resetModules()
  return await import('../meokseon')
}

function file(name: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' })
}

function okResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, data }),
  } as unknown as Response
}

function errResponse(status: number, message?: string) {
  return {
    ok: false,
    status,
    json: async () => (message ? { success: false, message } : {}),
  } as unknown as Response
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

/* ══════════════════════════════════════════════════════════════════════════
 * 1단계 — analyzePhotoReport
 * ══════════════════════════════════════════════════════════════════════════ */

describe('analyzePhotoReport — 입력 검증 (서버를 부르기 «전»에 막는다)', () => {
  it('사진이 한 장도 없으면 보내지 않는다', async () => {
    const { analyzePhotoReport } = await loadModule()
    await expect(analyzePhotoReport({ barcode: '8801234567890' })).rejects.toThrow('한 장 이상')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('10MB 를 넘는 사진은 보내지 않는다 (서버 multer 가 막기 전에 안내한다)', async () => {
    const { analyzePhotoReport } = await loadModule()
    await expect(
      analyzePhotoReport({ barcode: '8801234567890', labelImage: file('big.jpg', 10 * 1024 * 1024 + 1) }),
    ).rejects.toThrow(/10MB/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('API URL 이 설정되지 않았으면 조용히 성공하지 않는다', async () => {
    vi.stubEnv('VITE_MEOKSEON_API_URL', '')
    vi.resetModules()
    const { analyzePhotoReport } = await import('../meokseon')
    await expect(
      analyzePhotoReport({ labelImage: file('a.jpg', 10) }),
    ).rejects.toThrow(/미설정/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('analyzePhotoReport — 요청 형태 (서버 계약과 일치하는가)', () => {
  it('★ save 는 «false» 다 — 읽어보기가 저장을 일으키면 안 된다 (세션64)', async () => {
    const { analyzePhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({ analysis: {}, analysis_token: 't1' }))

    await analyzePhotoReport({
      barcode: '8802142000755',
      labelImage: file('label.jpg', 100),
      nutritionImage: file('nutri.jpg', 100),
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${API}/api/ocr/multi-photo`)
    expect(init.method).toBe('POST')

    const fd = init.body as FormData
    expect(fd.get('barcode')).toBe('8802142000755')
    // ⚠⚠ 이 단정을 'true' 로 되돌리지 말 것. 되돌리면 사용자가 제품명을 확정하기 «전»에
    //    저장되고, 이름을 모르는 서버가 첫 원재료명(「정제수」)을 제품명으로 넣는다.
    expect(fd.get('save')).toBe('false')
    expect(fd.get('label_image')).toBeInstanceOf(File)
    expect(fd.get('nutrition_image')).toBeInstanceOf(File)
  })

  it('한 장만 있어도 보낸다 (서버는 둘 중 하나만 있어도 받는다)', async () => {
    const { analyzePhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({ analysis: {}, analysis_token: 't1' }))

    await analyzePhotoReport({ barcode: '1', nutritionImage: file('n.jpg', 10) })

    const fd = fetchMock.mock.calls[0][1].body as FormData
    expect(fd.get('label_image')).toBeNull()
    expect(fd.get('nutrition_image')).toBeInstanceOf(File)
  })
})

describe('★ §3-a. 1단계도 실패를 성공이라고 말하지 않는다', () => {
  it('success:false 면 던진다 — HTTP 200 이어도 성공이 아니다', async () => {
    const { analyzePhotoReport } = await loadModule()
    fetchMock.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: false, message: '이미지를 읽지 못했습니다.' }),
    } as unknown as Response)

    await expect(analyzePhotoReport({ barcode: '1', labelImage: file('a.jpg', 10) }))
      .rejects.toThrow('이미지를 읽지 못했습니다.')
  })

  it('HTTP 오류면 던진다', async () => {
    const { analyzePhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(errResponse(500))
    await expect(analyzePhotoReport({ barcode: '1', labelImage: file('a.jpg', 10) })).rejects.toThrow(/500/)
  })

  it('응답이 JSON 이 아니어도 던진다 (프록시가 HTML 을 돌려주는 경우)', async () => {
    const { analyzePhotoReport } = await loadModule()
    fetchMock.mockResolvedValue({
      ok: true, status: 200,
      json: async () => { throw new Error('not json') },
    } as unknown as Response)

    await expect(analyzePhotoReport({ barcode: '1', labelImage: file('a.jpg', 10) })).rejects.toThrow()
  })

  it('네트워크가 끊기면 던진다 (조용히 성공 처리하지 않는다)', async () => {
    const { analyzePhotoReport } = await loadModule()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(analyzePhotoReport({ barcode: '1', labelImage: file('a.jpg', 10) })).rejects.toThrow()
  })
})

describe('analyzePhotoReport — 응답 요약 (사용자에게 «읽어낸 것»을 보여주기 위한 값)', () => {
  it('토큰·제품명·개수·알레르기를 뽑는다', async () => {
    const { analyzePhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({
      analysis_token: 'tok-abc',
      analysis: {
        product_meta: { product_name: '테스트 과자' },
        nutrition: { calories: 140, sodium: 200, total_sugars: null, protein: '' },
        ingredients: ['밀가루', '설탕', '팜유'],
        ingredient_count: 3,
        additives: [{ name: '탄산수소나트륨' }],
        additive_count: 1,
        allergens: ['밀', '대두'],
      },
      save_result: { id: 7 },
    }))

    const r = await analyzePhotoReport({ barcode: '1', labelImage: file('a.jpg', 10) })
    expect(r.analysisToken).toBe('tok-abc')
    expect(r.productName).toBe('테스트 과자')
    expect(r.nutritionCount).toBe(2)              // null·'' 은 «읽힌 값»이 아니다
    expect(r.ingredientCount).toBe(3)
    expect(r.additiveCount).toBe(1)
    expect(r.allergens).toEqual(['밀', '대두'])
  })

  it('★ 토큰이 없거나 빈 문자열이면 «명시적 null» 이다 — 빈 토큰으로 저장을 시도하면 안 된다', async () => {
    const { analyzePhotoReport } = await loadModule()

    fetchMock.mockResolvedValue(okResponse({ analysis: {} }))
    expect((await analyzePhotoReport({ barcode: '1', labelImage: file('a.jpg', 10) })).analysisToken).toBeNull()

    fetchMock.mockResolvedValue(okResponse({ analysis: {}, analysis_token: '   ' }))
    expect((await analyzePhotoReport({ barcode: '1', labelImage: file('a.jpg', 10) })).analysisToken).toBeNull()
  })

  it('개수 필드가 없으면 배열 길이로 «대신 센다» (안 주는 게 0개는 아니다)', async () => {
    const { analyzePhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({
      analysis_token: 't', analysis: { ingredients: ['a', 'b'], additives: [{ n: 1 }] },
    }))

    const r = await analyzePhotoReport({ barcode: '1', labelImage: file('a.jpg', 10) })
    expect(r.ingredientCount).toBe(2)
    expect(r.additiveCount).toBe(1)
  })

  it('아무것도 못 읽어도 던지지 않고 0 으로 보고한다 (사용자에게 재촬영을 안내해야 한다)', async () => {
    const { analyzePhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({ analysis: {} }))

    const r = await analyzePhotoReport({ barcode: '1', labelImage: file('a.jpg', 10) })
    expect(r.nutritionCount).toBe(0)
    expect(r.ingredientCount).toBe(0)
    expect(r.additiveCount).toBe(0)
    expect(r.productName).toBeNull()
    expect(r.allergens).toEqual([])
  })
})

/* ★★★★ 세션61 `U60-7`/`U61-4`
 *
 * 무엇을 지키나 — 서버는 사진 제보 응답에도 알레르기 4키를 «이미» 실어 보낸다
 * (`meokseon-server/src/routes/ocrRoutes.js:724` -> `buildAllergenKeys`).
 * 그런데 이 모듈이 `analysis.allergens`(flat) 하나만 꺼내고 나머지를 **버렸다.**
 * 그래서 화면(`Scan.tsx`)이 목록이 비면 아무것도 안 그렸다 — 침묵이다.
 *
 * 실측(세션61 · 실물 67건): 목록이 비는 라벨 24건(35.8%) 중
 *   · 실제로 «직접 함유»가 있는 것    7건 (29.2%)
 *   · 혼입까지 세면 알려줄 게 있는 것 15건 (62.5%)
 *
 * ⚠ 이 블록을 지우면 그 세 필드가 조용히 다시 사라진다. 지우지 말 것.
 * ⚠ 세션64에서 «1단계로 이전»했다. 화면이 알레르기 카드를 그리는 시점이
 *   이제 저장 «전»(미리보기)이라, 이 필드들은 1단계 응답에 실려야 한다.
 */
describe('analyzePhotoReport — 알레르기 3키를 «버리지 않는다» (세션61 U60-7)', () => {
  it('서버가 보낸 allergens_v2·available·flat_complete 를 그대로 싣는다', async () => {
    const { analyzePhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({
      analysis_token: 't',
      analysis: {
        allergens: ['대두'],
        allergens_v2: { contains: ['대두'], inferred: [], mayContain: ['밀', '우유'] },
        allergens_available: true,
        allergens_flat_complete: false,
      },
    }))

    const r = await analyzePhotoReport({ barcode: '1', labelImage: file('a.jpg', 10) })
    expect(r.allergens_v2).toEqual({ contains: ['대두'], inferred: [], mayContain: ['밀', '우유'] })
    expect(r.allergens_available).toBe(true)
    // ★ 혼입이 있으므로 flat 은 «전부가 아니다». 이 값을 잃으면 화면이 그걸 모른다.
    expect(r.allergens_flat_complete).toBe(false)
  })

  it('★ 혼입만 있는 라벨 — flat 은 비지만 v2 는 살아 있어야 한다 (침묵 24건 중 8건이 이 형태)', async () => {
    const { analyzePhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({
      analysis_token: 't',
      analysis: {
        allergens: [],
        allergens_v2: { contains: [], inferred: [], mayContain: ['대두', '밀', '우유', '토마토'] },
        allergens_available: true,
      },
    }))

    const r = await analyzePhotoReport({ barcode: '1', labelImage: file('a.jpg', 10) })
    expect(r.allergens).toEqual([])
    // ⚠ 여기가 핵심 — flat 이 비었다고 «알레르기 정보가 없다»가 아니다.
    expect(r.allergens_v2?.mayContain).toEqual(['대두', '밀', '우유', '토마토'])
  })

  it('서버가 안 보내면 undefined 가 아니라 «명시적 null» 로 둔다 (v2)', async () => {
    const { analyzePhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({ analysis: {} }))

    const r = await analyzePhotoReport({ barcode: '1', labelImage: file('a.jpg', 10) })
    expect(r.allergens_v2).toBeNull()
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * 2단계 — confirmPhotoReport
 * ══════════════════════════════════════════════════════════════════════════ */

describe('confirmPhotoReport — 입력 검증 (서버를 부르기 «전»에 막는다)', () => {
  it('★ 제품명이 비면 보내지 않는다 — 제이 결정 ②「제품명이 없으면 저장 거부」', async () => {
    const { confirmPhotoReport } = await loadModule()
    await expect(confirmPhotoReport({ analysisToken: 't', productName: '   ' }))
      .rejects.toThrow('제품명')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('토큰이 비면 보내지 않는다 (빈 토큰으로 저장을 시도하지 않는다)', async () => {
    const { confirmPhotoReport } = await loadModule()
    await expect(confirmPhotoReport({ analysisToken: '', productName: '신라면' }))
      .rejects.toThrow(/읽어보기/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('confirmPhotoReport — 요청 형태 (JSON, 서버 계약)', () => {
  it('analysis_token 과 product_info.product_name 을 JSON 으로 싣는다', async () => {
    const { confirmPhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({ save_result: { id: 9 } }))

    await confirmPhotoReport({ analysisToken: 'tok-abc', productName: '  신라면   봉지면 ', barcode: '8801043000000' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${API}/api/ocr/confirm`)
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')

    const body = JSON.parse(init.body as string)
    expect(body.analysis_token).toBe('tok-abc')
    // 공백만 정리한다. 글자를 고치거나 버리지 않는다.
    expect(body.product_info.product_name).toBe('신라면 봉지면')
    // ⚠ 서버 기존 저장 경로가 `req.body.barcode` 를 읽는다. 토큰이 바코드를 품고 있다면
    //   서버가 무시하면 되지만, 품고 있지 않다면 이게 없으면 «미등록 바코드 제보»가 키를 잃는다.
    expect(body.barcode).toBe('8801043000000')
  })
})

describe('★ §3-b. 저장을 «했다»고 함부로 말하지 않는다', () => {
  it('save_result 가 없으면 saved=false 다 — 분석만 된 것을 「저장됐다」로 읽지 않는다', async () => {
    const { confirmPhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({ save_result: null }))

    const r = await confirmPhotoReport({ analysisToken: 't', productName: '신라면' })
    expect(r.saved).toBe(false)
  })

  it('save_result 가 있으면 saved=true 다', async () => {
    const { confirmPhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({ save_result: { id: 3 } }))

    const r = await confirmPhotoReport({ analysisToken: 't', productName: '신라면' })
    expect(r.saved).toBe(true)
    expect(r.rejectReason).toBeNull()
  })

  /**
   * ★★★★ 2026-08-23 세션64 외부검토 §B 중 발견 — **화면이 반려를 「감사합니다」로 말하고 있었다.**
   *
   *   종전 코드: `saved: !!data.save_result`
   *   그런데 서버는 반려할 때도 `save_result` **객체**를 준다:
   *     `{ saved:false, rejectReason:'이 제품은 이미 공공데이터 기반 영양정보가 등록되어 있습니다.' }`
   *     (`meokseon-server/src/services/crowdsourceService.js` 의 게이트 6개 전부 이 모양이다.)
   *   객체는 언제나 truthy → **모든 반려가 saved=true 로 읽혔다.**
   *   2026-08-06 「거짓 확인」 사고와 같은 유형이고, §B 로 «기존 제품» 제보가 열리면
   *   반려는 예외가 아니라 **상시 경로**가 된다(공공데이터 보호 게이트·24시간 중복 게이트).
   */
  it('★★★★ save_result.saved === false 면 saved=false 다 — 반려를 성공으로 읽지 않는다', async () => {
    const { confirmPhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({
      save_result: { saved: false, rejectReason: '이 제품은 이미 공공데이터 기반 영양정보가 등록되어 있습니다.' },
    }))

    const r = await confirmPhotoReport({ analysisToken: 't', productName: '신라면' })
    expect(r.saved).toBe(false)
    // ★ 사유를 «잃지 않는다». 우리 말로 덮으면 사용자는 무엇을 고쳐야 할지 모른다.
    expect(r.rejectReason).toBe('이 제품은 이미 공공데이터 기반 영양정보가 등록되어 있습니다.')
  })

  it('save_result.saved === true 면 saved=true 이고 사유는 없다', async () => {
    const { confirmPhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({
      save_result: { saved: true, productId: 12, message: '기존 제품에 정보가 추가되었습니다.' },
    }))

    const r = await confirmPhotoReport({ analysisToken: 't', productName: '신라면' })
    expect(r.saved).toBe(true)
    expect(r.rejectReason).toBeNull()
  })

  it('저장 실패인데 서버가 사유를 안 주면 «지어내지» 않는다 (null)', async () => {
    const { confirmPhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({ save_result: { saved: false } }))

    const r = await confirmPhotoReport({ analysisToken: 't', productName: '신라면' })
    expect(r.saved).toBe(false)
    expect(r.rejectReason).toBeNull()
  })

  it('success:false 면 던진다 — HTTP 200 이어도 성공이 아니다', async () => {
    const { confirmPhotoReport } = await loadModule()
    fetchMock.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: false, message: '저장하지 못했습니다.' }),
    } as unknown as Response)

    await expect(confirmPhotoReport({ analysisToken: 't', productName: '신라면' }))
      .rejects.toThrow('저장하지 못했습니다.')
  })

  it('네트워크가 끊기면 던진다 (조용히 성공 처리하지 않는다)', async () => {
    const { confirmPhotoReport } = await loadModule()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(confirmPhotoReport({ analysisToken: 't', productName: '신라면' })).rejects.toThrow()
  })
})

describe('★ confirmPhotoReport — 상태 코드를 «잃지 않는다» (400 과 410 은 행동이 다르다)', () => {
  it('400 이면 서버가 준 한국어 사유를 그대로 실어 던진다', async () => {
    const { confirmPhotoReport, MeokseonConfirmError } = await loadModule()
    fetchMock.mockResolvedValue(errResponse(400, '제품명이 필요합니다.'))

    const err = await confirmPhotoReport({ analysisToken: 't', productName: '신라면' }).catch((e) => e)
    expect(err).toBeInstanceOf(MeokseonConfirmError)
    expect(err.status).toBe(400)
    expect(err.serverMessage).toBe('제품명이 필요합니다.')
  })

  it('410 이면 status 가 살아 있다 — 화면이 1단계로 되돌릴 수 있어야 한다', async () => {
    const { confirmPhotoReport, MeokseonConfirmError } = await loadModule()
    fetchMock.mockResolvedValue(errResponse(410, '분석 토큰이 만료되었습니다.'))

    const err = await confirmPhotoReport({ analysisToken: 't', productName: '신라면' }).catch((e) => e)
    expect(err).toBeInstanceOf(MeokseonConfirmError)
    expect(err.status).toBe(410)
  })

  it('서버가 사유를 안 주면 serverMessage 는 «명시적 null» 이다', async () => {
    const { confirmPhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(errResponse(500))

    const err = await confirmPhotoReport({ analysisToken: 't', productName: '신라면' }).catch((e) => e)
    expect(err.status).toBe(500)
    expect(err.serverMessage).toBeNull()
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * ★★ 세션64b — 「부분 저장」필드를 **버리지 않는다**
 *
 * 서버(`crowdsourceService.js:686~690`)가 `save_result` 에 네 키를 새로 실었다:
 *   `nutrition_status` · `nutrition_reject_code` · `nutrition_reject_reason` · `nutrient_count`
 * 영양 실패 6종은 이제 제보를 «반려하지 않고» 영양만 버린다 = `saved:true` 인데 영양은 없다.
 *
 * ⇒ 이 클라이언트가 그 필드를 흘리면, 화면은 그것을 말할 «방법 자체»가 없어진다.
 *   그래서 여기서 지키는 것은 판정이 아니라 **「받은 것을 잃지 않는가」** 하나다.
 * ══════════════════════════════════════════════════════════════════════════ */
describe('★★ confirmPhotoReport — 부분 저장 필드를 잃지 않는다 (세션64b)', () => {
  it('★★★ saved:true 여도 영양 미확보 사실이 «살아서» 온다', async () => {
    const { confirmPhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({
      save_result: {
        saved: true, productId: 12, verification: 'unverified',
        nutrition_status: 'incomplete',
        nutrition_reject_code: 'BASIS_UNKNOWN',
        nutrition_reject_reason: '영양성분의 표기 기준을 판별하지 못했습니다.',
        nutrient_count: 5,
        message: '새 제품으로 등록되었습니다. (영양정보는 확인하지 못해 저장되지 않았습니다.)',
      },
    }))

    const r = await confirmPhotoReport({ analysisToken: 't', productName: '신라면' })
    expect(r.saved).toBe(true)
    // ★ `saved` 로 걸러내지 «않는다». 걸러내면 화면이 다시 침묵한다.
    expect(r.nutritionStatus).toBe('incomplete')
    expect(r.nutritionRejectCode).toBe('BASIS_UNKNOWN')
    expect(r.nutritionRejectReason).toBe('영양성분의 표기 기준을 판별하지 못했습니다.')
    expect(r.nutrientCount).toBe(5)
  })

  it('영양까지 저장되면 status 는 ok 이고 사유는 없다', async () => {
    const { confirmPhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({
      save_result: { saved: true, nutrition_status: 'ok', nutrition_reject_code: null, nutrient_count: 11 },
    }))

    const r = await confirmPhotoReport({ analysisToken: 't', productName: '신라면' })
    expect(r.nutritionStatus).toBe('ok')
    expect(r.nutritionRejectCode).toBeNull()
    expect(r.nutrientCount).toBe(11)
  })

  it('★ 필드가 아예 없으면 «명시적 null» 이다 — 구버전 서버를 「ok 였다」로 읽지 않는다', async () => {
    const { confirmPhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({ save_result: { saved: true, productId: 3 } }))

    const r = await confirmPhotoReport({ analysisToken: 't', productName: '신라면' })
    expect(r.saved).toBe(true)
    expect(r.nutritionStatus).toBeNull()
    expect(r.nutritionRejectCode).toBeNull()
    expect(r.nutritionRejectReason).toBeNull()
    expect(r.nutrientCount).toBeNull()
  })

  it('전부 반려일 때도 필드 읽기가 던지지 않는다 (save_result 가 반려 모양이다)', async () => {
    const { confirmPhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({
      save_result: { saved: false, rejectReason: 'OCR 신뢰도(52%)가 기준(70%) 미만입니다.' },
    }))

    const r = await confirmPhotoReport({ analysisToken: 't', productName: '신라면' })
    expect(r.saved).toBe(false)
    expect(r.nutritionStatus).toBeNull()
    expect(r.nutrientCount).toBeNull()
  })

  it('save_result 자체가 null 이어도 던지지 않는다', async () => {
    const { confirmPhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({ save_result: null }))

    const r = await confirmPhotoReport({ analysisToken: 't', productName: '신라면' })
    expect(r.saved).toBe(false)
    expect(r.nutritionStatus).toBeNull()
  })

  /** 타입이 어긋나면 «받은 척» 하지 않는다. 「뭔가 왔다」를 「이런 값이었다」로 승격시키지 않는다. */
  it('★ 타입이 다르면 null 로 둔다 (숫자 status · 문자열 count)', async () => {
    const { confirmPhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({
      save_result: { saved: true, nutrition_status: 7, nutrition_reject_code: { x: 1 }, nutrient_count: '5' },
    }))

    const r = await confirmPhotoReport({ analysisToken: 't', productName: '신라면' })
    expect(r.nutritionStatus).toBeNull()
    expect(r.nutritionRejectCode).toBeNull()
    expect(r.nutrientCount).toBeNull()
  })

  it('빈 문자열은 null 이다 («코드가 있다»와 「말이 없었다」를 구분해야 한다)', async () => {
    const { confirmPhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({
      save_result: { saved: true, nutrition_status: 'incomplete', nutrition_reject_code: '   ' },
    }))

    const r = await confirmPhotoReport({ analysisToken: 't', productName: '신라면' })
    expect(r.nutritionStatus).toBe('incomplete')
    expect(r.nutritionRejectCode).toBeNull()
  })

  /** 서버가 코드를 늘려도 앱은 그것을 «그대로» 들고 온다. 아는 값만 통과시키지 않는다. */
  it('★ 앱이 모르는 코드도 그대로 실어 온다 (여기서 거르면 판정층이 못 본다)', async () => {
    const { confirmPhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({
      save_result: { saved: true, nutrition_status: 'incomplete', nutrition_reject_code: 'SOME_FUTURE_CODE' },
    }))

    const r = await confirmPhotoReport({ analysisToken: 't', productName: '신라면' })
    expect(r.nutritionRejectCode).toBe('SOME_FUTURE_CODE')
  })

  /**
   * ★ 0 은 유효한 값이다. `nutrient_count: 0` (= NO_NUTRIENTS) 을 falsy 로 흘리면
   *   「영양소 0개」와 「서버가 말 안 함」이 구별되지 않는다.
   *   서버 테스트 §6 이 같은 함정(truthy 검사)으로 세션 하나를 태웠다.
   */
  it('★ nutrient_count 0 을 「없음」으로 흘리지 않는다', async () => {
    const { confirmPhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({
      save_result: { saved: true, nutrition_status: 'incomplete', nutrition_reject_code: 'NO_NUTRIENTS', nutrient_count: 0 },
    }))

    const r = await confirmPhotoReport({ analysisToken: 't', productName: '신라면' })
    expect(r.nutrientCount).toBe(0)
  })
})
