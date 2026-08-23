import { describe, it, expect } from 'vitest'
import {
  normalizeProductName,
  checkProductName,
  seedProductName,
  seedProductNameForExisting,
  canSubmitReport,
  classifyConfirmFailure,
  describeReadback,
  PRODUCT_NAME_REQUIRED,
  NO_TOKEN_MESSAGE,
  TOKEN_EXPIRED_MESSAGE,
  CONFIRM_FALLBACK_MESSAGE,
  OCR_NAME_FOUND_NOTICE,
  OCR_NAME_MISSING_NOTICE,
  REGISTERED_NAME_NOTICE,
  classifyPhotoReportOutcome,
  REPORT_SAVED_NEW,
  REPORT_SAVED_EXISTING,
  REPORT_PARTIAL_SAVED_NEW,
  REPORT_PARTIAL_SAVED_EXISTING,
  REPORT_REJECT_FALLBACK,
  NUTRITION_UNKNOWN_NOTICE,
  type NutritionRejectCode,
  type PhotoReportOutcomeInput,
} from '../photoReport'

/**
 * 사진 제보 제품명 확정 판정.
 *
 * 이 테스트가 지키는 것은 «편한가»가 아니라 다음 넷이다.
 *   ① 모르는 이름을 **지어내지 않는다**   (OCR 이 못 읽으면 빈칸 + 왜 비었는지 안내)
 *   ② 이름 없이 **저장되지 않는다**       (제이 결정 ②)
 *   ③ 낡은 토큰으로 **저장되지 않는다**   (토큰 없으면 게이트가 막는다)
 *   ④ 실패를 성공이라 **말하지 않는다**   (400 은 서버 사유 그대로, 410 은 1단계 복귀)
 *
 * 실측 근거(실물 라벨 67건 · 세션64):
 *   라벨에 제품명이 인쇄된 것 40건(59.7%) · OCR 로 쓸 수 있는 값 33건(49.3%).
 *   ⇒ 「못 읽음」은 예외가 아니라 **절반의 경로**다. 그 경로가 막다른 길이면 안 된다.
 */

describe('normalizeProductName — 공백만 정리한다', () => {
  it('앞뒤 공백을 없애고 사이 공백은 하나로 줄인다', () => {
    expect(normalizeProductName('  신라면   봉지면 ')).toBe('신라면 봉지면')
  })
  it('탭·줄바꿈도 공백으로 본다 (OCR 값이 여러 줄로 올 수 있다)', () => {
    expect(normalizeProductName('오리온\n초코파이\t情')).toBe('오리온 초코파이 情')
  })
  it('문자열이 아니면 빈 문자열이다 (null·undefined·숫자를 이름으로 만들지 않는다)', () => {
    expect(normalizeProductName(null)).toBe('')
    expect(normalizeProductName(undefined)).toBe('')
    expect(normalizeProductName(123)).toBe('')
    expect(normalizeProductName({ product_name: '신라면' })).toBe('')
  })
  it('★ 글자 자체는 바꾸지 않는다 — 사용자가 적은 이름을 우리가 고치면 안 된다', () => {
    expect(normalizeProductName('CJ 햇반 210g (2입)')).toBe('CJ 햇반 210g (2입)')
  })
})

describe('★ ② checkProductName — 이름이 없으면 보내지 않는다', () => {
  it('빈 값·공백만 있는 값은 거부하고 «이유»를 준다', () => {
    for (const raw of ['', '   ', '\n\t', null, undefined]) {
      const r = checkProductName(raw)
      expect(r.ok).toBe(false)
      expect(r.reason).toBe(PRODUCT_NAME_REQUIRED)
    }
  })
  it('이름이 있으면 통과하고 «정규화된 정본»을 준다', () => {
    const r = checkProductName('  신라면  ')
    expect(r.ok).toBe(true)
    expect(r.value).toBe('신라면')
    expect(r.reason).toBeNull()
  })
  it('한 글자여도 받는다 — 길이를 우리가 임의로 정하지 않는다(서버 규칙이 정본)', () => {
    expect(checkProductName('콘').ok).toBe(true)
  })
})

describe('★ ① seedProductName — 자동채움. 모르는 이름을 지어내지 않는다', () => {
  it('OCR 이 이름을 주면 그대로 채우고, 「고쳐도 된다」고 말한다', () => {
    const s = seedProductName('신라면')
    expect(s.value).toBe('신라면')
    expect(s.found).toBe(true)
    expect(s.notice).toBe(OCR_NAME_FOUND_NOTICE)
  })

  it('★ 못 읽었으면 «빈칸»으로 두고 무엇을 해야 하는지 말한다 (「미인식」으로 끝내지 않는다)', () => {
    for (const raw of [null, undefined, '', '   ', 42]) {
      const s = seedProductName(raw)
      expect(s.value).toBe('')
      expect(s.found).toBe(false)
      expect(s.notice).toBe(OCR_NAME_MISSING_NOTICE)
      // 지금의 실패 지점이 바로 이것 — 안내가 «행동»을 말해야 한다.
      expect(s.notice).toContain('직접 적어 주세요')
    }
  })

  it('★ 서버 자리표시자 「(OCR 분석)」은 자동채움하지 않는다 (ocrRoutes.js:632 · :433)', () => {
    // 그대로 채우면 사용자가 눌러 보내고 DB 에 「(OCR 분석)」이라는 제품이 생긴다.
    const s = seedProductName('(OCR 분석)')
    expect(s.value).toBe('')
    expect(s.found).toBe(false)
  })

  it('자동채움 값도 공백 정리를 거친다', () => {
    expect(seedProductName('  농심  신라면 ').value).toBe('농심 신라면')
  })
})

describe('★ ②③ canSubmitReport — 보낼 수 없으면 «이유»와 함께 막는다', () => {
  const base = { analysisToken: 'tok', productName: '신라면', busy: false }

  it('토큰과 이름이 다 있으면 보낼 수 있다', () => {
    expect(canSubmitReport(base)).toEqual({ ok: true, reason: null })
  })

  it('제품명이 비면 막고 이유를 말한다 — 사용자를 서버 400 까지 보내지 않는다', () => {
    const g = canSubmitReport({ ...base, productName: '   ' })
    expect(g.ok).toBe(false)
    expect(g.reason).toBe(PRODUCT_NAME_REQUIRED)
  })

  it('★ 토큰이 없으면 막는다 — 사진을 다시 골라 토큰을 버린 직후가 이 상태다', () => {
    const g = canSubmitReport({ ...base, analysisToken: null })
    expect(g.ok).toBe(false)
    expect(g.reason).toBe(NO_TOKEN_MESSAGE)
  })

  it('토큰이 없으면 «이름이 있어도» 막는다 (이름만 보고 통과시키지 않는다)', () => {
    expect(canSubmitReport({ analysisToken: null, productName: '신라면', busy: false }).ok).toBe(false)
  })

  it('전송 중이면 막되 이유는 띄우지 않는다 (버튼 문구가 이미 「보내는 중…」이다)', () => {
    expect(canSubmitReport({ ...base, busy: true })).toEqual({ ok: false, reason: null })
  })
})

describe('★ ④ classifyConfirmFailure — 400 과 410 은 사용자 행동이 다르다', () => {
  it('400 — 서버가 준 한국어 사유를 «그대로» 쓴다 (우리가 다시 쓰지 않는다)', () => {
    const f = classifyConfirmFailure(400, '제품명이 필요합니다.')
    expect(f.kind).toBe('rejected')
    expect(f.message).toBe('제품명이 필요합니다.')
    expect(f.backToAnalyze).toBe(false)   // 사진·토큰은 그대로. 입력만 고치면 된다.
  })

  it('400 인데 서버가 말이 없으면 우리 문구로 대신한다 (빈 오류를 띄우지 않는다)', () => {
    expect(classifyConfirmFailure(400, null).message).toBe(PRODUCT_NAME_REQUIRED)
    expect(classifyConfirmFailure(400, '   ').message).toBe(PRODUCT_NAME_REQUIRED)
  })

  it('★ 410 — 토큰 만료. 1단계로 되돌리고 «다음 행동»을 말한다', () => {
    const f = classifyConfirmFailure(410, '분석 토큰이 만료되었습니다.')
    expect(f.kind).toBe('expired')
    expect(f.backToAnalyze).toBe(true)
    // 서버 문구는 「만료됐다」까지만 말한다. 사용자는 뭘 해야 할지 모른다.
    expect(f.message).toBe(TOKEN_EXPIRED_MESSAGE)
    expect(f.message).toContain('읽어보기')
  })

  it('그 밖의 상태는 성공처럼 말하지 않는다', () => {
    expect(classifyConfirmFailure(500, null)).toEqual({
      kind: 'other', message: CONFIRM_FALLBACK_MESSAGE, backToAnalyze: false,
    })
    expect(classifyConfirmFailure(503, '서버 점검 중입니다.').message).toBe('서버 점검 중입니다.')
  })
})

describe('describeReadback — 0 을 숨기지 않는다', () => {
  it('세 개수를 모두 적는다', () => {
    expect(describeReadback({ ingredientCount: 12, nutritionCount: 8, additiveCount: 3 }))
      .toBe('원재료 12개 · 영양성분 8개 · 첨가물 3개')
  })
  it('★ 0 인 항목도 «적는다» — 숨기면 「못 읽었다」가 「없다」로 읽힌다', () => {
    expect(describeReadback({ ingredientCount: 0, nutritionCount: 0, additiveCount: 0 }))
      .toBe('원재료 0개 · 영양성분 0개 · 첨가물 0개')
  })
  it('값이 없거나 이상해도 0 으로 적고 던지지 않는다', () => {
    expect(describeReadback(null)).toBe('원재료 0개 · 영양성분 0개 · 첨가물 0개')
    expect(describeReadback({ ingredientCount: NaN, nutritionCount: -3 }))
      .toBe('원재료 0개 · 영양성분 0개 · 첨가물 0개')
  })
})


/**
 * ★★★★ 2026-08-23 세션64 외부검토 §B — **이미 등록된 제품**에 정보를 보탤 때의 자동채움.
 *
 *   제보 경로가 「DB 에 없는 바코드」 밖으로 넓어지면서 제품명이 «이미 있는» 경우가 생겼다.
 *   그때 입력란을 비워 두고 「직접 적어 주세요」를 띄우면 사용자에게 **없는 일을 시키는 것**이다.
 */
describe('★ seedProductNameForExisting — 등록된 이름이 OCR 값보다 «우선»한다', () => {
  it('★★ 등록된 이름이 있으면 그것으로 채우고, 왜 들어 있는지 말한다', () => {
    const s = seedProductNameForExisting('신라면 봉지면', '신 라 면')
    expect(s.value).toBe('신라면 봉지면')
    expect(s.found).toBe(true)
    expect(s.notice).toBe(REGISTERED_NAME_NOTICE)
    // 「고쳐 주세요」가 없으면 사용자는 이것이 «수정 가능»한 줄 모른다.
    expect(s.notice).toContain('고쳐')
  })

  /**
   * 근거: `crowdsourceService.js` 의 기존 제품 UPDATE 는
   *   `product_name = COALESCE(NULLIF(product_name,''), $2, product_name)` 라
   *   **기존 이름이 있으면 덮어쓰지 않는다.** OCR 값을 채워 놓고 그것이 저장될 것처럼
   *   보이게 하면 화면과 DB 가 또 어긋난다(세션64 「정제수」 사고와 같은 축).
   */
  it('★★ OCR 값이 있어도 등록된 이름을 이긴다 (서버가 덮어쓰지 않으므로)', () => {
    expect(seedProductNameForExisting('짜파게티', '정제수').value).toBe('짜파게티')
  })

  it('등록된 이름이 없으면 종전 OCR 자동채움 그대로다', () => {
    expect(seedProductNameForExisting(null, '신라면')).toEqual(seedProductName('신라면'))
    expect(seedProductNameForExisting('', null)).toEqual(seedProductName(null))
    expect(seedProductNameForExisting('   ', null).notice).toBe(OCR_NAME_MISSING_NOTICE)
  })

  it('★ 서버 자리표시자가 «등록된 이름»으로 와도 채우지 않는다', () => {
    // 「(OCR 분석)」이 이미 DB 에 박힌 제품이 있을 수 있다. 그걸 그대로 되보내면 오염이 굳는다.
    const s = seedProductNameForExisting('(OCR 분석)', null)
    expect(s.value).toBe('')
    expect(s.found).toBe(false)
    expect(s.notice).toBe(OCR_NAME_MISSING_NOTICE)
  })

  it('공백만 정리한다 — 사용자가 볼 이름의 글자를 고치지 않는다', () => {
    expect(seedProductNameForExisting('  신라면   봉지면  ', null).value).toBe('신라면 봉지면')
  })

  it('★ 프리필된 이름도 게이트를 통과한다 (프리필해 놓고 못 보내면 안 된다)', () => {
    const s = seedProductNameForExisting('신라면', null)
    expect(canSubmitReport({ analysisToken: 'tok', productName: s.value, busy: false }).ok).toBe(true)
  })

  it('★★ 프리필된 이름을 사용자가 «지우면» 다시 막힌다 (제이 결정 ② 는 그대로다)', () => {
    const g = canSubmitReport({ analysisToken: 'tok', productName: '', busy: false })
    expect(g.ok).toBe(false)
    expect(g.reason).toBe(PRODUCT_NAME_REQUIRED)
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * classifyPhotoReportOutcome — 세션64b 「부분 저장」
 *
 * 서버가 저장 정책을 「통째로 저장 / 통째로 반려」에서 **「부분 저장」**으로 바꿨다.
 * 영양 실패 6종은 제보 전체를 반려하지 않고 영양만 버린다
 * (`meokseon-server/tests/test_nutrition_partial_save.js` §1·§2·§7 이 정본).
 *
 * 이 절이 지키는 것은 둘뿐이다.
 *   ① 「저장됐다」와 「영양은 못 읽었다」를 **동시에** 말한다 — 하나만 말하면 거짓이다
 *   ② **모르는 사유 코드가 와도 침묵하지 않는다** — 이 저장소에서 «조용한 소실»이 최악이다
 * ══════════════════════════════════════════════════════════════════════════ */

/** 서버가 실제로 내는 모양. 기본은 「전부 저장」. */
function outcome(over: Partial<PhotoReportOutcomeInput> = {}) {
  return classifyPhotoReportOutcome({
    saved: true,
    rejectReason: null,
    nutritionStatus: 'ok',
    nutritionRejectCode: null,
    target: 'new',
    ...over,
  })
}

const ALL_CODES: NutritionRejectCode[] = [
  'NO_NUTRIENTS', 'BASIS_UNKNOWN', 'PER_TOTAL_UNRESOLVED',
  'SANITY_OUTLIER', 'MASS_BALANCE', 'PUBLIC_DATA_PROTECTED',
]

describe('classifyPhotoReportOutcome — ① 전부 저장', () => {
  it('nutrition_status:"ok" 면 기존 감사 문구 그대로다 (과하게 겁주지 않는다)', () => {
    const o = outcome()
    expect(o.kind).toBe('saved')
    expect(o.headline).toBe(REPORT_SAVED_NEW)
    expect(o.nutritionNote).toBeNull()
    expect(o.retakeable).toBe(false)
    expect(o.nutritionCode).toBe('OK')
  })

  it('등록된 제품이면 문구가 갈린다 (「등록되면 알려드릴게요」는 새 제품 말이다)', () => {
    expect(outcome({ target: 'existing' }).headline).toBe(REPORT_SAVED_EXISTING)
  })
})

describe('★★★ classifyPhotoReportOutcome — ② 부분 저장 (사유 6종 각각)', () => {
  it.each(ALL_CODES)('%s — 「저장됐다」와 「영양은 못 읽었다」를 «동시에» 말한다', (code) => {
    const o = outcome({ nutritionStatus: 'incomplete', nutritionRejectCode: code })

    expect(o.kind).toBe('partial')
    // ★ 저장은 됐다고 말한다 — 「반려됐다」로 읽히면 사용자가 원재료까지 다시 보낸다.
    expect(o.headline).toBe(REPORT_PARTIAL_SAVED_NEW)
    expect(o.headline).toContain('저장')
    // ★★★ 불변식 — partial 이면 영양 안내가 **절대 null 이 아니다.**
    //   이 단정이 없으면 사유 하나를 map 에서 빠뜨렸을 때 화면이 조용히 침묵한다.
    expect(o.nutritionNote).toBeTruthy()
    expect(o.nutritionNote).toContain('영양')
    expect(o.nutritionCode).toBe(code)
  })

  it.each(ALL_CODES)('%s — 사유마다 «다른» 문구다 (한 문구로 뭉뚱그리지 않았다)', (code) => {
    const mine = outcome({ nutritionStatus: 'incomplete', nutritionRejectCode: code }).nutritionNote
    const others = ALL_CODES.filter((c) => c !== code)
      .map((c) => outcome({ nutritionStatus: 'incomplete', nutritionRejectCode: c }).nutritionNote)
    expect(others).not.toContain(mine)
  })

  it('등록된 제품 경로도 부분 저장을 말한다 (문구만 갈리고 판정은 같다)', () => {
    const o = outcome({ target: 'existing', nutritionStatus: 'incomplete', nutritionRejectCode: 'NO_NUTRIENTS' })
    expect(o.headline).toBe(REPORT_PARTIAL_SAVED_EXISTING)
    expect(o.nutritionNote).toBeTruthy()
  })
})

describe('★★ classifyPhotoReportOutcome — 「할 수 있는 일」과 「없는 일」을 가른다', () => {
  it.each(['NO_NUTRIENTS', 'BASIS_UNKNOWN', 'PER_TOTAL_UNRESOLVED', 'SANITY_OUTLIER', 'MASS_BALANCE'] as const)(
    '%s — 다시 찍으면 풀린다. 재촬영 길을 «준다»',
    (code) => {
      const o = outcome({ nutritionStatus: 'incomplete', nutritionRejectCode: code })
      expect(o.retakeable).toBe(true)
      expect(o.nutritionNote).toMatch(/찍/)
    },
  )

  /**
   * ★ 유일하게 사용자가 할 일이 «없는» 사유다.
   *   서버는 이미 공공데이터 영양을 갖고 있어서 OCR 값을 안 쓴다 —
   *   다시 찍어도 결과가 같다. 여기서 재촬영을 권하면 Vision 호출만 두 배가 되고
   *   사용자는 자기가 뭘 잘못한 줄 안다.
   */
  it('★ PUBLIC_DATA_PROTECTED — 다시 찍어도 소용없다. 재촬영을 권하지 «않는다»', () => {
    const o = outcome({ nutritionStatus: 'incomplete', nutritionRejectCode: 'PUBLIC_DATA_PROTECTED' })
    expect(o.retakeable).toBe(false)
    expect(o.nutritionNote).toContain('다시 찍지 않으셔도')
    // 그래도 «영양이 이번 사진에서 반영되지 않았다»는 사실은 말한다.
    expect(o.nutritionNote).toContain('영양정보')
  })
})

describe('★★★★ classifyPhotoReportOutcome — 모르는 사유 코드에도 침묵하지 않는다', () => {
  /**
   * 서버는 사유 코드를 «늘린다». 늘어난 코드를 앱이 모른다고 화면이 조용해지면
   * 사용자는 영양이 저장된 줄 안다 — 「모름」이 「저장됨」으로 바뀌는, 이 저장소가
   * 가장 경계하는 실패다(`allergens.ts:15`).
   */
  it('★ 앱이 모르는 코드여도 「영양정보는 확인하지 못했어요」를 말한다', () => {
    const o = outcome({ nutritionStatus: 'incomplete', nutritionRejectCode: 'SOME_FUTURE_CODE' })
    expect(o.kind).toBe('partial')
    expect(o.nutritionNote).toBe(NUTRITION_UNKNOWN_NOTICE)
    expect(o.nutritionNote).toContain('영양정보는 확인하지 못해')
    // 계측이 「서버가 코드를 늘렸다」를 알아볼 수 있어야 한다.
    expect(o.nutritionCode).toBe('UNKNOWN')
  })

  it('★ 코드가 아예 «없어도» 말한다 (incomplete 인데 사유가 안 실려 온 경우)', () => {
    const o = outcome({ nutritionStatus: 'incomplete', nutritionRejectCode: null })
    expect(o.kind).toBe('partial')
    expect(o.nutritionNote).toBe(NUTRITION_UNKNOWN_NOTICE)
    expect(o.nutritionCode).toBe('UNKNOWN')
  })

  it('★ 빈 문자열 코드도 「모름」이다 («코드가 있다»로 승격시키지 않는다)', () => {
    const o = outcome({ nutritionStatus: 'incomplete', nutritionRejectCode: '   ' })
    expect(o.nutritionCode).toBe('UNKNOWN')
    expect(o.nutritionNote).toBe(NUTRITION_UNKNOWN_NOTICE)
  })

  /**
   * ★★ 모르는 «status» 는 ok 가 아니다 (Render Conservative).
   *   서버가 나중에 'partial' 같은 값을 내면, 그것을 「저장됨」으로 읽는 순간
   *   「모름」이 「앎」이 된다. 반대 방향으로 틀리는 편이 안전하다.
   */
  it('★★ 모르는 status 를 「ok」로 읽지 않는다', () => {
    const o = outcome({ nutritionStatus: 'someday_new_status', nutritionRejectCode: null })
    expect(o.kind).toBe('partial')
    expect(o.nutritionNote).toBeTruthy()
  })
})

describe('classifyPhotoReportOutcome — ③ 전부 반려', () => {
  it('서버 사유를 «그대로» 보여준다 (우리 말로 덮지 않는다)', () => {
    const o = outcome({
      saved: false,
      rejectReason: '같은 기기에서 24시간 내에 이미 이 제품의 데이터를 제출하셨습니다.',
      nutritionStatus: null,
    })
    expect(o.kind).toBe('rejected')
    expect(o.headline).toBe('같은 기기에서 24시간 내에 이미 이 제품의 데이터를 제출하셨습니다.')
    expect(o.retakeable).toBe(false)
  })

  it('사유를 안 주면 «지어내지» 않되 성공처럼 말하지도 않는다', () => {
    const o = outcome({ saved: false, rejectReason: null, nutritionStatus: null })
    expect(o.headline).toBe(REPORT_REJECT_FALLBACK)
    expect(o.headline).not.toContain('감사')
  })

  /**
   * ★★ 반려인데 영양 필드가 실려 오는 경우 — 아무것도 저장되지 않았다.
   *   여기서 「원재료·알레르기는 저장했어요」를 띄우면 그것이 곧 거짓말이다.
   *   (서버의 제품명·신뢰도 게이트는 영양 판정 «앞»에서 return 하므로 실제로는 안 실리지만,
   *    순서가 바뀌어도 화면이 거짓말하지 않도록 여기서 못 박는다.)
   */
  it('★★ 반려면 영양 필드가 있어도 「저장했어요」라고 말하지 않는다', () => {
    const o = outcome({
      saved: false,
      rejectReason: '제품명을 입력해 주세요. 제품명 없이는 등록할 수 없어요.',
      nutritionStatus: 'incomplete',
      nutritionRejectCode: 'NO_NUTRIENTS',
    })
    expect(o.kind).toBe('rejected')
    expect(o.headline).not.toContain('저장했어요')
    expect(o.nutritionNote).toBeNull()
  })
})

describe('★ classifyPhotoReportOutcome — 하위 호환 (구버전 서버)', () => {
  /**
   * 필드가 아예 없는 응답 = 아직 안 올라간 서버, 또는 다른 저장 경로(`/analyze`·`/multi-photo`).
   * 「말이 없었다」를 「영양도 저장됐다」로 승격시키지 않되, **종전 화면 그대로** 둔다.
   * (여기서 「확인 못 했을 수도 있어요」를 띄우면 멀쩡한 건에도 매번 뜬다 = 소음 → 무시 학습.)
   */
  it('nutrition_status 가 없으면 종전 감사 문구 그대로다', () => {
    const o = outcome({ nutritionStatus: null, nutritionRejectCode: null })
    expect(o.kind).toBe('saved')
    expect(o.headline).toBe(REPORT_SAVED_NEW)
    expect(o.nutritionNote).toBeNull()
  })

  it('★ 그때는 계측 코드도 «null» 이다 — 「ok 였다」로 기록하지 않는다', () => {
    expect(outcome({ nutritionStatus: null }).nutritionCode).toBeNull()
  })

  it('빈 문자열 status 도 「말이 없었다」로 본다', () => {
    expect(outcome({ nutritionStatus: '  ' }).kind).toBe('saved')
    expect(outcome({ nutritionStatus: '  ' }).nutritionCode).toBeNull()
  })
})

describe('★ classifyPhotoReportOutcome — 화면이 아무 말도 안 하는 상태를 만들지 않는다', () => {
  it('어떤 입력에도 headline 은 비지 않는다', () => {
    const inputs: PhotoReportOutcomeInput[] = [
      { saved: true, rejectReason: null, nutritionStatus: 'ok', nutritionRejectCode: null, target: 'new' },
      { saved: true, rejectReason: null, nutritionStatus: 'incomplete', nutritionRejectCode: 'MASS_BALANCE', target: 'existing' },
      { saved: true, rejectReason: null, nutritionStatus: 'xxx', nutritionRejectCode: 'yyy', target: 'new' },
      { saved: false, rejectReason: null, nutritionStatus: null, nutritionRejectCode: null, target: 'existing' },
      { saved: false, rejectReason: '  ', nutritionStatus: null, nutritionRejectCode: null, target: 'new' },
    ]
    for (const i of inputs) expect(classifyPhotoReportOutcome(i).headline.trim().length).toBeGreaterThan(0)
  })

  /** ⚠ 사용자 화면에 영양소 «개수»가 새어 나가면 안 된다(외부 검토 결론). */
  it('★ 어떤 문구에도 「영양성분 N개」 같은 개수가 없다', () => {
    for (const code of [...ALL_CODES, 'UNKNOWN_CODE']) {
      const o = outcome({ nutritionStatus: 'incomplete', nutritionRejectCode: code })
      expect(o.nutritionNote).not.toMatch(/\d+\s*개/)
      expect(o.headline).not.toMatch(/\d+\s*개/)
    }
  })
})
