/** ★ 세션81c — 관리자 바코드 연결 확인 큐 문구. 정답 fixtures/kfind_barcode_review_v1.json «wording» (= backends/먹선/IP/eval_kfind_barcode_review_v1). */
import { describe, it, expect } from 'vitest'
import fx from './fixtures/kfind_barcode_review_v1.json'
import { KFB_TAB, KFB_APPROVE, KFB_REJECT, KFB_REOPEN, kfbReasonKo, kfbSourceKo, kfbBlockedText } from '../meokseonAdmin'

const W = (fx as any).wording
describe('바코드 연결 확인 큐 문구 (정답 v1)', () => {
  it('버튼·탭', () => { expect(KFB_TAB).toBe(W.tab); expect(KFB_APPROVE).toBe(W.approve); expect(KFB_REJECT).toBe(W.reject); expect(KFB_REOPEN).toBe(W.reopen) })
  for (const [k, v] of Object.entries(W.reason_ko)) it(`사유 ${k}`, () => { expect(kfbReasonKo(k)).toBe(v) })
  for (const [k, v] of Object.entries(W.source_ko)) it(`출처 ${k}`, () => { expect(kfbSourceKo(k)).toBe(v) })
  it('409 문장', () => { expect(kfbBlockedText('PUBLIC_EXISTS')).toBe(W.blocked_public); expect(kfbBlockedText('LINKED_ELSEWHERE')).toBe(W.blocked_linked); expect(kfbBlockedText('X')).toBeNull() })
  it('모르는 사유는 코드 그대로 · 없으면 -', () => { expect(kfbReasonKo('zzz')).toBe('zzz'); expect(kfbReasonKo(null)).toBe('-') })
})
