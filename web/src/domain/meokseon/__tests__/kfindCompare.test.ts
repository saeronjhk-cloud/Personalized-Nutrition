/** ★ 세션81g — 신호등 끈 사유별 문구 · 비교 카드. 정답 fixtures/kfind_compare_v1.json (= backends/먹선/IP/eval_kfind_compare_v1). */
import { describe, it, expect } from 'vitest'
import fx from './fixtures/kfind_compare_v1.json'
import { webNutritionOffNote, WEB_NUTRITION_OFF_NOTE, WEB_NUTRITION_OFF_KFIND_NOTE, WEB_NUTRITION_GROSS_NOTE } from '../webLabel'
import { kfindSupplementView } from '../kfind'

const W = (fx as any).wording
const wl = (o: any = {}) => ({ web_label: { source: 'web_label', web_id: 1, badge: '', warning: '', collected_at: null, collected_label: null, is_stale: false, nutrition_ok: false, barcode_linked: false, ...o } }) as any
describe('신호등 끈 사유별 문구 (정답 v1)', () => {
  it('문구 = 정답', () => { expect(WEB_NUTRITION_OFF_NOTE).toBe(W.note_calc); expect(WEB_NUTRITION_OFF_KFIND_NOTE).toBe(W.note_kfind); expect(WEB_NUTRITION_GROSS_NOTE).toBe(W.note_gross) })
  it('calc → 열량 계산 문구', () => { expect(webNutritionOffNote(wl({ nutrition_off_reason: 'calc' }))).toBe(W.note_calc) })
  it('kfind → 식약처와 다름 문구', () => { expect(webNutritionOffNote(wl({ nutrition_off_reason: 'kfind', kfind_gross: false }))).toBe(W.note_kfind) })
  it('kfind + gross → 크게 다름 문구', () => { expect(webNutritionOffNote(wl({ nutrition_off_reason: 'kfind', kfind_gross: true }))).toBe(W.note_gross) })
  it('구버전 서버(사유 없음) → 종전 문구', () => { expect(webNutritionOffNote(wl({}))).toBe(W.note_calc) })
  it('신호등 켜짐·판정 없음 → null', () => { expect(webNutritionOffNote(wl({ nutrition_ok: true }))).toBeNull(); expect(webNutritionOffNote(wl({ nutrition_ok: null }))).toBeNull(); expect(webNutritionOffNote(null)).toBeNull() })
  it('비교 카드 제목 = 서버 badge(비교)', () => {
    const v = kfindSupplementView(wl({ kfind_supplement: { badge: W.compare_badge, role: 'compare', source_label: '출처', release_label: null, food_cd: 'P1', nutrition: { calories: 53, basis: 'per_100g' } } }))
    expect(v?.title).toBe(W.compare_badge); expect(v?.rows[0]).toEqual({ label: '열량', value: 53, unit: 'kcal' })
  })
})
