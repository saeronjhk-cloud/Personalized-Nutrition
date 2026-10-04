/**
 * ★ 세션75d — 「내가 보낸 제보」 한 건 상세(서버 GET /api/contributions/mine/:id 의 readback) 정규화.
 *   제이 실물(10-04): 카드는 있는데 눌러도 내용이 안 보였다 — 제보는 승인 전까지 제품에 반영되지 않으므로.
 */
import { describe, it, expect } from 'vitest'
import { normalizeContributionDetail, detailNutritionRows, DETAIL_PENDING_NOTE, basisLabel } from '../contributionDetail'

const RAW = {
  contribution_id: 7, created_at: '2026-10-04T07:07:00Z', status: 'pending', barcode: '8801117001445', product_name: '지지미 김치전맛',
  readback: {
    product_name: '지지미 김치전맛', food_type: '과자', total_content: 112, content_unit: 'g',
    ingredients_text: '밀가루, 산화방지제(비타민E)', ingredients: ['밀가루', '산화방지제'],
    allergens: { contains: ['밀'], inferred: [], may_contain: ['우유'] }, additives: ['비타민E'],
    nutrition: { basis: 'per_100g', basis_amount: null, values: { calories: 520, sodium: 0, protein: 'x' } }, nutrition_status: 'ok',
  },
}

describe('normalizeContributionDetail', () => {
  it('정상 응답 → 화면 모델', () => {
    const d = normalizeContributionDetail(RAW)!
    expect(d.id).toBe(7); expect(d.pending).toBe(true)
    expect(d.productName).toBe('지지미 김치전맛'); expect(d.ingredients).toEqual(['밀가루', '산화방지제'])
    expect(d.allergens).toEqual({ contains: ['밀'], inferred: [], mayContain: ['우유'] })
    expect(d.additives).toEqual(['비타민E'])
  })
  it('영양: 숫자만(0 유지) · 화면 순서 · 기준 문구', () => {
    const d = normalizeContributionDetail(RAW)!
    expect(detailNutritionRows(d)).toEqual([
      { key: 'calories', label: '열량', text: '520 kcal' },
      { key: 'sodium', label: '나트륨', text: '0 mg' },
    ])
    expect(basisLabel(d.nutrition!.basis, d.nutrition!.basisAmount)).toBe('100g 기준')
    expect(basisLabel('per_serving', 30)).toBe('1회 제공량(30) 기준')
    expect(basisLabel('unknown', null)).toBe('기준 확인 못 함')
  })
  it('비어 있거나 깨진 응답 → null 또는 빈 칸 (지어내지 않는다)', () => {
    expect(normalizeContributionDetail(null)).toBeNull()
    expect(normalizeContributionDetail({})).toBeNull()
    const d = normalizeContributionDetail({ contribution_id: 3, readback: null })!
    expect(d.productName).toBeNull(); expect(d.ingredients).toEqual([]); expect(d.allergens).toBeNull(); expect(d.nutrition).toBeNull()
  })
  it('승인 전 안내 문구 — 제품 화면엔 아직 없다는 사실', () => {
    expect(DETAIL_PENDING_NOTE).toContain('관리자 확인')
    expect(DETAIL_PENDING_NOTE).not.toMatch(/알려\s*드릴|알려드릴/)
    expect(normalizeContributionDetail({ ...RAW, status: 'approved' })!.pending).toBe(false)
  })
})
