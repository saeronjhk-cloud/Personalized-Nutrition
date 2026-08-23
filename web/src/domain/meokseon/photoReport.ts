/**
 * 사진 제보 2단계 흐름(읽어보기 → 보내기) 판정 — 순수 함수(렌더 비의존, 테스트 대상).
 *
 * ★ 왜 생겼나 (2026-08-21, 세션64)
 *   제보 사진은 ①원재료·알레르기 표기 ②영양성분표 두 장이다. **제품명이 없는 경우가 많다.**
 *   실물 라벨 67건 실측:
 *     · 라벨에 「제품명/상품명」이 인쇄돼 있음   40/67 (59.7%)
 *     · OCR 이 뽑은 값 중 쓸 수 있는 것          33/67 (49.3%)
 *   세션40 기록상 **제품명이 아예 인쇄되지 않은 제품이 실재**한다(`037_칙촉`·`034`).
 *   ⇒ OCR 을 아무리 손봐도 원천적으로 메울 수 없는 갭이다.
 *
 *   그런데 앱에는 제품명 입력란이 «아예 없었고» `product_info` 를 보내지도 않았다.
 *   그래서 서버가 이름을 모르면 **첫 원재료명(「정제수」 등)이 제품명으로 저장**됐다.
 *   화면은 「제품명 미인식」이라고 정직하게 말하는데 DB 에는 「정제수」가 들어갔다.
 *   **화면과 DB 가 어긋나 있었다.**
 *
 * ★★ 제이 결정 (확정 · 바꾸지 말 것)
 *   ① 제품명은 **사용자 텍스트 입력**으로 받는다. OCR 값은 «자동채움»일 뿐이다.
 *   ② 제품명이 없으면 **저장을 거부**한다.
 *
 *   ⇒ 이 파일이 지키는 것은 「예쁘게 채워 주기」가 아니라 **「모르는 이름을 지어내지 않기」** 다.
 *     - OCR 이 못 읽었으면 입력란을 **비워 두고 왜 비었는지 말한다.**
 *       「미인식」이라고만 쓰고 끝내면 사용자는 할 일이 있다는 걸 모른다 — 지금의 실패 지점이다.
 *     - 정본은 «언제나» 입력란의 값이다. 사용자가 OCR 값을 고쳤는지 여부와 무관하다.
 *     - 보낼 수 없으면 버튼을 막고 **이유를 한 줄로** 말한다. 서버 400 까지 가게 두지 않는다.
 *
 * 서버 계약 (서버 담당 에이전트와 동일 확정 · 2026-08-21)
 *   1단계  POST /api/ocr/multi-photo  FormData, `save='false'`
 *          → `data.analysis_token` (문자열, TTL 10분)
 *          → `data.analysis.product_meta.product_name` 이 있으면 입력란 자동채움
 *   2단계  POST /api/ocr/confirm  JSON `{ analysis_token, product_info: { product_name, … } }`
 *          → 성공 응답은 기존 `save_result` 와 같은 모양
 *          → 400 = 제품명 누락 등(서버 한국어 사유를 «그대로» 보여준다)
 *          → 410 = 토큰 만료(1단계로 복귀)
 *   ⚠ 2026-08-21 기준 서버에 `/confirm` · `analysis_token` 은 **아직 없다**(구현 중).
 *     이 파일과 `lib/meokseon.ts` 의 테스트는 전부 목(mock) 기반이다.
 *
 * 참고 선례: 같은 폴더 `allergens.ts` · `additives.ts`. 판정은 여기, 그리기는 컴포넌트.
 */

/* ──────────────────────────────────────────────────────────────────────────
 * 1. 사용자에게 보이는 문구 — 정본은 여기 «한 곳»이다.
 *    화면(`Scan.tsx`)에 다시 적지 말 것. 두 곳에 두면 갈라진다(additives.ts 와 같은 규칙).
 * ────────────────────────────────────────────────────────────────────────── */

/** 제품명이 비었을 때. 「필수」라고만 하지 않고 «무엇을 하면 되는지»를 말한다. */
export const PRODUCT_NAME_REQUIRED = '제품명을 적어야 보낼 수 있어요.'

/** OCR 이 제품명을 읽었을 때. 자동채움은 «제안»이지 확정이 아니다. */
export const OCR_NAME_FOUND_NOTICE = '사진에서 읽은 제품명이에요. 다르면 고쳐 주세요.'

/**
 * OCR 이 제품명을 못 읽었을 때.
 * ⚠ 「제품명 미인식」으로 끝내지 말 것 — 사용자는 그게 «자기가 할 일»인 줄 모른다.
 *   실측상 라벨의 40.3% 는 제품명이 인쇄돼 있지도 않아, 이 경로가 예외가 아니라 상시 경로다.
 */
export const OCR_NAME_MISSING_NOTICE = '사진에서 제품명을 찾지 못했어요. 직접 적어 주세요.'

/** 410 — 토큰 만료. 사진은 그대로 두고 「읽어보기」만 다시 누르면 된다. */
export const TOKEN_EXPIRED_MESSAGE = '읽어본 결과가 10분이 지나 만료됐어요. 「읽어보기」를 다시 눌러 주세요.'

/** 토큰이 아예 없을 때(서버가 안 줬거나 폐기됨). 저장을 «조용히» 하지 않고 막는다. */
export const NO_TOKEN_MESSAGE = '읽어본 결과를 확정할 수 없어요. 「읽어보기」를 다시 눌러 주세요.'

/** 사유를 알 수 없는 실패. ⚠ 성공처럼 말하지 않는다(2026-08-06 거짓 확인 사고). */
export const CONFIRM_FALLBACK_MESSAGE = '보내지 못했어요. 잠시 후 다시 시도해 주세요.'

/**
 * 서버가 「제품명을 모를 때」 저장에 쓰던 자리표시자(`ocrRoutes.js:632`·`:433`).
 * OCR 결과에 이 값이 섞여 오면 **자동채움하면 안 된다** — 사용자가 그대로 보내면
 * DB 에 「(OCR 분석)」이라는 제품이 생긴다. 「정제수」 사고와 같은 축이다.
 */
const PLACEHOLDER_NAMES = ['(OCR 분석)', 'OCR 분석', '(ocr 분석)']

/* ──────────────────────────────────────────────────────────────────────────
 * 2. 제품명 정규화·검증
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * 공백 정리만 한다. **글자를 고치거나 버리지 않는다.**
 * (전각/약물 정규화 같은 건 하지 않는다 — 사용자가 적은 이름을 우리가 바꾸면 안 된다.)
 */
export function normalizeProductName(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.replace(/\s+/g, ' ').trim()
}

export interface ProductNameCheck {
  /** 이 값이 false 면 «보내지 않는다». 서버 400 은 최후의 방어선이지 1차 방어선이 아니다. */
  ok: boolean
  /** 서버로 보낼 정본. 항상 정규화된 값이다. */
  value: string
  /** 못 보내는 이유(사용자 문구). ok 면 null. */
  reason: string | null
}

/** 제품명 하나만 본다. 「비어 있으면 거부」 — 제이 결정 ②. */
export function checkProductName(raw: unknown): ProductNameCheck {
  const value = normalizeProductName(raw)
  if (!value) return { ok: false, value, reason: PRODUCT_NAME_REQUIRED }
  return { ok: true, value, reason: null }
}

export interface ProductNameSeed {
  /** 입력란 «초기값». 쓸 수 있는 OCR 값이 없으면 빈 문자열이다(추측으로 채우지 않는다). */
  value: string
  /** OCR 이 쓸 만한 이름을 줬는가. 화면 안내 문구가 갈린다. */
  found: boolean
  /** 입력란 아래에 띄울 안내 한 줄. found 여부와 «항상» 함께 온다. */
  notice: string
}

/**
 * OCR 값 → 입력란 초기값.
 *
 * ⚠ 여기서 「이 값이 진짜 제품명일까」를 추측하지 «않는다». 원재료명(「정제수」)처럼 보이는
 *   값을 걸러내는 휴리스틱을 넣고 싶겠지만, 그건 판정 기준이 없는 채로 사용자 입력을
 *   말없이 지우는 짓이다. 자동채움은 «제안»이고, 안내문이 「다르면 고쳐 주세요」라고 말한다.
 *   거르는 것은 서버가 스스로 만든 자리표시자 하나뿐이다(위 PLACEHOLDER_NAMES 주석 참조).
 */
export function seedProductName(ocrName: unknown): ProductNameSeed {
  const value = normalizeProductName(ocrName)
  const usable = !!value && !PLACEHOLDER_NAMES.includes(value)
  return usable
    ? { value, found: true, notice: OCR_NAME_FOUND_NOTICE }
    : { value: '', found: false, notice: OCR_NAME_MISSING_NOTICE }
}

/**
 * 이미 등록된 제품의 이름. 자동채움 «제안»이지 확정이 아니다.
 * ⚠ 여기서도 「필수」로만 말하지 않는다 — 왜 이 값이 들어 있는지 말해야 사용자가 고칠 생각을 한다.
 */
export const REGISTERED_NAME_NOTICE = '이미 등록된 제품명이에요. 다르면 고쳐 주세요.'

/**
 * ★★ 2026-08-23 세션64 외부검토 §B — **이미 등록된 제품**에 정보를 보탤 때의 제품명 자동채움.
 *
 *   제보 경로가 「DB 에 없는 바코드」 밖으로 넓어지면서, 제품명이 «이미 있는» 경우가 생겼다.
 *   그 경우 입력란을 비워 두고 「직접 적어 주세요」를 띄우면 **사용자에게 없는 일을 시키는 것**이다.
 *
 * ★ 등록된 이름이 OCR 값보다 «우선»한다. 두 가지 이유다.
 *   ① 서버가 그렇게 동작한다 — `crowdsourceService.js` 의 기존 제품 UPDATE 는
 *      `product_name = COALESCE(NULLIF(product_name,''), $2, product_name)` 라
 *      **기존 이름이 있으면 덮어쓰지 않는다.** OCR 값을 채워 놓고 「이 이름으로 저장됩니다」처럼
 *      보이게 하면 화면과 DB 가 또 어긋난다(세션64 「정제수」 사고와 같은 축).
 *   ② 등록된 이름은 이미 사람이 확정했거나 공공데이터에서 온 값이다. OCR 추정보다 낫다.
 *
 * ⚠ 그래도 **입력을 막지 않는다.** 잘못 등록된 이름을 사용자가 고쳐 보낼 수 있어야 한다
 *   (그 값은 `contributions.user_input.product_name` 으로 남아 사람 검토에 쓰인다).
 */
export function seedProductNameForExisting(registeredName: unknown, ocrName: unknown): ProductNameSeed {
  const registered = normalizeProductName(registeredName)
  if (registered && !PLACEHOLDER_NAMES.includes(registered)) {
    return { value: registered, found: true, notice: REGISTERED_NAME_NOTICE }
  }
  return seedProductName(ocrName)
}

/* ──────────────────────────────────────────────────────────────────────────
 * 3. 전송 게이트 — 「보내기」를 누를 수 있는가
 * ────────────────────────────────────────────────────────────────────────── */

export interface SubmitGateInput {
  /** 1단계에서 받은 토큰. 사진을 다시 고르면 «반드시» null 이 돼야 한다(낡은 토큰 = 다른 제품). */
  analysisToken: string | null
  /** 입력란의 현재 값. 이것이 정본이다. */
  productName: string
  /** 전송 중인가. 중복 전송 방지. */
  busy: boolean
}

export interface SubmitGate {
  ok: boolean
  /** 못 보내는 «사용자 문구». 전송 중일 때는 이유를 띄우지 않는다(소음). */
  reason: string | null
}

/**
 * 왜 못 보내는지를 «누르기 전에» 말한다.
 * 버튼만 disabled 로 두고 이유를 안 쓰면 사용자는 앱이 고장 난 줄 안다.
 */
export function canSubmitReport(input: SubmitGateInput): SubmitGate {
  if (input.busy) return { ok: false, reason: null }
  if (!input.analysisToken) return { ok: false, reason: NO_TOKEN_MESSAGE }
  const name = checkProductName(input.productName)
  if (!name.ok) return { ok: false, reason: name.reason }
  return { ok: true, reason: null }
}

/* ──────────────────────────────────────────────────────────────────────────
 * 4. 확정 실패 분류
 * ────────────────────────────────────────────────────────────────────────── */

export type ConfirmFailureKind = 'rejected' | 'expired' | 'other'

export interface ConfirmFailure {
  kind: ConfirmFailureKind
  /** 사용자에게 그대로 보여줄 문구. */
  message: string
  /** true 면 토큰을 버리고 1단계(읽어보기)로 되돌린다. 사진은 유지한다. */
  backToAnalyze: boolean
}

/**
 * HTTP 상태 → 사용자 행동.
 *
 *   400  서버가 사유를 «한국어로» 준다. 우리가 다시 쓰지 않고 **그대로** 보여준다.
 *        (제품명 외의 거부 사유가 생겨도 문구가 자동으로 따라온다.)
 *   410  토큰 만료. 이건 «내용»이 아니라 «시간»의 문제라 서버 문구를 그대로 쓰면
 *        사용자가 뭘 해야 할지 모른다. 우리 문구로 다음 행동을 말한다.
 *   그 외 사유 미상. 성공처럼 말하지 않는다.
 */
export function classifyConfirmFailure(status: number, serverMessage?: unknown): ConfirmFailure {
  const msg = typeof serverMessage === 'string' ? serverMessage.trim() : ''
  if (status === 410) return { kind: 'expired', message: TOKEN_EXPIRED_MESSAGE, backToAnalyze: true }
  if (status === 400) return { kind: 'rejected', message: msg || PRODUCT_NAME_REQUIRED, backToAnalyze: false }
  return { kind: 'other', message: msg || CONFIRM_FALLBACK_MESSAGE, backToAnalyze: false }
}

/* ──────────────────────────────────────────────────────────────────────────
 * 5. 읽어낸 내용 요약 — 사용자가 「보내기」 전에 확인하는 줄
 * ────────────────────────────────────────────────────────────────────────── */

export interface ReadbackCounts {
  ingredientCount: number
  nutritionCount: number
  additiveCount: number
}

/**
 * 「원재료 12개 · 영양성분 8개 · 첨가물 3개」.
 * ⚠ 0 인 항목을 «숨기지 않는다». 숨기면 「못 읽었다」가 「없다」로 읽힌다
 *   (`allergens.ts:15` 와 같은 원칙 — 침묵은 안전으로 읽힌다).
 */
export function describeReadback(c: Partial<ReadbackCounts> | null | undefined): string {
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0)
  return `원재료 ${n(c?.ingredientCount)}개 · 영양성분 ${n(c?.nutritionCount)}개 · 첨가물 ${n(c?.additiveCount)}개`
}

/* ──────────────────────────────────────────────────────────────────────────
 * 6. 보낸 «뒤» — 저장 결과 판정 (세션64b · 서버 「부분 저장」계약)
 *
 * ★★ 왜 생겼나 (2026-08-23)
 *   서버가 저장 정책을 「통째로 저장 / 통째로 반려」에서 **「부분 저장」**으로 바꿨다.
 *   영양 관련 실패 6종은 제보 전체를 반려하지 않고 **영양만 버리고** 제품·원재료·
 *   알레르기 원증거는 저장한다(`crowdsourceService.js` · `tests/test_nutrition_partial_save.js`).
 *
 *   그래서 `saved === true` 만 보고 「제보 감사합니다!」를 띄우면 화면이 **거짓말**을 한다.
 *   사용자는 영양성분표까지 찍어 보냈는데 그게 저장되지 않은 것을 모른 채 떠나고,
 *   다시 찍으면 해결될 일을 영영 못 고친다. 2026-08-06 「거짓 확인」 사고와 같은 축이다.
 *
 * ★★★ 이 절이 지키는 것 — 딱 둘이다.
 *   ① 「저장됐다」와 「영양은 못 읽었다」를 **한 화면에서 «동시에»** 말한다.
 *      둘 중 하나만 말하면 거짓이다. 그래서 `headline` 과 `nutritionNote` 를 갈라 두고,
 *      `kind==='partial'` 이면 `nutritionNote` 가 **절대 null 이 될 수 없게** 만들었다.
 *   ② **모르는 사유 코드가 와도 침묵하지 않는다.** 서버가 코드를 늘려도(늘린다) 앱은
 *      일반 문구로라도 「영양정보는 확인하지 못했어요」를 말한다.
 *      이 저장소에서 «조용한 소실»이 가장 위험한 오류다(`allergens.ts:15`).
 *
 * ⚠ **서버 사유 문자열(`nutrition_reject_reason`)을 화면에 그대로 쓰지 «않는다».**
 *   `classifyConfirmFailure(400)` 은 서버 문구를 그대로 쓰는데 여기는 왜 다른가 —
 *   서버의 이 6개 문자열은 **사용자용 문구가 아니다.**
 *     · SANITY_OUTLIER  →  `영양정보 이상치가 감지되었습니다: sodium(99999), calories(-3)`
 *                          (`criticalWarnings.map(...)` 로 조립한 진단 문자열이다)
 *     · MASS_BALANCE    →  `massBalanceWarning.message` — 내부 경고 객체의 메시지를 그대로 흘린다
 *     · PUBLIC_DATA_PROTECTED → 「이미 공공데이터 기반 영양정보가 등록되어 있습니다」
 *                          = 사용자가 «할 일이 없는» 사유인데, 다른 5개와 같은 톤으로 나가면
 *                            사용자는 자기가 뭔가 잘못한 줄 알고 다시 찍는다(Vision 낭비).
 *   ⇒ 코드별 문구는 **앱이 만든다.** 그래야 「다시 찍으면 되는 것」과 「할 일이 없는 것」을
 *     가를 수 있고, 그 판정은 문구와 «같은 곳»에 있어야 갈라지지 않는다.
 *   ⇒ 대신 **모르는 코드**는 앱이 문구를 만들 수 없으므로 일반 문구로 덮는다(위 ②).
 * ────────────────────────────────────────────────────────────────────────── */

/** 서버가 지금 내는 영양 실패 사유 6종. ⚠ **닫힌 집합이 아니다** — 모르는 코드가 올 수 있다. */
export type NutritionRejectCode =
  | 'NO_NUTRIENTS'
  | 'BASIS_UNKNOWN'
  | 'PER_TOTAL_UNRESOLVED'
  | 'SANITY_OUTLIER'
  | 'MASS_BALANCE'
  | 'PUBLIC_DATA_PROTECTED'

/* ── 저장됐다는 말 (기존 문구를 그대로 옮겨 왔다 — 여기가 정본이다) ── */
export const REPORT_SAVED_NEW = '제보 감사합니다! 검토 후 등록되면 알려드릴게요.'
export const REPORT_SAVED_EXISTING = '보내주셔서 감사합니다! 검토 후 이 제품 정보에 반영해 드릴게요.'

/**
 * 부분 저장일 때의 「저장됐다」.
 * ⚠ 「등록되면 알려드릴게요」로 끝내면 **영양까지 다 들어간 것처럼** 읽힌다.
 *   그래서 여기서는 «무엇이» 저장됐는지 범위를 못 박는다. 바로 아래 영양 안내와 한 쌍이다.
 */
export const REPORT_PARTIAL_SAVED_NEW = '제보 감사합니다! 원재료·알레르기 정보는 잘 저장했어요.'
export const REPORT_PARTIAL_SAVED_EXISTING = '보내주셔서 감사합니다! 원재료·알레르기 정보는 잘 저장했어요.'

/** 반려인데 서버가 사유를 안 줬을 때. 성공처럼 말하지 않는다. */
export const REPORT_REJECT_FALLBACK = '사진은 잘 받았어요. 다만 자동 등록 기준에 못 미쳐 사람이 직접 확인할게요.'

/**
 * ★★ 모르는 사유 코드일 때의 «최후» 문구. 이 상수가 있어서 화면이 침묵하지 않는다.
 *   서버가 코드를 하나 늘리는 순간 앱은 이 문구를 쓴다 — 「아무 말도 안 함」이 되지 않는다.
 */
export const NUTRITION_UNKNOWN_NOTICE =
  '다만 영양정보는 확인하지 못해 저장되지 않았어요. 영양성분표가 잘 보이도록 다시 찍어 주시면 반영해 드릴게요.'

/** 재촬영 버튼 문구. 「할 일이 있다」를 «말»이 아니라 «버튼»으로도 준다. */
export const NUTRITION_RETAKE_CTA = '영양성분표 다시 찍기'

interface NutritionNotice {
  message: string
  /** 다시 찍으면 해결될 수 있는가. false 면 재촬영을 «권하지 않는다»(사용자가 할 일이 없다). */
  retakeable: boolean
}

/**
 * 사유 코드 → 사용자 문구.
 *
 * ★ 각 문구는 세 가지를 «반드시» 담는다:
 *   ① 영양정보가 저장되지 «않았다»는 사실  ② 왜  ③ 사용자가 할 수 있는 일(없으면 없다고)
 *   ②를 빼면 사용자는 같은 실수를 반복하고, ③을 빼면 「미인식」으로 끝난 종전 실패와 같아진다.
 */
const NUTRITION_NOTICE: Record<NutritionRejectCode, NutritionNotice> = {
  // 영양성분표를 아예 못 읽었다. 사용자가 고칠 수 있는 가장 흔한 경우다.
  NO_NUTRIENTS: {
    message: '다만 영양정보는 하나도 읽지 못해 저장되지 않았어요. 영양성분표가 화면에 꽉 차도록 다시 찍어 주시면 반영해 드릴게요.',
    retakeable: true,
  },
  // 숫자는 읽혔는데 「무엇당」인지를 모른다. 표 «맨 윗줄»이 잘려 찍히면 늘 이렇게 된다.
  BASIS_UNKNOWN: {
    message: '다만 영양정보가 1회 제공량당인지 100g당인지 알 수 없어 저장하지 않았어요. 표 맨 윗줄의 기준 문구까지 나오도록 다시 찍어 주세요.',
    retakeable: true,
  },
  // 총 내용량 기준 라벨인데 몇 인분인지 모른다. 「○인분」 표기가 대개 표 «밖»에 있다.
  PER_TOTAL_UNRESOLVED: {
    message: '다만 총 내용량 기준으로 적힌 라벨이라 1회 섭취량을 알 수 없어 영양정보를 저장하지 않았어요. 「1회 제공량」이나 「○인분」 표기가 함께 나오도록 다시 찍어 주세요.',
    retakeable: true,
  },
  // 숫자가 물리적으로 불가능하다 = 대개 OCR 오독이다. 사용자 잘못이라고 말하지 않는다.
  SANITY_OUTLIER: {
    message: '다만 영양성분 숫자를 잘못 읽은 것 같아 저장하지 않았어요. 표가 반듯하고 그림자 없이 나오도록 다시 찍어 주시면 반영해 드릴게요.',
    retakeable: true,
  },
  // 성분 합이 총량을 넘는다 = 표가 잘렸거나 두 제품이 섞여 찍혔다.
  MASS_BALANCE: {
    message: '다만 영양성분 숫자의 합이 맞지 않아 저장하지 않았어요. 표가 잘리지 않고 전체가 나오도록 다시 찍어 주시면 반영해 드릴게요.',
    retakeable: true,
  },
  // ★ 유일하게 «사용자가 할 일이 없는» 사유다. 다시 찍어도 결과가 같다.
  //   다른 5개와 같은 톤으로 말하면 사용자는 자기 잘못인 줄 알고 다시 찍는다(Vision 2배).
  PUBLIC_DATA_PROTECTED: {
    message: '영양정보는 이미 공식 데이터가 등록돼 있어 그대로 두었어요. 다시 찍지 않으셔도 됩니다.',
    retakeable: false,
  },
}

export type PhotoReportOutcomeKind = 'saved' | 'partial' | 'rejected'

export interface PhotoReportOutcomeInput {
  /** `confirmPhotoReport()` 의 `saved`. */
  saved: boolean
  /** `confirmPhotoReport()` 의 `rejectReason`(서버 한국어). 반려일 때만 의미가 있다. */
  rejectReason: string | null
  /** 서버 `nutrition_status` 원문. **null = 구버전 서버**(말이 없었다). */
  nutritionStatus: string | null
  /** 서버 `nutrition_reject_code` 원문. 모르는 값일 수 있다. */
  nutritionRejectCode: string | null
  /** 미등록 제품 제보인가, 등록된 제품에 보태는 것인가. 「저장됐다」문구가 갈린다. */
  target: 'new' | 'existing'
}

export interface PhotoReportOutcome {
  kind: PhotoReportOutcomeKind
  /** 첫 줄. **항상 비어 있지 않다.** 화면이 아무 말도 안 하는 상태를 만들지 않는다. */
  headline: string
  /**
   * 영양 안내. `kind === 'partial'` 이면 **절대 null 이 아니다**(불변식).
   * 그 외에는 null — 저장된 것을 「못 읽었다」고 말하지도 않는다.
   */
  nutritionNote: string | null
  /** true 면 화면이 재촬영 버튼을 «준다». 말만 하고 길을 안 주면 안내가 아니다. */
  retakeable: boolean
  /**
   * 계측용 정규화 코드. ⚠ **화면에 쓰지 말 것.**
   *   'OK'       영양까지 저장됐다
   *   'UNKNOWN'  영양은 떨어졌는데 «사유를 모른다»(서버가 코드를 늘렸다는 신호 — 관측해야 한다)
   *   null       서버가 영양 상태를 말하지 않았다(구버전 서버)
   */
  nutritionCode: 'OK' | 'UNKNOWN' | NutritionRejectCode | null
}

function isKnownCode(code: string | null): code is NutritionRejectCode {
  return !!code && Object.prototype.hasOwnProperty.call(NUTRITION_NOTICE, code)
}

/**
 * 저장 결과 → 사용자에게 할 말.
 *
 * ★ 하위 호환 — `nutritionStatus` 가 null 이면 **종전과 «똑같이»** 동작한다.
 *   서버가 아직 안 올라갔거나 다른 엔드포인트를 탄 경우다. 없는 사실을 지어내지 않는다.
 *
 * ★ 모르는 status 는 «ok 가 아니다». `'ok'` 만 ok 로 본다.
 *   서버가 `'partial'` 같은 값을 새로 내면 앱은 그것을 「확인 못 함」쪽으로 읽는다 —
 *   Render Conservative. 반대로 읽으면 「모름」이 「저장됨」이 된다.
 */
export function classifyPhotoReportOutcome(input: PhotoReportOutcomeInput): PhotoReportOutcome {
  // ── 전부 반려 ──
  // ⚠ 영양 필드가 실려 와도 무시한다. 아무것도 저장되지 않았으므로 「원재료는 저장했어요」가
  //   거짓이 된다. 서버 반려 사유를 그대로 보여준다(제품명 누락·신뢰도 미달·24시간 중복).
  if (!input.saved) {
    return {
      kind: 'rejected',
      headline: input.rejectReason?.trim() || REPORT_REJECT_FALLBACK,
      nutritionNote: null,
      retakeable: false,
      nutritionCode: null,
    }
  }

  const status = input.nutritionStatus?.trim() || null

  // ── 구버전 서버 — 영양 상태를 말하지 않았다 ──
  // 「말이 없었다」를 「영양도 저장됐다」로 승격시키는 것이 아니라, **종전 화면 그대로** 둔다.
  // (여기서 「확인 못 했을 수도 있어요」를 띄우면, 멀쩡히 저장된 건에도 매번 뜬다.)
  if (status === null) {
    return {
      kind: 'saved',
      headline: input.target === 'new' ? REPORT_SAVED_NEW : REPORT_SAVED_EXISTING,
      nutritionNote: null,
      retakeable: false,
      nutritionCode: null,
    }
  }

  // ── 전부 저장 ──
  if (status === 'ok') {
    return {
      kind: 'saved',
      headline: input.target === 'new' ? REPORT_SAVED_NEW : REPORT_SAVED_EXISTING,
      nutritionNote: null,
      retakeable: false,
      nutritionCode: 'OK',
    }
  }

  // ── 부분 저장 ──
  // status 가 'incomplete' 든, 서버가 새로 만든 모르는 값이든 여기로 온다.
  const code = input.nutritionRejectCode?.trim() || null
  const notice = isKnownCode(code)
    ? NUTRITION_NOTICE[code]
    // ★★ 모르는 코드(또는 코드 없음) — 그래도 **말은 한다.**
    //   `retakeable: true` 인 이유: 6종 중 5종이 재촬영으로 풀린다. 모르는 코드를
    //   「할 일 없음」으로 두면, 실제로는 다시 찍으면 됐을 건을 영영 못 고친다.
    //   반대 방향의 손해(헛수고 한 번)가 더 싸다.
    : { message: NUTRITION_UNKNOWN_NOTICE, retakeable: true }

  return {
    kind: 'partial',
    headline: input.target === 'new' ? REPORT_PARTIAL_SAVED_NEW : REPORT_PARTIAL_SAVED_EXISTING,
    nutritionNote: notice.message,   // ★ 불변식 — partial 이면 여기는 절대 null 이 아니다
    retakeable: notice.retakeable,
    nutritionCode: isKnownCode(code) ? code : 'UNKNOWN',
  }
}
