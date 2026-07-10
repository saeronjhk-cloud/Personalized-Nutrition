import { describe, it, expect } from 'vitest'
import { buildPhotoAiSuggestBody, buildPhotoAiConfirmBody, parsePhotoAiSuggest } from '../leftover_math'

describe('buildPhotoAiSuggestBody', () => {
  it('1. 형태 + 기본 mime', () => {
    expect(buildPhotoAiSuggestBody('m1', 'BASE64DATA')).toEqual({
      pre_meal_log_id: 'm1', leftover_method: 'photo_ai', after_image: 'BASE64DATA', after_image_mime: 'image/jpeg',
    })
  })
  it('2. mime 지정', () => {
    expect(buildPhotoAiSuggestBody('m1', 'X', 'image/png').after_image_mime).toBe('image/png')
  })
})

describe('buildPhotoAiConfirmBody', () => {
  it('3. 형태 + 클램프, 이미지/pre_summary 미포함', () => {
    expect(buildPhotoAiConfirmBody('m1', 0.65)).toEqual({ pre_meal_log_id: 'm1', leftover_method: 'photo_ai', confirmed_eaten_ratio: 0.65 })
    expect(buildPhotoAiConfirmBody('m1', 1.9).confirmed_eaten_ratio).toBe(1)
    const b = buildPhotoAiConfirmBody('m1', 0.5) as Record<string, unknown>
    expect('after_image' in b).toBe(false)
    expect('pre_summary' in b).toBe(false)
  })
})

describe('parsePhotoAiSuggest', () => {
  it('4. 정상 정규화', () => {
    const p = parsePhotoAiSuggest({
      state: 'photo_ai_suggested', estimated_eaten_ratio: 0.65, confidence: 0.52,
      requires_user_confirmation: true, suggested_note: '약 35% 남기신 것 같아요.',
      adjusted_summary: { total_calories_kcal: 400 }, meal_log_updated: false,
    })
    expect(p.estimatedEatenRatio).toBe(0.65)
    expect(p.confidence).toBe(0.52)
    expect(p.requiresConfirmation).toBe(true)
    expect(p.suggestedNote).toBe('약 35% 남기신 것 같아요.')
    expect(p.previewSummary.total_calories_kcal).toBe(400)
  })
  it('5. requires_user_confirmation=false → false, 그 외엔 true(안전)', () => {
    expect(parsePhotoAiSuggest({ requires_user_confirmation: false }).requiresConfirmation).toBe(false)
    expect(parsePhotoAiSuggest({}).requiresConfirmation).toBe(true)
  })
  it('6. 비율 누락 → 1(clamp NaN), note 기본값', () => {
    const p = parsePhotoAiSuggest({})
    expect(p.estimatedEatenRatio).toBe(1)
    expect(p.suggestedNote.length).toBeGreaterThan(0)
    expect(p.previewSummary).toBeNull()
  })
  it('7. 비율 범위초과 → clamp', () => {
    expect(parsePhotoAiSuggest({ estimated_eaten_ratio: 1.3 }).estimatedEatenRatio).toBe(1)
    expect(parsePhotoAiSuggest({ estimated_eaten_ratio: -0.2 }).estimatedEatenRatio).toBe(0)
  })
})
