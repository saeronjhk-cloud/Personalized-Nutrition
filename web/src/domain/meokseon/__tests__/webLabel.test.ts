// ★ 세션79 U78-3 — 판매처 라벨 기반 표시 규칙(정답: backends/먹선/IP/eval_web_label_expose_v1/cases_v1.json 문구와 같다)
import { describe, it, expect } from 'vitest'
import { webLabelNotice, supplementView, WEB_LABEL_BADGE, WEB_LABEL_WARNING } from '../webLabel'
import type { MsWebLabelBlock } from '../../../lib/meokseon'

const blk = (o: Partial<MsWebLabelBlock> = {}): MsWebLabelBlock => ({ source: 'web_label', web_id: 1, badge: WEB_LABEL_BADGE, warning: WEB_LABEL_WARNING, collected_at: '2026-10-13T11:20:00Z', collected_label: '2026.10 수집', is_stale: false, nutrition_ok: true, barcode_linked: false, ...o })

describe('webLabelNotice', () => {
  it('바코드 조회 응답(web_label 없음) → null', () => { expect(webLabelNotice({})).toBeNull(); expect(webLabelNotice(null)).toBeNull() })
  it('배지 + 수집월 · 경고 문구는 서버 값 그대로', () => {
    expect(webLabelNotice({ web_label: blk() })).toEqual({ badgeLine: '판매처 라벨 기반 · 바코드 미확인 · 2026.10 수집', warning: WEB_LABEL_WARNING, nutritionOff: false, stale: false })
  })
  it('수집일 없음 → 배지만 · nutrition_ok=false → 신호등 꺼짐 고지 · stale', () => {
    const n = webLabelNotice({ web_label: blk({ collected_label: null, nutrition_ok: false, is_stale: true }) })!
    expect(n.badgeLine).toBe(WEB_LABEL_BADGE); expect(n.nutritionOff).toBe(true); expect(n.stale).toBe(true)
  })
  it('nutrition_ok=null(판정 없음)은 꺼짐 고지가 아니다', () => { expect(webLabelNotice({ web_label: blk({ nutrition_ok: null }) })!.nutritionOff).toBe(false) })
})

describe('supplementView', () => {
  it('보충 없음 → null', () => { expect(supplementView({ web_label_supplements: null })).toBeNull(); expect(supplementView({})).toBeNull() })
  it('알레르기 보충 → 함유·혼입 분리', () => {
    const v = supplementView({ web_label_supplements: { badge: 'b', warning: '', allergens: { contains: ['대두', '밀'], may_contain: ['우유'], collected_label: '2026.10 수집' }, nutrition: null } })!
    expect(v.allergens).toEqual({ contains: ['대두', '밀'], mayContain: ['우유'], collectedLabel: '2026.10 수집' }); expect(v.nutrition).toBeNull(); expect(v.warning).toBe(WEB_LABEL_WARNING)
  })
  it('영양 보충 → 값 있는 행만(0 은 있음) · 기준 표기', () => {
    const v = supplementView({ web_label_supplements: { badge: 'b', warning: 'w', allergens: null, nutrition: { calories: 457, sodium: 0, protein: 39, total_fat: null, basis: 'per_100g', collected_label: null } } })!
    expect(v.nutrition!.rows.map((r) => r.label)).toEqual(['열량', '나트륨', '단백질']); expect(v.nutrition!.basisLabel).toBe('100g 당')
  })
  it('알레르기 빈 배열 + 영양 전부 null → null(빈 카드 금지)', () => {
    expect(supplementView({ web_label_supplements: { badge: 'b', warning: 'w', allergens: { contains: [], may_contain: [], collected_label: null }, nutrition: { basis: null, collected_label: null } } })).toBeNull()
  })
})
