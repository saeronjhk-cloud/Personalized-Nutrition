import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * submitPhotoReport — 사진 제보 (POST /api/ocr/multi-photo)
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

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('submitPhotoReport — 입력 검증 (서버를 부르기 «전»에 막는다)', () => {
  it('사진이 한 장도 없으면 보내지 않는다', async () => {
    const { submitPhotoReport } = await loadModule()
    await expect(submitPhotoReport({ barcode: '8801234567890' })).rejects.toThrow('한 장 이상')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('10MB 를 넘는 사진은 보내지 않는다 (서버 multer 가 막기 전에 안내한다)', async () => {
    const { submitPhotoReport } = await loadModule()
    await expect(
      submitPhotoReport({ barcode: '8801234567890', labelImage: file('big.jpg', 10 * 1024 * 1024 + 1) }),
    ).rejects.toThrow(/10MB/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('API URL 이 설정되지 않았으면 조용히 성공하지 않는다', async () => {
    vi.stubEnv('VITE_MEOKSEON_API_URL', '')
    vi.resetModules()
    const { submitPhotoReport } = await import('../meokseon')
    await expect(
      submitPhotoReport({ labelImage: file('a.jpg', 10) }),
    ).rejects.toThrow(/미설정/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('submitPhotoReport — 요청 형태 (서버 계약과 일치하는가)', () => {
  it('multipart 로 label_image · nutrition_image · barcode · save 를 싣는다', async () => {
    const { submitPhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({ analysis: {}, save_result: { id: 1 } }))

    await submitPhotoReport({
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
    expect(fd.get('save')).toBe('true')          // ★ 없으면 분석만 되고 «저장되지 않는다»
    expect(fd.get('label_image')).toBeInstanceOf(File)
    expect(fd.get('nutrition_image')).toBeInstanceOf(File)
  })

  it('한 장만 있어도 보낸다 (서버는 둘 중 하나만 있어도 받는다)', async () => {
    const { submitPhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({ analysis: {}, save_result: { id: 1 } }))

    await submitPhotoReport({ barcode: '1', nutritionImage: file('n.jpg', 10) })

    const fd = fetchMock.mock.calls[0][1].body as FormData
    expect(fd.get('label_image')).toBeNull()
    expect(fd.get('nutrition_image')).toBeInstanceOf(File)
  })
})

describe('★ §3. 실패를 성공이라고 말하지 않는다 (이 파일이 존재하는 이유)', () => {
  it('save_result 가 없으면 saved=false 다 — 분석만 된 것을 「저장됐다」로 읽지 않는다', async () => {
    const { submitPhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({ analysis: { nutrition: { calories: 100 } }, save_result: null }))

    const r = await submitPhotoReport({ barcode: '1', labelImage: file('a.jpg', 10) })
    expect(r.saved).toBe(false)
  })

  it('success:false 면 던진다 — HTTP 200 이어도 성공이 아니다', async () => {
    const { submitPhotoReport } = await loadModule()
    fetchMock.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: false, message: '이미지를 읽지 못했습니다.' }),
    } as unknown as Response)

    await expect(submitPhotoReport({ barcode: '1', labelImage: file('a.jpg', 10) }))
      .rejects.toThrow('이미지를 읽지 못했습니다.')
  })

  it('HTTP 오류면 던진다', async () => {
    const { submitPhotoReport } = await loadModule()
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) } as unknown as Response)

    await expect(submitPhotoReport({ barcode: '1', labelImage: file('a.jpg', 10) }))
      .rejects.toThrow(/500/)
  })

  it('응답이 JSON 이 아니어도 던진다 (프록시가 HTML 을 돌려주는 경우)', async () => {
    const { submitPhotoReport } = await loadModule()
    fetchMock.mockResolvedValue({
      ok: true, status: 200,
      json: async () => { throw new Error('not json') },
    } as unknown as Response)

    await expect(submitPhotoReport({ barcode: '1', labelImage: file('a.jpg', 10) })).rejects.toThrow()
  })

  it('네트워크가 끊기면 던진다 (조용히 성공 처리하지 않는다)', async () => {
    const { submitPhotoReport } = await loadModule()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(submitPhotoReport({ barcode: '1', labelImage: file('a.jpg', 10) })).rejects.toThrow()
  })
})

describe('submitPhotoReport — 응답 요약 (사용자에게 «읽어낸 것»을 보여주기 위한 값)', () => {
  it('제품명·영양소 개수·알레르기를 뽑는다', async () => {
    const { submitPhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({
      analysis: {
        product_meta: { product_name: '테스트 과자' },
        nutrition: { calories: 140, sodium: 200, total_sugars: null, protein: '' },
        allergens: ['밀', '대두'],
      },
      save_result: { id: 7 },
    }))

    const r = await submitPhotoReport({ barcode: '1', labelImage: file('a.jpg', 10) })
    expect(r.saved).toBe(true)
    expect(r.productName).toBe('테스트 과자')
    expect(r.nutritionCount).toBe(2)              // null·'' 은 «읽힌 값»이 아니다
    expect(r.allergens).toEqual(['밀', '대두'])
  })

  it('아무것도 못 읽어도 던지지 않고 0 으로 보고한다 (사용자에게 재촬영을 안내해야 한다)', async () => {
    const { submitPhotoReport } = await loadModule()
    fetchMock.mockResolvedValue(okResponse({ analysis: {}, save_result: null }))

    const r = await submitPhotoReport({ barcode: '1', labelImage: file('a.jpg', 10) })
    expect(r.nutritionCount).toBe(0)
    expect(r.productName).toBeNull()
    expect(r.allergens).toEqual([])
    expect(r.saved).toBe(false)
  })
})
