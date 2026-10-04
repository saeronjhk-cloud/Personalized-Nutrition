/**
 * ★ 세션75d — 제품 화면 «전체 판독 고지» 1개 (제이 결정 10-04: 「전체 고지 1개 + 알레르기 1줄」).
 *   알레르기 카드만 «검증 중» 경고가 떠서, 똑같이 불완전한 첨가물·영양은 믿어도 되는 것처럼 읽혔다.
 */
import { describe, it, expect } from 'vitest'
import { readingNotice, ALLERGEN_PACKAGE_LINE } from '../readingNotice'

describe('readingNotice', () => {
  it('사진 제보로 만든 제품 → 판독 불완전 + 관리자 확인 후 반영', () => {
    const n = readingNotice({ data_source: 'ocr_crowdsource' })
    expect(n.kind).toBe('crowd')
    expect(n.text).toContain('사진')
    expect(n.text).toContain('다를 수 있어요')
    expect(n.text).toContain('관리자 확인')
  })
  it('공공 자료 제품 → 자동 정리 · 포장 확인 (관리자 확인 약속은 하지 않음)', () => {
    for (const ds of ['public_c005', 'public_nutrition', 'open_food_facts', null, undefined, '']) {
      const n = readingNotice({ data_source: ds as string | null | undefined })
      expect(n.kind).toBe('public')
      expect(n.text).toContain('다를 수 있어요')
      expect(n.text).not.toContain('관리자 확인')
    }
  })
  it('지키지 못할 약속(알림)을 하지 않는다 — 사용자 알림 기능이 아직 없다', () => {
    for (const ds of ['ocr_crowdsource', 'public_c005']) expect(readingNotice({ data_source: ds }).text).not.toMatch(/알려\s*드릴|알려드릴|알림/)
  })
  it('알레르기 1줄 — 포장 직접 확인', () => {
    expect(ALLERGEN_PACKAGE_LINE).toContain('반드시 포장의 알레르기 표기를 직접 확인')
    expect(ALLERGEN_PACKAGE_LINE).not.toContain('검증 중')
  })
})
