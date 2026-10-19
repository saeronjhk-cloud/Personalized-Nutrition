/** ★ 세션82 결정 ⑧ — 사진 제보 제품 ← K-FIND 보충 카드(웹 소비). 서버 정답 backends/먹선/IP/eval_photo_kfind_supplement_v1 S6. */
import { describe, it, expect } from 'vitest'
import { kfindSupplementView } from '../kfind'

const sup = (o: Record<string, unknown> = {}) => ({ badge: '식약처 영양성분 DB 보충', source_label: '출처: 식품의약품안전처 식품영양성분 데이터베이스', release_label: '2026.09.29 기준', food_cd: 'P1', nutrition: { calories: 250, sodium: 2100, basis: 'per_100g' }, ...o })
describe('kfindSupplementView — 바코드 응답 최상위 kfind_supplement(S6)', () => {
  it('사진 제보 제품(web_label 없음) → 최상위 보충으로 카드', () => {
    const v = kfindSupplementView({ web_label: null, kfind_supplement: { ...sup(), match: 'ocr_report_no' } } as any)
    expect(v?.title).toBe('식약처 영양성분 DB 보충'); expect(v?.basisLabel).toBe('100g당'); expect(v?.rows[0]).toEqual({ label: '열량', value: 250, unit: 'kcal' })
    expect(v?.sourceLine).toBe('출처: 식품의약품안전처 식품영양성분 데이터베이스 (2026.09.29 기준)')
  })
  it('판매처 품목의 보충이 있으면 그것이 우선', () => {
    const v = kfindSupplementView({ web_label: { kfind_supplement: sup({ badge: '판매처쪽' }) }, kfind_supplement: sup({ badge: '최상위' }) } as any)
    expect(v?.title).toBe('판매처쪽')
  })
  it('둘 다 없으면 null', () => { expect(kfindSupplementView({ web_label: null, kfind_supplement: null } as any)).toBeNull() })
})
