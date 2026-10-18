/**
 * ★ 세션81 결정 80-9 — «사용자 바코드 연결» 화면 규칙(순수 함수 · 문구 정본).
 *   정답 backends/먹선/IP/eval_user_barcode_v1/cases_v1.json «wording» = __tests__/fixtures/user_barcode_v1.json
 *   판정은 서버 엔진(src/services/userBarcodeGate)이 한다 — 화면은 판정 결과를 말로 옮기기만 한다(다시 판단하지 않는다).
 */
export const LINK_OFFER_BUTTON = '이름으로 찾아서 연결하기'
export const LINK_OFFER_HINT = '제품 이름을 검색한 뒤, 식약처 영양성분 DB 품목을 열면 이 바코드와 연결할 수 있어요.'
export const LINK_CONFIRM_BODY = '포장의 제품 이름·맛·용량이 같은지 확인해 주세요. 다른 제품과 연결하면 잘못된 영양정보가 보여요.'
export const LINK_CONFIRM_BUTTON = '이 제품과 연결하기'
export const LINK_CANCEL_BUTTON = '연결 안 함'
export const MY_LINK_NOTE = '회원님이 이 바코드와 연결한 제품이에요.'
export const LINK_ERROR_LIMIT = '오늘은 더 연결할 수 없어요. 내일 다시 시도해 주세요.'
export const LINK_ERROR_NETWORK = '연결하지 못했어요. 잠시 후 다시 시도해 주세요.'

export function linkConfirmTitle(barcode: string): string { return `바코드 ${barcode} 를 이 제품과 연결할까요?` }

export type LinkVerdict = 'auto' | 'personal' | 'needs_review' | 'reject' | 'keep'
export interface LinkOutcome { tone: 'ok' | 'wait' | 'error'; text: string }

/** 서버 판정 → 사용자에게 할 말. */
export function linkOutcome(r: { verdict: LinkVerdict | string; reason?: string | null; personal?: boolean | null }): LinkOutcome {
  switch (r.verdict) {
    case 'personal': return { tone: 'ok', text: '연결했어요. 다음부터 이 바코드를 찍으면 이 제품이 바로 나와요. 다른 분도 같은 제품으로 연결하면 모두에게 보여요.' }
    case 'auto': return { tone: 'ok', text: '연결했어요. 이제 누구나 이 바코드로 이 제품을 볼 수 있어요.' }
    case 'needs_review': return r.personal
      ? { tone: 'wait', text: '연결했어요. 다른 분의 연결과 달라 담당자가 확인할게요. 그동안은 회원님 화면에서만 이 제품이 나와요.' }
      : { tone: 'wait', text: '이 바코드는 이미 다른 제품 정보와 이어져 있어 담당자가 확인할게요.' }
    case 'keep': return { tone: 'wait', text: '이 바코드는 담당자가 이미 확인한 제품이에요.' }
    default:
      if (r.reason === 'checksum' || r.reason === 'format') return { tone: 'error', text: '바코드 숫자가 올바르지 않아요. 다시 찍어 주세요.' }
      if (r.reason === 'target_hidden') return { tone: 'error', text: '이 품목은 지금 연결할 수 없어요. 이름으로 다시 검색해 주세요.' }
      return { tone: 'error', text: LINK_ERROR_NETWORK }
  }
}

/* ── ★ 세션81b — K-FIND 상세에서 «바코드 찍어서 연결» (정답 web_rules WS · WP) ── */
export const SCAN_LINK_BUTTON = '이 제품 바코드를 찍어 연결하기'
export const SCAN_LINK_HINT = '포장 뒷면 바코드를 찍으면, 다음부터 그 바코드로 이 제품이 바로 나와요.'
export const MANUAL_LABEL = '카메라를 쓸 수 없으면 바코드 숫자를 입력해 주세요'
export const MANUAL_BUTTON = '이 숫자로 연결 준비'
export const BAD_BARCODE = '바코드 숫자가 올바르지 않아요. 다시 찍어 주세요.'

/** 버튼을 보일지 — K-FIND 품목이고, 바코드로 연 것도·본인 연결도 아니고, 연결 대기 중도 아닐 때. */
export function canOfferScanLink(s: { kfind: boolean; barcode_linked: boolean; linkFor: string | null; myLinked: boolean }): boolean {
  return s.kfind && !s.barcode_linked && !s.linkFor && !s.myLinked
}

/** 서버 userBarcodeGate.normalizeBarcode + 체크섬과 같은 규칙: 숫자만 · 12자리(UPC-A)는 앞에 0 · 8/13자리 + 체크숫자 OK 만. */
export function parseLinkBarcode(raw: string): string | null {
  let s = String(raw ?? '').replace(/\D/g, '')
  if (s.length === 12) s = '0' + s
  if (!/^(\d{8}|\d{13})$/.test(s)) return null
  const d = s.split('').map(Number); const n = d.length; let t = 0
  for (let i = 0; i < n - 1; i++) t += d[i] * (((n - 1 - i) % 2 === 1) ? 3 : 1)
  return (10 - (t % 10)) % 10 === d[n - 1] ? s : null
}
