/** ★ 세션81 — 사용자 바코드 연결 문구. 정답 fixtures/user_barcode_v1.json «wording» (= backends/먹선/IP/eval_user_barcode_v1). */
import { describe, it, expect } from 'vitest'
import fx from './fixtures/user_barcode_v1.json'
import { canOfferScanLink, parseLinkBarcode, SCAN_LINK_BUTTON, SCAN_LINK_HINT, MANUAL_LABEL, MANUAL_BUTTON, BAD_BARCODE, linkOutcome, linkConfirmTitle, LINK_OFFER_BUTTON, LINK_OFFER_HINT, LINK_CONFIRM_BODY, LINK_CONFIRM_BUTTON, LINK_CANCEL_BUTTON, MY_LINK_NOTE, LINK_ERROR_LIMIT, LINK_ERROR_NETWORK } from '../barcodeLink'

const W = (fx as any).wording
describe('barcodeLink wording (정답 셋 v1)', () => {
  it('고정 문구', () => {
    expect(LINK_OFFER_BUTTON).toBe(W.offer_button); expect(LINK_OFFER_HINT).toBe(W.offer_hint)
    expect(LINK_CONFIRM_BODY).toBe(W.confirm_body); expect(LINK_CONFIRM_BUTTON).toBe(W.confirm_button); expect(LINK_CANCEL_BUTTON).toBe(W.cancel_button)
    expect(MY_LINK_NOTE).toBe(W.my_link_note); expect(LINK_ERROR_LIMIT).toBe(W.errors.CLAIM_LIMIT); expect(LINK_ERROR_NETWORK).toBe(W.errors.network)
    expect(linkConfirmTitle('8801234560016')).toBe(W.confirm_title.replace('{barcode}', '8801234560016'))
  })
  for (const o of W.outcomes) {
    it(`판정 ${o.verdict}${o.reason ? '/' + o.reason : ''} personal=${o.personal}`, () => {
      expect(linkOutcome({ verdict: o.verdict, reason: o.reason ?? null, personal: o.personal })).toEqual({ tone: o.tone, text: o.text })
    })
  }
})

describe('바코드 찍어서 연결 (정답 web_rules)', () => {
  const R = (fx as any).web_rules
  it('문구', () => { expect(SCAN_LINK_BUTTON).toBe(W.scan_link_button); expect(SCAN_LINK_HINT).toBe(W.scan_link_hint); expect(MANUAL_LABEL).toBe(W.manual_label); expect(MANUAL_BUTTON).toBe(W.manual_button); expect(BAD_BARCODE).toBe(W.bad_barcode) })
  for (const c of R.offer) it(`${c.id} ${c.desc}`, () => { expect(canOfferScanLink(c.in)).toBe(c.want) })
  for (const c of R.parse) it(`${c.id} «${c.in}»`, () => { expect(parseLinkBarcode(c.in)).toBe(c.want) })
})
