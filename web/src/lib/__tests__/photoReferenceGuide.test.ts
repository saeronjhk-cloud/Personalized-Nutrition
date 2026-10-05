/**
 * 기준 도구 촬영 안내·검출 피드백 — P1~P6 · W1 (IP/integration/meal_photo_reference_guide_v1.md)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { referenceNote, PHOTO_GUIDE_TIPS } from '../photoGuide'

describe('기준 도구 피드백', () => {
  it('P1 젓가락 high', () => expect(referenceNote({ detected: true, type: 'ref_chopsticks', confidence: 0.8, level: 'high' })).toBe('🥢 젓가락을 기준으로 양을 맞췄어요'))
  it('P2 젓가락 low', () => expect(referenceNote({ detected: true, type: 'ref_chopsticks', level: 'low' })).toBe('🥢 젓가락을 참고해 양을 대략 맞췄어요'))
  it('P3 동전 · 조사', () => {
    expect(referenceNote({ detected: true, type: 'ref_coin', level: 'high' })).toBe('🪙 500원 동전을 기준으로 양을 맞췄어요')
    expect(referenceNote({ detected: true, type: 'ref_fork', level: 'high' })).toBe('🍴 포크를 기준으로 양을 맞췄어요')
  })
  it('P4 미검출·빈 값', () => {
    for (const v of [{ detected: false, type: null }, null, undefined, 'ref_spoon', {}]) expect(referenceNote(v)).toBeNull()
  })
  it('P5 모르는 종류', () => expect(referenceNote({ detected: true, type: 'unknown_x', level: 'high' })).toBeNull())
  it('P6 level 없음(옛 엔진) = high 문구', () => expect(referenceNote({ detected: true, type: 'ref_spoon' })).toBe('🥄 숟가락을 기준으로 양을 맞췄어요'))
  it('W1 Meal.tsx 배선', () => {
    const page = readFileSync(resolve(__dirname, '../../pages/Meal.tsx'), 'utf-8')
    expect(PHOTO_GUIDE_TIPS[0]).toContain('숟가락이나 젓가락')
    expect(page).toContain('{!previewUrl && PHOTO_GUIDE_TIPS.map(')
    expect(page).toContain('referenceNote(result.reference)')
  })
})
